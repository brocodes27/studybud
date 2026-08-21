# ElevenFolks / Curve — Product Requirements Document (PRD)

**Version:** 2.0 · **Date:** 2026-08-12 · *(v1 2026-08-04 — pre-PERIR-O)*
**Companion docs:** `docs/product-vision.md` (strategy), `docs/product-roadmap.md` (build order), `docs/design.md` (design tokens — run the Design System skill if absent)
**Audience:** coding agents and engineers. Prose is minimal; contracts are explicit.

---

## 0. Product Summary

A B2C web app for students carrying multiple subjects at once. Core loop:

```
Syllabi (N subjects) → topics extracted per subject → each topic carries a PERIR-O stage
        ↓
Daily planner ranks eligible stage-actions across ALL subjects by grade leverage
        ↓
Stage-correct session (Prime / Encode / Reference / Retrieve / Interleave / Overlearn)
        ↓
Gate evaluated → stage advances → BKT mastery updates → forecast recomputes
        ↓
Stage map fills → verified grade receipt → shared
```

**Division of labour:** the grade forecast decides **what** to study (leverage ranking); the PERIR-O stage machine decides **how** it is studied (which stage, gated). Neither ships alone.

**App shell today:** signed-in users land in `src/curve/CurveApp.tsx` (routes `/`, `/tracker`, `/add-course`, `/course/:enrollmentId`, `/session/:enrollmentId`). Signed-out users see `CurveLanding`. All new work lives in `src/curve/` and `src/lib/`; the 50+ legacy pages under `src/pages/` stay feature-flagged out of consumer navigation (§12).

---

## 1. Personas

| Persona | Needs | Key screens |
|---|---|---|
| **Multi-subject undergrad** (primary) | Stage map across 4–6 courses, daily stage-correct queue, tutoring | Dashboard, Stage Map, Stage Session, Course Detail |
| **Competitive-exam aspirant** | Year-long multi-subject sequencing, heavy interleaving, unlocked overlearning | Stage Map, Interleave sets, Overlearn sprints |
| **Crammer** (48–96h pre-exam) | Correctly-gated emergency sequence, not blind drilling | ExamEmergencySprint |
| **Parent (read-only)** | Proof of stage progress and grades | PublicReceipt |

---

## 2. The PERIR-O Stage Machine

### 2.1 Stage enum

`stage` is the **furthest stage cleared** for a `(enrollment, topic)` pair. It never regresses; remediation is expressed with the `remedial` flag, not by lowering the stage. This keeps the history honest and keeps the stage map monotonic, which is what makes it readable.

| Value | Meaning |
|---|---|
| `new` | Topic exists on the syllabus, nothing done |
| `primed` | Pre-learning prep complete — brain has a schema for the incoming lecture |
| `encoded` | Actively processed: organized, simplified, connected, analogized |
| `referenced` | Granular detail parked in a retrievable reference layer |
| `retrieved` | Cleared first closed-book retrieval; recurring spaced retrieval now runs on `next_retrieval_on` |
| `interleaved` | Survives mixed-format, mixed-subject testing |
| `overlearned` | Fluent and fast under time pressure |

### 2.2 Advance gates

A stage advances **only** when its gate evaluates true. Gates are pure functions of stored state — implemented in `src/lib/perirO.ts`, no LLM in the decision path.

| From → To | Gate |
|---|---|
| `new` → `primed` | Priming session completed **and** the student submitted ≥3 "questions to listen for". Alternative path: student marks the topic *already covered in class*, which auto-primes it and jumps the queue to Encoding. |
| `primed` → `encoded` | An encoding artifact was submitted **and** scored ≥3/5 by the rubric grader across four dimensions: organize, simplify, connect, analogize. No artifact, no advance. |
| `encoded` → `referenced` | ≥5 accepted reference items exist for the topic's `kc_id` (auto-generated from the encoding artifact, student-editable). |
| `referenced` → `retrieved` | ≥1 closed-book retrieval session of ≥10 items **and** BKT `p_mastery` ≥ 0.55. |
| `retrieved` → `interleaved` | Topic appeared in ≥2 mixed sets spanning ≥2 subjects, with ≥0.65 accuracy on its own items **and** `p_mastery` ≥ 0.75. |
| `interleaved` → `overlearned` | ≥3 timed drills at ≥0.90 accuracy **and** median response time ≤60% of the first drill's median. |

