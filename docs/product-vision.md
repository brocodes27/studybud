# ElevenFolks — Product Vision

**Date:** 2026-08-12 (v2 — PERIR-O adoption)
**Status:** Living strategy document
**Owner:** Founder + product/engineering
**Supersedes:** v1 (2026-08-04). The forecast thesis is unchanged; what changed is that the app now owns *how* a student studies, not just *what*.

---

## 1. One-Sentence Vision

ElevenFolks is the **AI Study OS that runs every topic in every subject through the six stages of durable learning** — Priming, Encoding, Reference, Retrieval, Interleaving, Overlearning — while forecasting the grade that sequence is going to produce.

---

## 2. The Problem (Why Hard-Working Students Still Fail)

Students don't fail from laziness or from lack of content. They fail because **they do the right activities in the wrong order**.

1. **Overlearning as a first step.** The most common study behavior — grind practice questions, repeat until tired — is the *last* stage of the sequence, and it only works on material already encoded. Applied first, it produces confident, brittle recall that collapses on an unfamiliar exam question.
2. **No priming, so lectures leak.** Students walk into a lecture cold. With no schema for what's coming, the brain can't tell signal from noise, working memory overloads, and most of the hour evaporates.
3. **Encoding gets skipped entirely.** Highlighting and re-reading feel like processing but aren't. Nothing gets organized, simplified, connected, or analogized — so nothing consolidates into long-term memory.
4. **Reference and working memory are confused.** Students try to hold granular detail in their head instead of parking it in a system, which crowds out the conceptual thinking that actually earns marks.
5. **Practice is predictable, exams aren't.** Blocked practice on one topic in one format builds a fragile pattern-match. The exam asks the same concept sideways and the student freezes.
6. **Multiply by five subjects.** A student carrying 4–6 courses has thirty-plus live topics, each at a different stage, with no instrument to see where anything stands. So they study whatever is most on fire.

Nobody owns the sequence. Every tool on the market sells one stage and calls it studying.

---

## 3. Target Customer

### Primary: The Multi-Subject Student (B2C)
- **Who:** Undergrads 17–24 carrying 4–6 concurrent courses, STEM-heavy first (weeder courses), plus competitive-exam aspirants running year-long multi-subject syllabi (JEE, NEET, CUET, SAT, MCAT).
- **Psychographics:** Works hard, studies most nights, GPA-anxious, time-poor, phone-first. Has tried Anki, ChatGPT, Notion, and a paper planner, and abandoned the stitching-together.
- **Geography:** Worldwide, English-first. India as the density beachhead — the existing CBSE/JEE/NEET/CUET assets and payment rails give a second wedge, and exam-track students are where interleaving and gated overlearning matter most.
- **Willingness to pay:** $8–15/mo; ₹299–499/mo India.

### Secondary (kept warm, not the focus)
- **Parents** — fund the subscription, receive proof-of-work receipts showing real stage progress rather than screen time.
- **Study squads** — peers sharing interleaved challenge sets and stage leaderboards.

### Out of scope for the B2C plan
- B2B school panels and teacher/admin tooling remain in the codebase behind flags. They are not the growth engine.

---

## 4. Positioning & Category

**Category we create:** *Study OS* — a method engine, not a chatbot, flashcard app, or LMS.

| Alternative | Stage it actually sells | Why we win |
|---|---|---|
| Anki / Quizlet | Retrieval only | We schedule Retrieval *and* guarantee the topic was primed and encoded first, so the cards mean something. |
| ChatGPT / Claude | Unstructured Encoding | We know which of your topics needs encoding today, ground it in your syllabus, and record that the stage cleared. |
| Notion / Obsidian | Reference only | We generate the reference layer as a by-product of Encoding, then use it to feed Retrieval. |
| Chegg / Course Hero | None — answer vending | Answers skip every stage. Our tutor refuses to hand over the answer. |
| Khan Academy / YouTube | Content, no sequencing | Content is not the bottleneck. Stage-correct sequencing across your actual subjects is. |
| Duolingo | Habit loop, single domain | We import its streak and squad mechanics into a multi-subject, for-credit course load. |

