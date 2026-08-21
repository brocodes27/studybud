# ElevenFolks / Curve — Product Roadmap

**Version:** 2.0 · **Date:** 2026-08-12 · *(v1 2026-08-04 — pre-PERIR-O)*
**Reads with:** `docs/product-vision.md` (why), `docs/prd.md` (what). This doc = **when and in what order**.
**Status format:** `[ ]` todo · `[~]` in progress · `[x]` done. The coding agent flips the box on completion — this file is the build queue and the single source of progress truth.

**Task IDs keep the repo's existing `P<phase>.<n>` scheme** rather than switching to `TASK-NNN`, because completed Phase 0/1 items are already referenced by that name in commits and in the PRD.

---

## Build Philosophy

1. **Every phase ships a working app.** No phase leaves the product broken or mid-migration.
2. **Reuse before building.** The BKT engine, adaptive selector, practice engine, Feynman board, flashcard generator, grader, and grade engine all exist. New code is the stage machine, the planner, and the shell that routes between them.
3. **Gates are pure and tested.** Anything that decides whether a student may advance is a pure function with unit tests, never an LLM call.
4. **The stage machine before the stages.** Ship state and gates first; the six session bodies land against a working machine.
5. **Instrument as you go.** A stage action that ships without its telemetry event is not done — the calibration constants are guesses until measured.
6. **Never hard-block a student.** Every gate has an explained, logged override path from the day it ships.

---

## Phase 0 — Foundation & Cleanup — ✅ COMPLETE (2026-08-04)

- [x] P0.1 Env lock — Supabase, Vapi, payments keys verified, documented in `docs/env.md`
- [x] P0.2 Legacy pages feature-flagged (`src/lib/featureFlags.tsx`, `VITE_LEGACY_PAGES`)
- [x] P0.3 Baseline build green — `npm run build` + 9 test suites *(pre-existing legacy `tsc -b` errors in `src/closed-loop/*`, `src/components/AIStudyBuddy*` quarantined, not blocking)*
- [x] P0.4 Analytics decision — in-house on Supabase `closed_loop` tables
- [x] P0.5 Voice decision — Vapi only; Murf + HeyGen deprecated
- [x] P0.6 `PaymentProvider` facade in `src/hooks/usePayment.ts` — Dodo active
- [~] P0.7 Tag repo `pre-roadmap-baseline` — deferred, working tree dirty

---

## Phase 1 — The Stage Machine & The Magic Moment (Week 1–4)

**Goal:** a student drops syllabi for 3 subjects and sees every topic on a stage map with a stage-correct queue built for today. Priming and Encoding run end to end.

**Agent session prompt:** *"Build the PERIR-O stage machine per `docs/prd.md` §2 and the multi-subject planner per §3. Land the topic spine and stage table first, then Priming and Encoding sessions, then the stage map. Reuse FeynmanBoard for encoding and the existing grader for rubric scoring. Every gate is a pure function in `src/lib/perirO.ts` with tests."*

### Already complete (carried from v1)

- [x] P1.1 Syllabus parser hardened — per-field confidence (`src/curve/confidence.ts`, 9 tests), review panel in `AddCourse`
- [x] P1.2 Pre-auth parse handoff via `sessionStorage` (`onboardingHandoff.ts`) consumed in `AddCourse`
- [x] P1.3 `gradeEngine.ts` — drop-lowest, extra credit, partial weights; 33 tests
- [x] P1.4 Forecast settlement — `curve_forecasts` + `curve_settle_forecasts` trigger (WVL infrastructure)

### PERIR-O core