**Gate constants live in one exported object** (`STAGE_GATES` in `src/lib/perirO.ts`) with the thresholds above as defaults. They are calibration knobs — real cohorts will move them. Do not inline these numbers at call sites.

### 2.3 Overlearning is gated by policy, not only by gate

Per the framework, overlearning is a final polish and is the stage students most commonly misuse as a first step. Therefore an Overlearn action is **offered** only when all hold:

1. `stage == 'interleaved'` for that topic, **and**
2. an exam mapped to that topic is ≤14 days away, **or** the enrollment has `competitive_mode = true` (student opt-in, off by default).

Overlearning never appears in the queue for a topic below `interleaved`, at any exam proximity. This rule is the product's spine — do not add an escape hatch for it.

### 2.4 Spaced retrieval schedule

Once a topic reaches `retrieved`, retrieval recurs on `next_retrieval_on`.

- Interval ladder (days): `[1, 3, 7, 16, 35]`, indexed by `retrieval_streak`.
- Session accuracy ≥0.6 → advance the index. Accuracy <0.6 → repeat the current index (no advance) and set `remedial = true` if `p_mastery < 0.40`.
- If an exam mapped to the topic falls before the computed date, clamp `next_retrieval_on` to `exam_date - 2 days`.
- `remedial = true` makes the planner offer an **Encoding** action instead of retrieval, until one encoding artifact clears the rubric again. Stage column is untouched.

> `// ponytail: fixed interval ladder, not FSRS. Swap in FSRS only when we have ≥50k graded reviews to fit parameters against — before that the fitted model is noise.`

### 2.5 Decay

Nightly (or on read, lazily — see §5.3): if `p_mastery < 0.40` for a topic at stage ≥ `retrieved`, set `next_retrieval_on = today` and `remedial = p_mastery < 0.25`.

---

## 3. Multi-Subject Daily Planner

The planner is the other half of the product. It runs **across every active enrollment**, not per course. Implemented in `src/lib/studyPlanner.ts` as a pure ranking function over a loaded snapshot, plus a thin Supabase loader. Client-side — the forecast is already computed client-side and a server round-trip buys nothing here.

### 3.1 Candidate generation

For each `(enrollment, topic)` produce **at most one** candidate action — the single next thing that topic needs:

```
if remedial                         → 'encode'
else if stage == 'new'              → 'prime'
else if stage == 'primed'           → 'encode'
else if stage == 'encoded'          → 'reference'
else if stage == 'referenced'       → 'retrieve'
else if next_retrieval_on <= today  → 'retrieve'
else if stage == 'retrieved'        → 'interleave'   (pooled, see 3.5)
else if overlearn policy satisfied  → 'overlearn'
else                                → no candidate
```

### 3.2 Scoring

```
leverage(candidate) = expectedForecastGain / estMinutes

expectedForecastGain =
      STAGE_MASTERY_GAIN[stageAction]      // expected Δ in topic mastery
    × topicShareOfComponent                // 1 / (topics mapped to that component)
    × componentWeightPct                   // from curve_grading_components
    × examProximityFactor                  // 1 + max(0, (21 - daysToExam) / 21)
```

`STAGE_MASTERY_GAIN` defaults — exported constants, calibration knobs:

| Action | Δmastery | est. minutes |
|---|---|---|
| `prime` | 0.05 | 6 |
| `encode` | 0.20 | 18 |
| `reference` | 0.05 | 8 |
| `retrieve` | 0.15 | 12 |
| `interleave` | 0.10 | 15 |
| `overlearn` | 0.03 | 20 |