**The one-liner:** *"Every study app sells you one stage. We run all six — across every subject you're taking — and tell you which one each topic needs today."*

---

## 5. The Magic Moment (Aha)

A student drops syllabi for three courses. Within 60 seconds they see every topic across all three laid out on a **stage map**, most of them still unprimed, with today's queue already built:

> **Prime** Partial Derivatives — 6 min. Calc lecture is tomorrow.
> **Encode** SN2 mechanisms — 18 min. Covered last week, never processed.
> **Retrieve** Kinematics — 12 min. Due today, 4th review.
> **Then one mixed set** across all three subjects.
>
> *Forecast if you hold this pace: Calc B+ · O-Chem C+ · Physics A−*

The aha is not "the AI knows my syllabus." It is **"something finally knows what each of my thirty topics actually needs today, and it's not what I would have picked."**

Everything we build either shortens time-to-that-moment (< 5 min from signup) or deepens the loop after it.

---

## 6. The Core Loop

```
Syllabus (per subject) → topics extracted → each topic gets a PERIR-O stage
        ↓
Daily planner ranks every eligible stage-action across ALL subjects
        ↓
Student runs a stage-correct session (Prime / Encode / Reference /
Retrieve / Interleave / Overlearn)
        ↓
Stage advances (gated) + BKT mastery updates + forecast recomputes
        ↓
Stage map fills in → verified grade receipt → shared
```

The forecast schedules; **PERIR-O teaches**. Grade leverage picks *what* to work on, stage state decides *how* it gets worked on. Neither is useful without the other.

---

## 7. North Star & Key Metrics

**North Star Metric:** **Weekly Verified Lift (WVL)** — students per week whose *actual* entered grade lands at-or-above the forecast made ≥2 weeks prior. Unchanged, and still the only metric engagement theater can't game.

**Primary supporting metric (new):** **Stage-Correct Session Rate** — the share of completed study sessions that ran the stage the planner prescribed, rather than a student-chosen shortcut. If this falls, the method isn't landing and the product is just another practice app.

| Tier | Metric | MVP target | 12-mo target |
|---|---|---|---|
| Method | Stage-correct session rate | 65% | 85% |
| Method | Topics cleared through Retrieval per active/week | 2 | 5 |
| Method | Priming completed before lecture (of primeable topics) | 30% | 60% |
| Method | Interleaved sets containing ≥2 subjects | 70% | 90% |
| Outcome | Forecast accuracy (±0.5 grade) | 70% | 85% |
| Habit | D30 retention | 15% | 30% |
| Habit | Study days/week among actives | 3 | 4.5 |
| Growth | K-factor | 0.15 | 0.4 |
| Money | Free → paid conversion | 3% | 8% |

---

## 8. Moats

1. **Stage-state graph.** Per-student, per-topic stage history across a multi-year course load. That's a longitudinal record of *how* someone learns, not just what they scored. No generic LLM can reconstruct it.
2. **Syllabus graph.** Every ingested syllabus enriches a global university → course → topic → concept map. After 1,000 syllabi, onboarding at that school is one click, and new students inherit stage-sequencing priors from peers.
3. **BKT mastery profiles** (already built). The mastery posterior is what makes stage gates trustworthy instead of arbitrary.
4. **Method as brand.** If students learn to say "I haven't encoded that yet," the vocabulary itself is a moat — the same way "spaced repetition" made Anki a category.
5. **Receipts & proof-of-work.** Public shareable outcome receipts double as viral proof artifacts.

---

## 9. Product Principles (tie-breakers for every decision)

1. **Stage-correct or don't ship it.** A feature that lets a student drill an unencoded topic is a bug, not a shortcut.
2. **Outcome over engagement.** If a feature raises time-in-app but not WVL or stage-correct sessions, ship it dark or kill it.
3. **Overlearning is a polish stage.** It stays gated by default. Unlocking it early is the exact failure mode the method exists to fix.
4. **Every subject, every day.** The planner reasons across the whole course load. Single-subject tunnel vision is how students got here.
5. **Syllabus-grounded or it doesn't ship.** Generic AI answers are the competitor's product.
6. **5-minute magic.** Any onboarding step that delays the first stage map is a bug.
7. **Explain the stage, always.** Every prescribed action states which stage it is and why that stage now. The student should be able to run PERIR-O without us within a semester — and stay anyway, because doing it manually across six subjects is miserable.