- [x] P1.5 Topic spine — **already existed**: `persistCourseTopics()` → `curve_ensure_course_kc()` RPC canonicalizes every parsed topic into `knowledge_components` and maps it to `curve_course_topics` with `kc_id` + week. Added the missing piece: `term_start_on` on `curve_courses` and `competitive_mode` on `curve_enrollments`
  Files: `supabase/migrations/20260812000000_perir_o_stage_engine.sql`
  Notes: The lecture date is **derived** (`term_start_on + (week-1)*7` via `lectureDateFor()`), not stored — a corrected term start moves every topic at once instead of triggering a bulk rewrite. Courses without a term start simply never fire the priming window override. Still open: an input for `term_start_on` in `AddCourse` (folded into P1.15).

- [x] P1.6 Stage tables + RLS
  Files: `supabase/migrations/20260812000000_perir_o_stage_engine.sql`
  Notes: `curve_topic_stage`, `curve_stage_events`, `curve_stage_primers` per PRD §5.3. `curve_stage_events` is append-only by policy — select + insert only, no update or delete, since it is the evidence the gates read. Primers are readable by anyone enrolled in the course, writable only by the service role. `curve_backfill_topic_stages(enrollment_id)` is idempotent.

- [x] P1.7 Stage machine — pure module (25 tests green)
  Files: `src/lib/perirO.ts`, `src/lib/perirO.test.ts` · `npm run test:perir-o`
  Notes: PRD §2. Exports `STAGE_GATES`, `STAGE_MASTERY_GAIN`, `STAGE_MINUTES`, `RETRIEVAL_INTERVALS`, `evaluateGate`, `applyCompletion`, `scheduleNextRetrieval`, `applyDecay`, `canOverlearn`, `nextAction`. No LLM and no clock in the path. Tests cover every gate pass/fail, replay idempotency on stage and timestamps, interval clamping against an exam (and the guard against clamping into the past), and that no stage below `interleaved` can reach overlearning at any exam proximity.

- [x] P1.8 Multi-subject planner v1 (17 tests green)
  Files: `src/lib/studyPlanner.ts`, `src/lib/studyPlanner.test.ts`, `src/curve/stageData.ts` · `npm run test:study-planner`
  Notes: PRD §3. Pure `planDay(input)` plus the Supabase loader in `stageData.ts`. Leverage scoring, both hard overrides, the 3-action cap, max-2-per-subject fairness, and the minute budget — which trims ranked work but never time-critical work. Decay is applied on read so a faded topic comes due immediately rather than at a nightly job. Known approximation, marked `ponytail:` in `stageData.ts`: topics are not mapped to individual components, so each inherits its course's next exam for weight and deadline. Real topic→component mapping lands with P3.3.

- [x] P1.9 Priming session + primer generation + the stage session shell
  Files: `src/curve/StageSession.tsx`, `supabase/functions/generate-primer/index.ts`, `supabase/config.toml`, `src/curve/CurveApp.tsx` (route `/stage/:enrollmentId/:topicId`)
  Notes: PRD §4.1. Primer cached per `(course_id, topic_id)`, read through RLS with the user's client (proves enrolment) and written with the service role (the cache is shared). Deterministic fallback primer built from the topic, its `knowledge_components.prerequisite_ids`, and the previous week's topic — returned **uncached** so a later call can still fill the cache with a real one. Gate is the questions, not the reading: the suggested five are editable, removable, and extendable, and ≥3 must survive. The shell also carries P1.13's gate-blocked state; unbuilt stages fall through to the existing coach session rather than a dead end.

- [x] P1.10 Encoding session + rubric grading (8 tests green)
  Files: `src/curve/encodingRubric.ts`, `src/curve/encodingRubric.test.ts`, `src/curve/ai.ts`, `src/curve/StageSession.tsx` · `npm run test:encoding-rubric`
  Notes: PRD §4.2. Four artifact types; the concept link picks from **every** topic the student carries, so cross-subject links are one tap away, and the +0.5 connect bonus is applied in code rather than asked of the model. Scoring lives in `encodingRubric.ts` with no network or environment import, so the gate is testable — a malformed or missing response scores 0 rather than passing by accident. "Poke a hole in it" runs `probeEncoding`, which is instructed never to explain, define, or summarize: handing over the missing piece is what stops the student encoding it. **Deviation from plan:** `FeynmanBoard.tsx` was not reused — it is a Vapi voice demo with no rubric and no BKT wiring. Encoding runs through `ai-proxy` like the rest of Curve, inheriting its budget gate and usage accounting. Wiring the voice board into this stage is a Phase 2 option, not a prerequisite.