Encoding scores highest per the framework's claim that it is where information actually moves into long-term memory. That is a hypothesis with a knob attached — recalibrate against measured forecast movement once telemetry exists (§9).

### 3.3 Hard overrides (applied before ranking)

1. **Priming window** — topic's `scheduled_on` is within the next 48h and `stage == 'new'` → force-include at the top. Max 2 per day. Priming is cheap and time-boxed; missing the window costs the entire lecture.
2. **Retrieval due** — `next_retrieval_on <= today` → force-include, oldest-due first. Max 3 per day.

Overrides consume slots from the same daily budget as ranked candidates.

### 3.4 Selection rules

- **Max 3 primary actions per day.** Choice paralysis kills conversion; this constraint is deliberate.
- **Max 2 actions from any single subject.** Multi-subject fairness — a student with five courses must never see a queue that is all Calculus.
- **Minute budget** = `student_behavioral_profiles.typical_session_duration_min` (defaults 90). Trim from the lowest-leverage end until the queue fits.
- **Never two identical stage actions on the same topic in one day.**

### 3.5 The interleave block

Exactly one interleave block per day, offered when ≥6 topics sit at stage ≥ `retrieved` across ≥2 subjects. It is not a per-topic action — it is a pooled set:

- 12 items, drawn across **≥2 subjects and ≥3 distinct topics**.
- No two consecutive items from the same topic. This is the whole point of the stage.
- Format variety required — rotate across `recall`, `apply`, `compare`, `error-spot`. Fixed, predictable formats are the failure mode interleaving exists to fix.
- Items selected via the existing `adaptive-difficulty` edge function, passing the full `kc_ids[]` array rather than a single topic.
- Results attribute per-item back to the owning topic for gate evaluation (§2.2).

---

## 4. Session Specifications

All six run through one shell: `src/curve/StageSession.tsx`, routed as `/session/:enrollmentId?topic=<id>&stage=<stage>`. The shell owns context loading, timing, telemetry, and gate evaluation on completion. Each stage is a body component. **Reuse the listed existing components — do not rebuild them.**

### 4.1 Priming — target 6 minutes

- **Content:** what this topic is about in 3 sentences · 5 questions to listen for in the lecture · 3 terms that will appear · 1 prerequisite check pulled from `knowledge_components.prerequisite_ids` · 1 line connecting it to the previously scheduled topic.
- **Generation:** edge function `generate-primer`, cached per `(course_id, topic_id)` in `curve_stage_primers` and **shared across all students in that course**. One generation serves the whole class — this is the main AI cost control in the system.
- **Student output required for the gate:** ≥3 questions they want answered (pre-filled from the generated five, editable). Passive reading does not prime.
- **Trigger surface:** push/nudge when `scheduled_on` is within 48h (respect quiet hours, §7).

### 4.2 Encoding — target 18 minutes

- Reuse `src/pages/FeynmanBoard.tsx` interaction model: the student explains, ATLAS probes gaps.
- The student must produce one artifact of a chosen type: **explanation**, **analogy**, **simplification**, or **concept link** (linking this topic to a named earlier topic, in any subject — cross-subject links are encouraged and get a rubric bonus).
- Rubric grading (0–5 across organize / simplify / connect / analogize) via the existing grader stack (`grader-agent/`, `notebookAnnotations.ts`). Score ≥3 clears the gate.
- Artifact stored in `curve_stage_events.payload` — it is the input to Reference generation (§4.3), so it must be retrievable.
- ATLAS is grounded per §6: syllabus context + SYOW chunks + BKT state, citations mandatory.

### 4.3 Reference — target 8 minutes

- Calls the existing `generate-flashcards` edge function, seeded with the encoding artifact so cards inherit the student's own framing, and writes to the existing `flashcards` table tagged with `kc_id` and `topic_id`.
- Student reviews, edits, and accepts. Accepted count ≥5 clears the gate.
- This is the "parking lot" — its purpose is to get granular detail *out* of working memory. Cards created here are inputs to Retrieval, never a study activity in themselves. Do not add a "review your cards" flow at this stage.

### 4.4 Retrieval — target 12 minutes