---

## 10. Monetization Strategy

| Tier | Price | Includes |
|---|---|---|
| **Free** | $0 | 1 subject, full six-stage loop on that subject, 10 AI messages/day |
| **Pro** | $12/mo (₹399/mo) | Unlimited subjects, cross-subject interleaving, overlearning sprints, voice sessions, exam simulators, forecast history, receipts |
| **Squad** | $9/mo/seat (3+) | Pro + squad interleaved challenges, shared stage leaderboards |
| **Believer/Annual** | $99/yr | Pro, locked price, founding-member badge |

**The paywall is the method, not the volume.** Free proves the loop works on one subject; the entire reason to pay is that PERIR-O only pays off across a full course load — interleaving is definitionally multi-subject.

**Architecture notes (already in code):** Dodo Payments live behind the `PaymentProvider` facade in `usePayment.ts`, Razorpay/PayPal retained. AI metering exists (`curve_ai_metering`) — enforce free caps from day one. Referral loop via `dub` links (already a dependency).

**Growth loops, in priority order:**
1. **Method loop** — PERIR-O explainer content; the framework's critique of overlearning misuse is itself the hook.
2. **Stage-map loop** — screenshot-worthy artifact during finals; "my whole semester in one grid."
3. **Receipt loop** — verified-grade receipt at term end → share → friends sign up.
4. **Squad loop** — interleaved challenges need 3 members.
5. **Emergency loop** — 72-hour pre-exam sprint sold à la carte ($9), which is a legitimate, correctly-gated overlearning product.

---

## 11. Risks & Honest Weaknesses

| Risk | Mitigation |
|---|---|
| **Students resent being told they can't drill yet.** This is the single biggest adoption risk. | Never hard-block. Show the gate, explain the cost in one line, offer the correct stage as one tap, and allow an explicit override that is logged (override rate is a product health metric). |
| **Six stages is too much UI.** Cognitive load in a product about cognitive load. | The student sees *actions*, never a stage-machine diagram. Stage names appear as one word per card. The stage map is a single screen, opt-in. |
| **Encoding is hard to verify.** Anyone can click "done". | Encoding requires a produced artifact (explanation, analogy, or concept link) scored by the existing Feynman/grader stack. No artifact, no stage advance. |
| **AI cost per stage session.** | Priming and Reference generation are cached per (course, topic) and shared across students in the same course. Retrieval and Interleaving use the deterministic adaptive selector, not an LLM per item. |
| **Cold start: a wall of unprimed topics feels like debt.** | Onboarding backfills stages from what the student says they've already covered, and the stage map opens showing only the current week. |
| **Scope creep against 50+ legacy pages.** | Legacy stays feature-flagged. All new work lands in `src/curve/` and the learner shell. |
| **Method is copyable.** | The framework is public; the stage-state graph, BKT gates, and syllabus graph are not. Execution across a full course load is the defensible part. |

---

## 12. What "Best Ever" Looks Like in 18 Months

- Students say "I haven't encoded that yet" as ordinary speech.
- A student in Lagos, Mumbai, and Austin opens the same stage map across their own six subjects.
- Published evidence: stage-sequenced students beat self-directed studiers on forecast accuracy and grade lift, with the methodology public.
- Finals week floods with stage-map and receipt screenshots.
- 100k WAU, 8% paid, forecast accuracy published quarterly like a credit-score methodology.

---

## 13. Visual Design

Design tokens (color, typography, spacing, components, motion) live in `docs/design.md`, generated by the Design System skill from image references. The shipped direction is neo-brutalist, high-contrast, bold-bordered — "command center, not classroom." The stage map is the one screen worth bespoke design attention; `docs/dashboard_design.html` and `docs/focus_mode_design.html` are the current references. Run the Design System skill before the stage-map build lands.