- [x] P1.11 Stage map v1 (7 tests green)
  Files: `src/curve/StageMap.tsx`, `src/curve/stageMapView.ts`, `src/curve/stageMapView.test.ts`, `src/curve/CurveApp.tsx` (route `/map`) · `npm run test:stage-map`
  Notes: PRD §7.2. Rows = subjects, 6-segment bar per topic, three filters (this week / everything / needs attention). Filtering, grouping and the headline counts live in `stageMapView.ts` with no browser or database import, so what a student is told about their own progress is testable. Stage is never carried by colour alone — cleared segments are taller and the bar has a text label naming the stage. Each subject's list scrolls inside its own container so the page body never scrolls sideways. Unscheduled topics always pass the week filter; hiding them would make a schedule-less syllabus invisible forever.

- [x] P1.12 Today's queue on the dashboard
  Files: `src/curve/StageQueue.tsx`, `src/curve/CurveDashboard.tsx`
  Notes: PRD §7.1. Up to 3 stage cards plus the interleave card, each with stage word, subject, topic, minutes and a one-line *why now*. Empty state routes to the stage map and says the quiet day is the system working, not a gap to fill. **Deleted** `MissionPanel` and its `plan-daily-mission` call from the dashboard — the stage queue is what supersedes it, and leaving both would have shown a student two different answers to "what should I do now". The interleave card renders explained-but-inert until item selection lands in P2.5; a button that did nothing would have been worse than an honest one.

- [x] P1.13 Gate-blocked state + logged override — shipped with P1.9
  Files: `src/curve/StageSession.tsx`
  Notes: PRD §7.3. One-sentence rule, named correct stage, one-tap route to it, "Do it anyway" behind a secondary control writing `outcome='overridden'` with the stage it skipped. Overlearning gets its own copy, since it is the gate students will push hardest on.

- [x] P1.14 Telemetry v2 on the stage path
  Files: `src/lib/stageTelemetry.ts`, `src/curve/StageQueue.tsx`, `src/curve/StageSession.tsx`, `src/curve/stageData.ts`
  Notes: PRD §9. Writes to the **existing** `analytics_events` table — no new table, no new vendor, and the RLS story (anyone inserts, admins read) already existed. Every call is fire-and-forget and swallows its own failures; an await here would put a network round-trip in front of the "start" button. `was_prescribed` is recorded at the moment it happens, since the stage-correct session rate is the phase's exit criterion and cannot be reconstructed later. The whole queue logs as one `stage_action_prescribed` event rather than one per card — the interesting unit is the day's plan. A completed-but-blocked session logs `stage_gate_blocked` separately from an abandoned one, because "the student did the work and the gate still refused" is the signal that a threshold is wrong. **Not wired:** `remedial_triggered` — decay is currently computed on read and not persisted, so the event would fire on every page load. It belongs with P3.1, which owns persisting the flag.

- [x] P1.15 Onboarding: term start + "already covered" backfill
  Files: `supabase/migrations/20260812000100_perir_o_onboarding.sql`, `src/curve/data.ts`, `src/curve/AddCourse.tsx`, `src/lib/perirO.ts`
  Notes: PRD §10. Multi-syllabus intake **already existed** (`parseMultiSyllabus*` + the multi-course save loop), so this task reduced to the two pieces the stage engine needs. Added a "Classes start" date, prefilled with `weekStartOn(today)` — without it there are no lecture dates and priming silently never fires, which is a worse failure than asking for one date. Added "Already covered through week N", which calls `curve_mark_topics_covered()` to move those topics from `new` to `primed`: attending the lecture is exactly what priming prepares you for, so those topics belong at Encoding. The function only ever moves a topic forward, so re-running it cannot erase progress. Without this, a student joining mid-semester opens the stage map to a wall of debt.