- Reuse `src/components/PracticeTestEngine.tsx` in closed-book mode. No notes surface reachable during the session.
- Items from `adaptive-difficulty` (BKT theta targeting ~70% success — the flow zone).
- Every item calls `KnowledgeTracingService.logInteraction(kcId, isCorrect, responseTimeMs, 'perir_retrieval', metadata, difficulty)`. **Any practice surface emitting interactions without a valid `kc_id` is a P0 bug** — the gates read from BKT and are worthless without it.
- On completion: update `retrieval_streak`, `next_retrieval_on` (§2.4), evaluate gate, recompute forecast, show the forecast delta animation.

### 4.5 Interleaving — target 15 minutes

- Same `PracticeTestEngine`, fed the pooled multi-topic set from §3.5 with the format-variety flag on.
- Post-session breakdown must report **per-topic and per-subject** accuracy, not one aggregate score — the diagnostic value is knowing which topic collapses when it isn't announced in advance.
- Logs with `source: 'perir_interleave'` so interleaved evidence is separable from blocked practice in the gate query.

### 4.6 Overlearning — target 20 minutes, gated (§2.3)

- Timed high-volume drill on a single topic. Scores **speed and fluency**, not just accuracy: report median response time against the student's first-drill baseline.
- Locked-state UI states the reason in one line — "Overlearning is a polish stage. Clear interleaving first." — with a one-tap route to the correct stage action.
- Override is allowed but logged (`stage_override_used`); override rate is a product health metric, not a feature to promote.

---

## 5. Data Model

Extend existing tables. Do **not** create parallel course/topic/mastery structures.

### 5.1 Existing (reuse as-is)

`curve_courses`, `curve_enrollments`, `curve_grading_components`, `curve_scores`, `curve_forecasts`, `curve_forecast_receipts`, `curve_course_topics(course_id, kc_id, topic, week, position)`, `knowledge_components(subject, topic, subtopic, prerequisite_ids[])`, `student_cognitive_profiles(kc_id, p_mastery, cognitive_tier)`, `flashcards`, `curve_ai_metering`, `student_behavioral_profiles`, `subscriptions`.

### 5.2 Altered

```sql
alter table public.curve_courses
  add column if not exists term_start_on date;
alter table public.curve_enrollments
  add column if not exists competitive_mode boolean not null default false;
```

The topic spine already exists and works: `persistCourseTopics()` (`src/curve/data.ts`) calls the `curve_ensure_course_kc()` RPC, which canonicalizes every parsed syllabus topic into `knowledge_components` and maps it to `curve_course_topics` with a `kc_id` and a week number.

A topic's lecture date is **derived**, not stored: `term_start_on + (week - 1) * 7`, computed by `lectureDateFor()` in `src/lib/perirO.ts`. Storing it would mean rewriting every topic row whenever a student corrects the term start.

### 5.3 New

```sql
-- One row per (student enrollment, syllabus topic). The stage map reads this table.
create table if not exists public.curve_topic_stage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid not null references public.curve_enrollments(id) on delete cascade,
  topic_id uuid not null references public.curve_course_topics(id) on delete cascade,
  stage text not null default 'new'
    check (stage in ('new','primed','encoded','referenced','retrieved','interleaved','overlearned')),
  remedial boolean not null default false,
  primed_at timestamptz,
  encoded_at timestamptz,
  referenced_at timestamptz,
  first_retrieved_at timestamptz,
  interleaved_at timestamptz,
  overlearned_at timestamptz,
  retrieval_streak integer not null default 0,
  next_retrieval_on date,
  interleave_appearances integer not null default 0,
  overlearn_drills integer not null default 0,
  baseline_response_ms integer,
  updated_at timestamptz not null default now(),
  unique (enrollment_id, topic_id)
);

-- Append-only session log. Source of truth for gate evaluation, telemetry, and artifacts.
create table if not exists public.curve_stage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid not null references public.curve_enrollments(id) on delete cascade,
  topic_id uuid references public.curve_course_topics(id) on delete set null,
  stage_action text not null
    check (stage_action in ('prime','encode','reference','retrieve','interleave','overlearn')),
  outcome text not null check (outcome in ('completed','abandoned','gate_blocked','overridden')),
  duration_sec integer,
  accuracy numeric(4,3),
  rubric_score numeric(3,1),
  median_response_ms integer,
  payload jsonb not null default '{}'::jsonb,   -- encoding artifact, primer answers, per-topic breakdown
  was_prescribed boolean not null default false, -- powers the stage-correct session rate metric
  created_at timestamptz not null default now()
);

-- Course-level primer cache. Shared across every student in the course.
create table if not exists public.curve_stage_primers (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.curve_courses(id) on delete cascade,
  topic_id uuid not null references public.curve_course_topics(id) on delete cascade,
  content jsonb not null,     -- { summary, listenFor[], terms[], prereqCheck, connectsTo }
  model text,
  created_at timestamptz not null default now(),
  unique (course_id, topic_id)
);
```

