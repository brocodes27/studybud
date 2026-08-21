# Vision — ElevenFolks

> Captured by the Product Planner skill. This file is the source of truth for
> generating product-vision.md, prd.md, and product-roadmap.md. Edit it directly
> and re-run the Product Planner to regenerate downstream documents.

**Created:** 2026-08-12
**Updated:** 2026-08-12

## Founder

- **Name:** Aryan Singh
- **Expertise:** Founder-engineer building AI education products. Has already shipped the full ElevenFolks stack solo: syllabus parsing, a deterministic grade-forecast engine, a Bayesian Knowledge Tracing mastery model, voice + chat AI tutoring, exam simulators, and a payments/receipts layer.
- **Background:** Built ElevenFolks as an AI Study OS that forecasts a student's grade and tells them the highest-leverage thing to do today. The forecast side works — it answers *what* to study. The gap is *how*: students still open the app and grind practice questions from a cold start, which is the single most common and least effective study behavior. Adopting the PERIR-O framework (Priming, Encoding, Reference, Retrieval, Interleaving, Overlearning) turns the app from a scheduler into a method — it now prescribes the correct cognitive stage for every topic, in every subject, every day.

## Purpose

- **Who you help:** College and competitive-exam students carrying 4–6 subjects at once, who study hard but unsystematically — re-reading notes, highlighting, and drilling questions on material they never properly encoded.
- **Problem you solve:** Students do the right activities in the wrong order. They jump straight to high-volume practice (Overlearning) on topics they have not primed or encoded, so the effort leaks: information never consolidates, nothing transfers to exam conditions, and no tool tells them which stage a given topic actually needs. Multiply that by five subjects and thirty topics and the student has no idea where anything stands.
- **Desired transformation:** Before — a student opens five textbooks, picks whichever subject feels most urgent, and grinds problems until they're tired, with no way to know if it worked. After — the student opens ElevenFolks and gets a stage-correct queue: a 6-minute primer before tomorrow's Calc lecture, an encoding session on last week's O-Chem mechanism, a retrieval drill on Physics due today, and one interleaved mixed set spanning three subjects. Every topic has a visible stage; every study minute is spent on the stage that topic actually needs.
- **Why you:** The hard, unglamorous infrastructure PERIR-O needs already exists in this codebase — syllabus ingestion with per-week topics, a per-concept BKT mastery model, an adaptive item selector, a grounded AI tutor, a grade-weight model, and an exam simulator. Almost nobody building study apps has both a mastery engine and a grade model wired to a real syllabus. PERIR-O is the layer that finally makes them mean something pedagogically.

## Product

- **Name:** ElevenFolks
- **One-liner:** ElevenFolks reads your syllabus, forecasts your grade, and then runs every topic in every subject through the six stages of durable learning — Priming, Encoding, Reference, Retrieval, Interleaving, Overlearning — so you always know exactly what to do next and why.
- **How it works:** A student drops syllabi for all their subjects. Each syllabus is parsed into weekly topics mapped to knowledge components, and the grade engine produces a forecast per course. Every topic then gets its own PERIR-O stage state. Each day the planner scans every topic across every subject, works out which stage each one is due for, and ranks the candidate actions by grade leverage — expected forecast gain per minute — with hard overrides for topics whose lecture is imminent (Priming) and topics whose spaced-retrieval date has come due. The student sees at most three primary actions plus one interleaved mixed set that deliberately mixes subjects. Completing an action advances the topic's stage, updates BKT mastery, and moves the forecast.
- **Key capabilities:**
  - Six-stage PERIR-O engine with explicit advance gates per topic, so no topic can be drilled before it has been primed and encoded
  - Multi-subject stage-aware daily planner that ranks actions across all enrolled courses by grade leverage per minute
  - Stage-specific AI sessions: primers before lecture, Feynman-style encoding, auto-generated reference cards, closed-book retrieval, cross-subject interleaved sets, and gated overlearning sprints
  - Per-topic and per-subject stage map showing exactly where every topic stands across a full course load
  - Grade forecast that recomputes from real BKT mastery as topics advance through stages
- **Platform:** web
- **Market differentiation:** Every competitor sells one stage and calls it studying. Anki and Quizlet are Retrieval only. ChatGPT is unstructured Encoding. Chegg is answer vending. Notion is Reference with no method. None of them know what stage a topic is in, none of them sequence stages correctly, and none of them can tell a student that grinding problems on a topic they never encoded is wasted effort. ElevenFolks owns the whole sequence, across every subject at once, tied to an actual grade forecast.
- **Magic moment:** A student drops three syllabi and within 60 seconds sees every topic across all three subjects laid out on a stage map — most of them still unprimed — with today's queue already built: *"Prime Partial Derivatives (6 min) — Calc lecture is tomorrow. Encode SN2 mechanisms (18 min) — covered last week, never processed. Retrieve Kinematics (12 min) — due today, 4th review. Then one mixed set across all three."*

## Audience