**Exit criteria:** 20-student beta across ≥3 subjects each · median signup → stage map < 5 min · ≥60% complete their first prescribed stage action · stage-correct session rate ≥ 55% · zero P0 bugs in the stage path.

---

## Phase 2 — The Full Six Stages (Week 5–8)

**Goal:** Reference, Retrieval, Interleaving, and gated Overlearning all live. The loop is complete and repeats across subjects.

**Agent session prompt:** *"Complete the PERIR-O loop per `docs/prd.md` §4.3–4.6. Reuse PracticeTestEngine for retrieval, interleaving, and overlearning — do not write a new quiz runner. Extend `adaptive-difficulty` to accept a multi-topic `kc_ids[]` array for interleaved sets."*

- [x] P2.1 Reference stage — cards from the encoding artifact
  Files: `supabase/migrations/20260812000200_perir_o_reference.sql`, `supabase/functions/generate-flashcards/index.ts`, `src/curve/StageSession.tsx`, `src/curve/stageData.ts`
  Notes: PRD §4.3. `flashcards` had no `kc_id`/`topic_id`, so the migration adds them plus a `source` column — the gate must count cards this student produced for this topic, not a deck imported from elsewhere. `generate-flashcards` gained a `context` field (the encoding artifact, so cards inherit the student's own phrasing) and a `persist: false` mode: it used to save every card it drafted, which would have double-written and filed cards the student never accepted. No card-review flow here by design — reviewing is Retrieval, one stage later.

- [x] P2.2 Retrieval stage — closed book, BKT-logged
  Files: `supabase/functions/check-retrieval/index.ts`, `src/curve/StageSession.tsx`
  Notes: PRD §4.4. Items come from `adaptive-difficulty`, which already accepted `kc_ids` and `topics` — no change needed there, and that also means P2.5's multi-topic sets are already supported at the function level. **New:** `check-retrieval`, because `adaptive-difficulty` deliberately strips answer keys (it reads `question_bank` with the service role, so shipping keys to the browser would hand students the answers). Bank items are graded against `correct_index`/`answer_text`; model-generated items are judged on whether the idea is right, not the wording. A grading failure throws rather than marking answers wrong — recording a false negative would push mastery down for something the student may well have known. Each item logs to BKT individually with `source: 'perir_retrieval'`; the gate reads the mastery the engine returned, not a score the screen calculated. **Deviation:** `PracticeTestEngine` was not reused — it grades client-side against `question.correct_answer`, which this pipeline never exposes.

- [ ] P2.3 Spaced retrieval schedule
  Files: `src/lib/perirO.ts`, `src/lib/studyPlanner.ts`
  Notes: PRD §2.4. Interval ladder `[1,3,7,16,35]`; accuracy <0.6 repeats the index; clamp to `exam_date - 2 days`. Carry the `ponytail:` comment naming the FSRS upgrade path so the shortcut stays visible.

- [ ] P2.4 BKT audit across every practice surface
  Files: `src/components/PracticeTestEngine.tsx`, `QuestionGenerator.tsx`, `FlashcardGenerator.tsx`, `SATSimulator.tsx`, `GuidedPaperSolver.tsx`
  Notes: Any surface emitting interactions without a valid `kc_id` is a P0 bug — the gates read from BKT. Add one regression test asserting no interaction is logged with a null `kc_id`.

- [ ] P2.5 Interleaving stage — the pooled multi-subject set
  Files: `src/curve/StageSession.tsx`, `supabase/functions/adaptive-difficulty/index.ts`
  Notes: PRD §3.5 + §4.5. Extend `adaptive-difficulty` to accept `kc_ids[]` spanning topics. 12 items, ≥2 subjects, ≥3 topics, no two consecutive items from one topic, formats rotating across recall/apply/compare/error-spot. Per-topic **and** per-subject accuracy breakdown after the set — a single aggregate score destroys the diagnostic value.

- [ ] P2.6 Overlearning stage — gated, timed, fluency-scored
  Files: `src/curve/StageSession.tsx`, `src/lib/perirO.ts`
  Notes: PRD §2.3 + §4.6. Offered only at `stage == 'interleaved'` **and** (exam ≤14 days **or** `competitive_mode`). Scores median response time against `baseline_response_ms`, not accuracy alone. Locked-state copy: "Overlearning is a polish stage. Clear interleaving first." Exam proximity alone never unlocks it — assert this in a test.

- [ ] P2.7 Forecast delta on stage advance
  Files: `src/curve/ForecastCard.tsx`, `src/curve/gradeEngine.ts`, `src/curve/data.ts`
  Notes: Completing a stage action visibly moves the forecast, even by +0.1%. This is the dopamine of the loop and the reason the stage machine and the grade engine ship as one product.

- [ ] P2.8 ATLAS stage awareness
  Files: `src/lib/agentOrchestrator.ts`, `src/lib/agentTools.ts`
  Notes: PRD §6. Add `getTopicStage` and `getStageQueue` tools so the tutor answers "what next?" and "why can't I drill this?" from real state. Stage changes the tutor's job: probe during Encoding, withhold hints during Retrieval until the student commits.

- [ ] P2.9 Metering + tier gates on the stage loop
  Files: `src/hooks/usePayment.ts`, `src/components/FeatureGate.tsx`, `src/lib/aiService.ts`
  Notes: Free = 1 subject, 10 AI messages/day, no cross-subject interleaving, no overlearning. Never interrupt a session mid-way — grace to the end, paywall after.

**Exit criteria:** ≥3 stage sessions per active per week · ≥50% of actives have ≥1 topic at `retrieved` · ≥70% of interleaved sets span ≥2 subjects · stage-correct session rate ≥ 65% · primer cache hit rate ≥ 80% within a course after 5 students.

---

## Phase 3 — Depth, Remediation & Calibration (Week 9–11)

**Goal:** the loop self-corrects. Decay, remediation, and the first recalibration of the constants shipped as guesses.

- [ ] P3.1 Decay + remedial routing
  Files: `src/lib/perirO.ts`, `src/lib/studyPlanner.ts`
  Notes: PRD §2.5. `p_mastery < 0.40` at stage ≥ `retrieved` → due today; `< 0.25` → `remedial = true`, which makes the planner offer Encoding instead of Retrieval until an artifact clears the rubric again. The stage column never regresses.

- [ ] P3.2 Constant recalibration from measured Δmastery
  Files: `src/lib/perirO.ts`, internal metrics dashboard
  Notes: PRD §9 + §13.1. After ~2,000 sessions, fit `STAGE_MASTERY_GAIN` to observed mastery movement per stage action and update the constants. Also review override rate per gate — a spike means a threshold in `STAGE_GATES` is wrong, not that students are.

- [ ] P3.3 Concept graph seeding
  Files: `supabase/migrations/20260812*_concept_seed.sql`
  Notes: Seed `knowledge_components` + `prerequisite_ids` for the top 30 weeder courses (Calc I–III, Gen Chem, O-Chem, Physics I–II, Stats, Econ). Prereqs feed the Priming prerequisite check and unblock unmapped-topic holds.

- [ ] P3.4 Exam Simulator Factory
  Files: `src/lib/paperBlueprints.ts`, `src/components/PracticeTestEngine.tsx`
  Notes: Config-driven blueprints (duration, sections, scoring, negative marking). Simulators are true-to-format, unlike practice which targets the 70% flow zone. Results update the mapped component's forecast within 1 minute. Ship configs: generic midterm, final, SAT, CBSE 12.

- [ ] P3.5 SYOW productized — materials library + citations
  Files: `src/lib/aiService.ts`, SYOW ingest path
  Notes: Per-course materials library, per-chunk citations in tutor answers ("from your Week 4 slides, p.12"). Ingest caps (free 3 docs/course, Pro 50), dedupe by content hash, OCR only when needed. Materials also improve primer quality when present.

- [ ] P3.6 Mastery map reparented onto stage data
  Files: `src/components/MasteryTree.tsx`, `src/components/MasteryHeatmap.tsx`, `src/curve/StageMap.tsx`
  Notes: One surface, not two. Mastery becomes a layer on the stage map rather than a separate screen.

- [ ] P3.7 GDPR + data export including stage history
  Files: export/delete endpoints, `supabase/migrations/`
  Notes: PRD §13.5. `curve_stage_events.payload` holds student-written artifacts and must be included in export and erasure.

- [ ] P3.8 Accessibility pass on the learner shell
  Files: `src/curve/*`
  Notes: WCAG 2.2 AA. Stage bars must not rely on color alone. Several current dark-theme neo-brutalist combinations will fail contrast — fix them here.

**Exit criteria:** remediation triggers on <15% of topics (higher means gates are too loose) · measured Δmastery within ±30% of the shipped constants after recalibration · "this taught me something" survey ≥ 65%.

---

## Phase 4 — Habit & Social (Week 12–15)

**Goal:** the loop becomes a daily habit, and squads create the invite K-factor.

- [ ] P4.1 Streaks on stage-correct sessions
  Files: `src/lib/gamification.ts`, `src/components/Gamification/*`
  Notes: A study day credits on ≥1 completed **prescribed** stage action or ≥10 scored minutes. Overridden sessions count for the streak but not for the stage-correct rate. Streak freeze is earnable, never purchasable.

- [ ] P4.2 Notifications — three types only
  Files: `src/components/SmartNotifications.tsx`, `supabase/migrations/*_notification_prefs.sql`
  Notes: (1) priming window before a lecture, (2) retrieval due today, (3) streak rescue (≤1/day, evening). Quiet hours respected. Every notification deep-links to the action, never to a feed. PRD §13.2 is unresolved — until the calendar decision lands, priming nudges fire in the evening only.

- [ ] P4.3 Squads v1
  Files: `src/components/SocialFeatures.tsx`, `supabase/migrations/*_squads.sql`
  Notes: 3–8 students, shared weekly goal measured in stage advances, squad chat-lite.

- [ ] P4.4 Squad interleaved challenges
  Files: `src/pages/SquadProveIt.tsx`
  Notes: A shared multi-subject interleaved set drawn from the squad's overlapping topics. This is the social feature that is also pedagogically correct — it is interleaving by construction.

- [ ] P4.5 Weekly stage-progress digest
  Files: digest email job, `src/lib/dailyBriefing.ts` data reuse
  Notes: Opt-in, for the student and (separately) parents. Shows stage advances, not screen time. Add Resend here — the first recurring email justifies the vendor.

- [ ] P4.6 Retention dashboard
  Files: `src/lib/studentRetentionCore.ts`
  Notes: D7/D30 cohorts by signup week, segmented by stage-correct rate — the hypothesis to test is that method adherence predicts retention.

**Exit criteria:** D30 ≥ 15% · ≥30% of actives in a squad · streak 7d+ ≥ 25% of actives · notification CTR ≥ 20%, opt-out < 5%.

---

## Phase 5 — Growth & Money (Week 16–19)

**Goal:** the stage map and the receipt both go viral; pricing ships.

- [ ] P5.1 Receipts v1 — signed, fraud-resistant
  Files: `src/pages/PublicReceipt.tsx`, `supabase/migrations/*_receipts.sql`
  Notes: `/m/:slug`. Only for courses with ≥3 entered grades and ≥14 days of history; signed server-side. Timeline shows forecast history **and** stage progression — the stage story is what makes the receipt persuasive.

- [ ] P5.2 Shareable stage map image
  Files: canvas/Remotion renderer, `src/curve/StageMap.tsx`
  Notes: One-tap share of the semester grid. This is the screenshot-worthy artifact — design it for a phone screenshot, not a desktop viewport.

- [ ] P5.3 Pricing ship
  Files: `src/hooks/usePayment.ts`, `src/components/SubscriptionPage.tsx`, `supabase/migrations/*_subscriptions.sql`
  Notes: Pro monthly/annual via Dodo behind the existing `PaymentProvider` facade; Razorpay for India (₹399/mo, UPI); PayPal fallback. Unify into one `subscriptions` table. Do not build billing abstraction beyond the thin provider interface.

- [ ] P5.4 Referral loop
  Files: `src/lib/dub.ts`, `supabase/migrations/*_referrals.sql`
  Notes: `dub` is already a dependency. Both sides get 7 days Pro after the invitee's first completed stage action.

- [ ] P5.5 Emergency Sprint as correctly-gated overlearning
  Files: `src/curve/ExamEmergencySprint.tsx`
  Notes: $9 one-off. It must run the correct sequence under time pressure (encode → retrieve → interleave on the highest-weight topics), not blind drilling. Selling students the exact mistake the product exists to fix would be self-defeating.

- [ ] P5.6 Method-led SEO + explainer surface
  Files: landing sections, `src/sections/landing/*`
  Notes: PERIR-O explainer as the primary acquisition asset, plus "is your course covered?" pages from the syllabus graph.

**Exit criteria:** free→paid ≥ 3% · K-factor ≥ 0.15 · stage-map or receipt share rate ≥ 10% of eligible · MRR dashboard live.

---

## Phase 6 — Scale & Polish (Ongoing, post-Week 19)

- [ ] P6.1 Syllabus graph network effects — 1-click onboarding for matched university courses; inherited stage-sequencing priors
- [ ] P6.2 Public forecast-accuracy methodology page + quarterly report (trust as marketing)
- [ ] P6.3 Voice-first commute mode — hands-free retrieval and interleaved sets
- [ ] P6.4 Next-exam ladder — MCAT/GRE/GATE blueprints on the existing simulator factory
- [ ] P6.5 PWA push + offline retrieval packs (`src/sw.ts` hardening)
- [ ] P6.6 FSRS evaluation — only once ≥50k graded reviews exist to fit against (PRD §2.4)
- [ ] P6.7 100k-WAU perf review — edge function scaling, pgvector tuning, AI routing cost tiers
- [ ] P6.8 Decision gate at 50k WAU — native apps? B2B revival? (new doc, not this one)

---

## Dependency Notes

- P1.5 (topic spine) blocks everything. Nothing can be staged until topics are persisted with `kc_id` and `scheduled_on`.
- P1.7 (stage machine) must land before any session body — the sessions call `evaluateGate`.
- P2.5 (interleaving) depends on P2.2 having populated enough topics at `retrieved` to pool from; ship the interleave card with a "not enough topics yet" state.
- P2.6 (overlearning) depends on P2.5 — it is gated on `interleaved`, which only P2.5 can set.
- P3.2 (recalibration) needs P1.14 telemetry running for a full phase. Do not attempt it earlier; the fit will be noise.
- P5.1 (receipts) needs P1.4 settlement to have measured ≥1 cycle. Ship the receipt UI with a "pending verification" state before then.

## How to work this roadmap

1. Work top-down within the current phase. Check the box, update the status line, move on.
2. Every task lands with: code + migration (if any) + test + telemetry event (if it touches the stage path).
3. If a task reveals a prerequisite, insert it in place — this file stays the single source of truth.
4. Gate thresholds and mastery constants are calibration knobs, not settled values. When beta data contradicts them, change the constant and note the measurement — do not add a branch.