**RLS:** follow the existing migration pattern. `curve_topic_stage` and `curve_stage_events` are per-user (`user_id = (select auth.uid())`) for all operations. `curve_stage_primers` is `select` for any authenticated user enrolled in that course; **insert/update service-role only** (the cache is shared, so a client must never be able to poison another student's primer).

**Backfill:** on first load of an enrollment, insert `curve_topic_stage` rows at `stage='new'` for every `curve_course_topics` row on that course. Idempotent (`on conflict do nothing`).

---

## 6. AI / LLM Architecture

- **Provider:** single abstraction `src/lib/aiService.ts` → Gemini primary. Voice: **Vapi only** (decision P0.5); Murf and HeyGen deprecated.
- **Orchestration:** `agentOrchestrator.ts` + `agentTools.ts`. Add two tools: `getTopicStage(enrollmentId, topicId)` and `getStageQueue(userId)` so ATLAS can answer "what should I do next?" and "why am I not allowed to drill this yet?" from real state instead of improvising.
- **Grounding contract (unchanged, now stage-aware):** every ATLAS turn receives course context, retrieved SYOW chunks, BKT mastery **and the topic's current stage**. Stage changes the tutor's job: during Encoding it probes and refuses to summarize; during Retrieval it does not hint until the student commits an answer.
- **Verification:** numeric STEM answers routed through the grader pipeline or labeled `unverified` with a citation. Never present unverified numeric work as final.
- **Cost control, in priority order:** (1) primers cached per course, not per student; (2) reference cards generated once from the encoding artifact; (3) retrieval and interleave item selection is deterministic (`adaptive-difficulty`), never an LLM call per item; (4) all calls metered to `curve_ai_metering`.
- **Metering / tiers:** Free = 1 subject, 10 AI messages/day, no cross-subject interleaving, no overlearning. Pro = unlimited subjects, interleaving, overlearning, voice. Enforced via `curve_ai_metering` + `FeatureGate.tsx`.

---

## 7. UI / UX Requirements

### 7.1 Dashboard — today's queue
Up to 3 action cards + at most 1 interleave card. Every card shows: **stage word** (Prime / Encode / Reference / Retrieve / Interleave / Overlearn), subject, topic, estimated minutes, and a one-line *why now* ("Calc lecture tomorrow", "4th review, due today", "covered last week, never processed"). Empty state when the queue is clear: the stage map, not a feed.

### 7.2 Stage Map — `/map`
The signature screen. Rows = subjects; each row is that subject's topics in syllabus order; each topic renders a 6-segment stage bar. Filters: current week (default) · all · remedial only. Tapping a topic opens its stage detail with history and the next action. Must stay legible at 6 subjects × 30 topics — the wide grid scrolls inside its own container, never the page body.

### 7.3 Gate-blocked state
Never a dead end. State the rule in one sentence, name the correct stage, offer it as one tap, and place the override behind a secondary control.

### 7.4 Session shell
One persistent element across all six stages: the stage name and elapsed/target time. Priming and Reference are hard-capped by design — surface the cap rather than letting them sprawl.

### 7.5 States
Every screen specifies empty, loading, error, and populated. Two failure modes matter most: **primer generation failed** (fall back to a deterministic primer built from the syllabus topic list and prerequisite names — never block Priming on an LLM) and **BKT unavailable** (gates that depend on `p_mastery` hold rather than falsely advancing; show "checking mastery" and retry).

### 7.6 Accessibility
WCAG 2.2 AA on the learner shell. The stage bar must not encode stage by color alone — segments carry shape/fill state and an accessible label.

### 7.7 Design tokens
See `docs/design.md` (Design System skill). Existing references: `docs/dashboard_design.html`, `docs/focus_mode_design.html`.

---

## 8. Non-Functional Requirements

| Area | Requirement |
|---|---|
| **Perf** | Dashboard LCP < 2.5s on 4G · plan computation < 150ms client-side for 6 subjects × 30 topics · forecast recompute < 300ms · AI first token < 2.5s |
| **Correctness** | Stage transitions are idempotent — replaying a completion event must never double-advance a stage or double-count `interleave_appearances` |
| **PWA** | Installable. Offline: today's queue and downloaded retrieval items completable offline, sync on reconnect (`src/sw.ts`) |
| **Cost** | AI COGS ≤12% of ARPU. Primer cache hit rate ≥80% within a course after the first 5 students |
| **Security** | RLS on every new table · no client-side service keys · primer writes service-role only |
| **Privacy** | No LMS scraping — student-provided syllabi only · data export and delete endpoints must include stage history |
| **Analytics** | In-house on Supabase `closed_loop` tables (decision P0.4). `VITE_ANALYTICS_PROVIDER=inhouse` |
| **Reliability** | The loop degrades gracefully: with AI down, Retrieval, Interleaving, Overlearning, planning, and forecasting all still work — only Priming and Encoding need generation, and Priming has a deterministic fallback |

---

## 9. Instrumentation

Event taxonomy v2 (extends v1; keep `syllabus_dropped`, `forecast_viewed`, `paywall_shown/converted`, `receipt_shared`):

`stage_action_prescribed` · `stage_session_started` · `stage_session_completed` · `stage_advanced` · `stage_gate_blocked` · `stage_override_used` · `interleave_set_completed` · `overlearn_unlocked` · `primer_cache_hit` · `remedial_triggered`

Derived metrics:
- **Stage-correct session rate** = completed sessions with `was_prescribed = true` ÷ all completed sessions.
- **Topics cleared through Retrieval per active per week.**
- **Priming coverage** = topics primed before `scheduled_on` ÷ topics with a `scheduled_on` in that window.
- **Override rate** per gate — a spike means a threshold in `STAGE_GATES` is wrong, not that students are wrong.
- **Measured Δmastery per stage action**, fed back to recalibrate `STAGE_MASTERY_GAIN`.
- **WVL** (north star) via the existing `curve_settle_forecasts` trigger.

---

## 10. Edge Cases & Error Handling

| Case | Behavior |
|---|---|
| Course has no `term_start_on`, or a topic has no week | The derived lecture date is null. Those topics never trigger the Priming window override; they enter the queue by leverage ranking only. |
| Topic has no `kc_id` mapping | Gates depending on `p_mastery` can't evaluate. Allow stages through `referenced`, hold at `referenced` and surface a "map this topic" prompt. |
| Student adds a course mid-semester | Backfill stage rows at `new`. Onboarding offers a bulk "already covered in class" marker for past weeks, which auto-primes and routes them straight to Encoding. |
| Exam in 3 days, most topics at `new` | Planner relaxes the 3-action cap to the minute budget and prefers `encode` → `retrieve` chains on the highest-weight components. Overlearning stays locked — proximity does not unlock it. |
| Two subjects with identically named topics | Stage rows key on `topic_id`, never topic text. Display disambiguates with the subject. |
| Student overrides a gate repeatedly | Allowed and logged. After 3 overrides on one topic, one non-blocking note explaining what the skipped stage was for. Never nag more than once per topic. |
| Retrieval session abandoned midway | `outcome='abandoned'`. Items answered still log to BKT; the gate does not evaluate; `retrieval_streak` unchanged. |
| Clock/timezone drift on `next_retrieval_on` | All due-date comparisons use the student's local date, computed once per plan run. |
| Primer generation fails | Deterministic fallback primer from syllabus topic + prerequisite names. Log `primer_fallback_used`. Never block. |
| Duplicate completion event (double-tap, retry) | Transitions are idempotent per §8 — dedupe on `(user_id, topic_id, stage_action, created_at` bucketed to the minute`)`. |

---

## 11. Files & Ownership

| Concern | File |
|---|---|
| Stage machine, gates, intervals, constants | `src/lib/perirO.ts` **(new, pure)** |
| Gate unit tests | `src/lib/perirO.test.ts` **(new)** |
| Multi-subject planner (ranking, overrides, caps) | `src/lib/studyPlanner.ts` **(new, pure core + thin loader)** |
| Planner unit tests | `src/lib/studyPlanner.test.ts` **(new)** |
| Stage session shell + six bodies | `src/curve/StageSession.tsx` **(new)**, replacing today's chat-only `StudySession.tsx` |
| Stage map screen | `src/curve/StageMap.tsx` **(new)** |
| Today's queue card | `src/curve/DailyBriefingCard.tsx` (rewrite to stage cards) |
| Stage state read/write | `src/curve/data.ts` (extend) |
| Primer generation | `supabase/functions/generate-primer/index.ts` **(new)** |
| Item selection (retrieval + interleave) | `supabase/functions/adaptive-difficulty/` (extend for multi-`kc_ids`) |
| BKT logging | `src/lib/knowledgeTracing.ts` (unchanged interface) |
| Forecast | `src/curve/gradeEngine.ts` (unchanged) |
| Migrations | `supabase/migrations/20260812*_perir_o_*.sql` |

`src/lib/dailyBriefing.ts` (1,347 lines) is the **legacy** roadmap/prescription planner with a hardcoded task-type rotation (`review_notes`, `guided_examples`, `retrieval_check`, `timed_set`). It is a rough ancestor of this design. It stays behind the legacy flag and is **not** extended — `studyPlanner.ts` replaces it for consumer cohorts.

---

## 12. Explicit Non-Goals

- ✗ FSRS or per-item scheduling (fixed interval ladder until there is data to fit against)
- ✗ New school/teacher/admin features — existing pages stay flagged off, no new work on them
- ✗ Native mobile apps — PWA first, revisit at 50k WAU
- ✗ A user-facing stage-machine diagram or settings panel for gate thresholds
- ✗ Letting Overlearning unlock on exam proximity alone
- ✗ Marketplace of human tutors
- ✗ Streak-for-cash or gambling mechanics

---

## 13. Open Questions

1. `STAGE_MASTERY_GAIN` values are hypotheses from the framework, not measurements. Ship with them, instrument Δmastery per action (§9), recalibrate at ~2,000 sessions.
2. Should Priming be pushed as a notification at a fixed evening hour, or `lecture_time - 3h`? Needs the calendar integration decision — until then, evening only, quiet hours respected.
3. Encoding rubric threshold (≥3/5) is untuned. Watch the abandon rate on Encoding sessions in beta; if >40%, the rubric is too harsh or the artifact demand is too large.
4. Does the free tier's single subject make interleaving invisible enough to hurt conversion? Alternative: allow 2 subjects free so the student *feels* interleaving once. Decide with beta conversion data.
5. GDPR erasure must cover `curve_stage_events` payloads (they contain student-written artifacts). Schedule with the data-export work.

---

## 14. Legacy Surface Policy

50+ legacy routes ship today behind `CurveApp`. Policy: **feature-flag, don't delete.** `VITE_LEGACY_PAGES` gate (`src/lib/featureFlags.tsx`) defaults off for consumer cohorts. No new features on legacy pages.