- **Primary user:** A first- or second-year undergraduate carrying 4–6 courses, 17–24, STEM-heavy, GPA-anxious, time-poor, phone-first. Studies most nights but has no system: opens whatever is most on fire, re-reads notes, does practice sets, and cannot tell which subjects are actually safe. Already pays for Spotify Student and Notion without hesitating.
- **Secondary users:**
  - Competitive-exam aspirants (JEE, NEET, CUET, SAT, MCAT) running multi-subject syllabi for a year or more, where interleaving and gated overlearning matter most
  - Parents who fund the subscription and want proof-of-work receipts showing real stage progress, not screen time
  - Study-squad peers who share interleaved challenge sets and stage leaderboards
- **Current alternatives:** Anki and Quizlet for retrieval; ChatGPT for explanations; Notion and Obsidian for notes; Chegg and Course Hero for answers; YouTube for lectures; paper planners or nothing at all for sequencing. Students stitch four or five of these together manually.
- **Frustrations:** None of the tools talk to each other, so nothing knows what the student has already done. Nothing tells a student *when* a topic is ready for testing versus when it still needs encoding. Spaced-repetition apps schedule cards but ignore whether the underlying concept was ever understood. Multi-subject load is entirely the student's problem to juggle. And every tool optimizes for volume of activity, which is exactly the trap PERIR-O warns about — overlearning used as a first step rather than a final polish.

## Business

- **Revenue model:** freemium
- **90-day goal:** PERIR-O engine live end to end across at least three subjects per student for a 50-student beta; ≥60% of active students have at least one topic that has cleared Retrieval; median student runs stage-correct sessions on ≥3 days/week; first paying cohort on the Pro tier.
- **6-month vision:** Stage map is the product's signature screen. 5,000+ weekly active students carrying full course loads, published evidence that stage-sequenced students beat self-directed studiers on forecast accuracy and grade lift, and a paid conversion rate above 5% driven by the interleaving and overlearning tiers.
- **Constraints:** Solo founder-engineer with an existing large codebase carrying 50+ legacy pages that must stay behind feature flags rather than be deleted. AI cost per student must stay under ~12% of ARPU, so stage sessions must lean on deterministic scheduling and cached generation rather than an LLM call per interaction. Existing surfaces (BKT engine, adaptive difficulty, practice engine, Feynman board, flashcard generator) must be reused, not rebuilt.
- **Go-to-market:** Lead with the method, not the app — PERIR-O explainer content on YouTube/TikTok/Reddit study communities, where the framework's critique of how students misuse overlearning is itself the hook. Free tier covers one subject fully so the stage map is felt immediately; paid unlocks multi-subject interleaving, overlearning sprints, and unlimited AI sessions. Receipts and stage-map screenshots drive organic sharing during finals.

## Brand Voice

- **Personality:** The coach who has read the research and refuses to let you waste effort. Direct, structured, slightly blunt about bad study habits, never condescending. Command center, not classroom.
- **Tone of voice:** Short, declarative, always explains the *why* in one clause. Names the stage out loud so the method becomes the student's own vocabulary. Example nudge: "Don't drill this yet — you've never encoded it. 15 minutes of encoding first, then the drills will stick." Example completion: "Kinematics cleared Retrieval. Next review in 7 days. Forecast moved B → B+." Example refusal: "Overlearning is locked for this topic. It's a polish stage, not a starting point."

> Visual identity (mood, anti-patterns, design tokens) is deliberately not
> captured here — it lives in docs/design.md, generated by the Design System
> skill from image references.

## Tech Stack

- **App type:** web
- **Frontend:** React 18 + Vite + TypeScript + Tailwind (already the shipped stack) — fast builds, PWA-ready via vite-plugin-pwa, and the existing neo-brutalist component library and Curve shell carry straight over
- **Backend:** Supabase Edge Functions (Deno) — the BKT `knowledge-trace`, `adaptive-difficulty`, `plan-daily-mission`, and `ai-proxy` functions already run here; stage transitions and planning belong alongside them, not in a new service
- **Database:** Supabase Postgres — `curve_courses`, `curve_enrollments`, `curve_course_topics`, `curve_forecasts`, `knowledge_components`, and `student_cognitive_profiles` already model the multi-subject topic graph; PERIR-O extends these tables rather than adding parallel ones
- **Auth:** Supabase Auth with Google OAuth — already shipped and wired to RLS policies on every table
- **Payments:** Dodo Payments as the live provider behind the existing `PaymentProvider` facade in `usePayment.ts`, with Razorpay (India) and PayPal retained as alternates — merchant-of-record coverage without building a billing abstraction
- **Analytics:** In-house on Supabase `closed_loop` tables — decision already locked (PRD §3); keeps stage-transition telemetry in the same database as the mastery and forecast data it must be joined against
- **Email:** Supabase Auth transactional email for now; add Resend when weekly stage-progress digests ship in the habit phase — no need for a second vendor before there is a recurring email to send
- **Error tracking:** Sentry — currently only a React `ErrorBoundary` exists, which cannot see edge-function failures in the stage-transition path where silent failures would corrupt a student's stage state

## Tooling

- **Coding agent:** Claude Code
