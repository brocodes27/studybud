# ElevenFolks — Master Plan (Start Here)

**Date:** 2026-08-12 (v2 — PERIR-O adoption) · **Status line:** Phase 0 COMPLETE · **Phase 1 code-complete**, P2.1–P2.2 shipped — four of six stages live end to end (91 tests green, build green, migrations + functions deployed to production). Remaining gate is a real beta, not more code

> **Mission:** Build the best B2C edtech product in the world — the AI Study OS that knows every syllabus a student carries, forecasts the grade, and runs every topic through the six stages of durable learning until the forecast comes true.

---

## The Plan at a Glance

| Doc | Purpose |
|---|---|
| [`docs/VISION.md`](./VISION.md) | Founder intake — the source of truth the three docs below are generated from |
| [`docs/product-vision.md`](./product-vision.md) | Strategy: who we serve, why we win, north star, moats, monetization |
| [`docs/prd.md`](./prd.md) | Engineering spec: stage machine, gates, planner, sessions, data model |
| [`docs/product-roadmap.md`](./product-roadmap.md) | Build queue: Phase 0–6 with checkboxes and exit criteria |

## The Bet (30 seconds)

Students carrying 4–6 subjects don't fail from laziness — they do the right activities in the wrong order. They grind practice questions (Overlearning) on topics they never primed or encoded, so the effort leaks. Every tool on the market sells one stage and calls it studying.

ElevenFolks owns the whole sequence:

```
Syllabi (N subjects) → topics staged → planner ranks stage-actions across ALL subjects
  → stage-correct session (Prime/Encode/Reference/Retrieve/Interleave/Overlearn)
  → gate clears → mastery updates → forecast moves → stage map fills → receipt → share
```

**Division of labour:** the grade forecast decides *what* to study; the PERIR-O stage machine decides *how*.

**North Star:** Weekly Verified Lift — students whose actual grade lands at-or-above our forecast.
**Primary supporting metric:** Stage-Correct Session Rate — if students don't run the prescribed stage, we're just another practice app.

## What We Already Have (Unfair Advantages)

- **Curve**: syllabus → forecast product live at app root (`src/curve/`), 33 grade-engine tests green
- **BKT mastery engine**: `knowledgeTracing.ts` + `knowledge-trace` edge function — what makes stage gates trustworthy rather than arbitrary
- **Adaptive item selection**: `adaptive-difficulty` edge function, extended for multi-topic interleaved sets
- **ATLAS AI tutor**: chat + voice (Vapi), grounded in ingested syllabus material
- **Practice + grading**: `PracticeTestEngine`, `FeynmanBoard`, `FlashcardGenerator`, `grader-agent/`
- **Payments & receipts**: Dodo live behind the `PaymentProvider` facade; PublicReceipt, squads, gamification

Almost nobody building study apps has both a mastery engine and a grade model wired to a real syllabus. PERIR-O is the layer that makes them mean something pedagogically.

## The Sequence

| Phase | Weeks | One-liner | Gate to advance |
|---|---|---|---|
| 0 — Foundation | 0–1 ✅ | Green build, legacy flagged off, decisions locked | Complete |
| 1 — Stage Machine & Magic Moment | 1–4 | Topic spine, gates, planner, Priming + Encoding, stage map | 20-student beta, stage-correct rate ≥ 55% |
| 2 — Full Six Stages | 5–8 | Reference, Retrieval, spaced schedule, Interleaving, gated Overlearning | ≥3 stage sessions/active/week |
| 3 — Depth & Calibration | 9–11 | Decay, remediation, constant recalibration, simulator factory, SYOW | Remediation < 15% of topics |
| 4 — Habit & Social | 12–15 | Streaks on stage-correct sessions, squads, interleaved challenges | D30 ≥ 15% |
| 5 — Growth & Money | 16–19 | Stage-map shares, receipts, pricing, referrals | Free→paid ≥ 3%, K ≥ 0.15 |
| 6 — Scale & Polish | 20+ | Network effects, accuracy report, exam ladders | per-quarter review |

## Kill-Switch Principles (tie-breakers)

1. **Stage-correct or don't ship it** — letting a student drill an unencoded topic is a bug, not a shortcut
2. Outcome > engagement (WVL decides)
3. **Overlearning stays gated** — it is a polish stage; unlocking it early is the exact failure the method exists to fix
4. Every subject, every day — the planner reasons across the whole course load
5. Syllabus-grounded or don't ship
6. 5-minute magic onboarding, always
7. B2C first; school/teacher features frozen (flagged, not deleted)

## Immediate Next Step

**Phase 2 — the remaining four stages.** Phase 1 is code-complete: a student can drop syllabi, see every topic on the stage map, get a stage-correct queue across all subjects, and run Priming and Encoding with real gates. Reference and Retrieval (P2.1, P2.2) come first — Retrieval is what makes the spaced schedule and the BKT-backed gates start doing real work, and nothing downstream of it can be exercised until it exists.

Phase 1's exit criterion is a 20-student beta, not more code. Worth running the migrations and putting it in front of real students before building Phase 2 on top of untested assumptions.

---

*This plan supersedes v1 (2026-08-04) and the scattered priorities in older summary docs (CBSE_*, IMPLEMENTATION_*, etc.). Those remain as implementation history; this folder is the single source of truth.*
