# StudyBud / elevenfolks — Codebase Explained

Generated: 2026-01-16

This document explains what this repository contains, what each folder/file does, what features exist, and how the system works end-to-end.

---

## 1) One‑sentence summary
A Vite + React web app (PWA) and an Expo/React‑Native mobile app that use a Supabase backend (Auth + Postgres + Storage + Realtime + Edge Functions) to deliver AI-powered study planning, practice/testing, flashcards, exam simulators (CBSE + CUET), teacher classroom tools, meeting notes capture, and video/voice lesson generation.

---

## 2) High level architecture

### 2.1 Components
- Web frontend (Vite + React)
  - Source: `src/`
  - Built as a PWA (service worker + caching)
- Supabase backend
  - Database schema + RLS policies: `supabase/migrations/`
  - Edge Functions (serverless APIs): `supabase/functions/`
  - Storage buckets used in code: `assignments`, `videos` (and likely others)
- Data/ops scripts (Node/TS + some Python)
  - Source: `scripts/`
  - Used for ingestion (PYQs / CUET data), embeddings, and the Manim video pipeline
- Mobile app (Expo Router)
  - Source: `studybud-mobile/`

### 2.2 Primary data flow
1) User signs in via Supabase Auth.
2) Frontend reads/writes rows from Postgres (Supabase JS client) for “normal” CRUD.
3) For AI / payments / content generation, frontend calls Supabase Edge Functions.
4) Edge Functions verify the Supabase JWT (when required), then call external providers (OpenAI, Tavily, Razorpay, PayPal, etc.), then store results back into Supabase tables and/or Storage.

---

## 3) Repository map (what folders do)

### Root files
- `package.json` — Web app dependencies + scripts.
  - `npm run dev` runs the web app via Vite.
  - `npm run generate-video` runs `scripts/generate-manim-video.ts`.
  - `npm run serve-gen` runs `scripts/server.ts`.
- `vite.config.ts` — Vite config + PWA configuration + dev server headers.
- `netlify.toml` — Netlify deployment configuration.
- `Dockerfile` / `docker-compose.yml` — Containerization (primarily for hosting/building; Supabase itself is usually separate).
- `public/` — Static assets, including the pdf.js worker.
- `pyq-pdfs/` / `pyq-extracted/` — Data and outputs of the PYQ extraction workflow.
- `cuet_all_mcqs_text*.json` — CUET question datasets used by ingestion scripts.
- `manim_engine/` — Python “engine” used by the video generation pipeline.

### `src/` (Web app)
- `src/main.tsx` — React entrypoint; mounts the app and configures Google OAuth provider.
- `src/App.tsx` — Router + auth gating + premium gating + global UI.
- `src/pages/` — Route-level pages.
- `src/components/` — UI components and feature widgets.
- `src/contexts/` — React contexts (notably auth state).
- `src/hooks/` — React hooks (payments, offline storage, notifications, toast).
- `src/lib/` — Integrations and service wrappers (Supabase client, OpenAI proxy wrapper, curriculum API, voice/video services).

### `supabase/` (Backend)
- `supabase/migrations/` — SQL migrations that create tables, RLS policies, triggers, RPCs.
- `supabase/functions/` — Supabase Edge Functions; these are the backend “API” endpoints called by the app.

### `scripts/` (Ingestion + generation tooling)
- `scripts/README.md` — Documentation of the PYQ extraction and import pipeline.
- Various scripts for:
  - Extracting questions from PDFs
  - Importing reviewed JSON
  - Populating question banks
  - Generating embeddings
  - Running the Manim video generation pipeline

### `studybud-mobile/` (Mobile app)
- Expo + Expo Router app, connecting to the same Supabase backend.

---

## 4) Web app runtime (exact boot and gating)

### 4.1 Boot sequence
- `src/main.tsx`
  - Creates root and renders `<App />`.
  - Wraps app with `GoogleOAuthProvider` using `VITE_GOOGLE_CLIENT_ID`.
  - Imports `./sw-update`.

### 4.2 Router + global logic
- `src/App.tsx`
  - Declares routes like:
    - `/create` (study plan creation)
    - `/plans` (study plans)
    - `/study/:planId` (study session)
    - `/cbse-simulator`, `/cbse-exam-session`
    - `/cuet-simulator`
    - `/teacher/...` teacher portal routes
  - Wraps everything in `AuthProvider`.
  - Registers `/sw.js`.
  - Implements “trial expired => paywall” UI.

### 4.3 Auth context
- `src/contexts/AuthContext.tsx`
  - Pulls current session via `supabase.auth.getSession()`.
  - Listens to `supabase.auth.onAuthStateChange`.
  - Loads role/admin/full_name from `public.user_profiles`.
  - Determines premium status using:
    - `public.subscriptions` (status = active)
    - `public.premium_email_extensions` (domain allowlist)

### 4.4 Supabase client
- `src/lib/supabase.ts`
  - `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`.

---

## 5) PWA + offline support

### 5.1 PWA
- `vite.config.ts`
  - Uses `vite-plugin-pwa`.
  - Registers `autoUpdate`.
  - Workbox caching includes a `runtimeCaching` rule for `api.supabase.co`.

### 5.2 Auto-refresh on updates
- `src/sw-update.ts`
  - Reloads the page when a new SW is installed.

### 5.3 Offline storage helper
- `src/hooks/useOfflineStorage.ts`
  - Uses IndexedDB (`idb`) to store:
    - flashcards
    - studySessions
    - settings
  - Exposes `getUnsyncedData()` and `markAsSynced()`.
  - Note: this repo currently exposes offline storage utilities; a full automatic sync worker is not obvious from the scanned files.

---

## 6) Features inventory (web)

This section lists user-visible features and their implementation wiring.

### 6.1 Study plan generation (AI)
- UI:
  - `src/pages/CreatePlan.tsx`
  - Calls `POST {SUPABASE_URL}/functions/v1/generate-study-plan` with the user session access token.
- Backend:
  - `supabase/functions/generate-study-plan/index.ts`
    - Verifies Supabase JWT by calling `{SUPABASE_URL}/auth/v1/user`.
    - Checks premium/free tier limits.
    - Calls OpenAI (model `gpt-4o`) to generate a structured plan JSON.
    - Stores into `public.exam_plans`.
  - Premium helper:
    - `supabase/functions/generate-study-plan/_utils_subscription.ts`.

### 6.2 Study plans management
- UI:
  - `src/pages/StudyPlans.tsx`
- Data:
  - `public.exam_plans` (read, update, delete)
- Key behaviors:
  - Subscribes to Postgres realtime for `exam_plans` changes.
  - Deleting a plan unlinks dependent resources:
    - Updates `flashcards.plan_id = null`
    - Updates `practice_tests.plan_id = null`
    - Attempts to delete dependent attempt records (`practice_test_attempts`) for tests that belonged to the plan.

### 6.3 Practice tests (AI + attempts)
- UI:
  - `src/components/PracticeTestEngine.tsx`
- Backend:
  - Calls `POST /functions/v1/generate-practice-test` to create a new test.
- Data:
  - `public.practice_tests` stores generated tests.
  - `public.practice_test_attempts` stores attempt results and answers.

### 6.4 Flashcards
- UI:
  - `src/components/FlashcardGenerator.tsx`
  - `src/components/QuestionGenerator.tsx` (notes/PDF -> questions -> save as flashcards)
- Backend:
  - Uses `supabase.functions.invoke('generate-flashcards')` in some flows (AI buddy).
- Data:
  - `public.flashcards`

### 6.5 AI Study Buddy (“Ranjan Sir”)
- UI:
  - `src/components/AIStudyBuddy.tsx`
- Behavior:
  - Implements a chat + skill flows (create plan, flashcards, reschedule, progress panel).
- AI calls:
  - Uses `src/lib/openaiService.ts`.

### 6.6 OpenAI proxy (server-side key protection)
- Client wrapper:
  - `src/lib/openaiService.ts` posts to `/functions/v1/openai-proxy`.
- Edge Function:
  - `supabase/functions/openai-proxy/index.ts`
  - Verifies Supabase JWT then forwards the request to OpenAI using server env `OPENAI_API_KEY`.

### 6.7 Meeting notes (speech-to-text + screenshots)
- UI:
  - `src/components/LiveMeetingNotes.tsx`
- Behaviors:
  - SpeechRecognition live transcription.
  - Screen sharing capture and screenshot gallery.
  - Saves notes + screenshots array into `public.meeting_notes`.
  - Can format notes via `POST /functions/v1/format-notes-with-ai`.

### 6.8 Notifications (browser)
- UI helper:
  - `src/hooks/useNotifications.ts`
- Supports:
  - Request permission
  - Show notifications
  - Schedule study reminders (via timeouts)
  - Schedule exam reminders

### 6.9 Payments & premium
- Client:
  - `src/hooks/usePayment.ts`
  - Detects location via `https://ipapi.co/json/`.
  - Calls Edge Functions:
    - `/functions/v1/create-razorpay-subscription`
    - `/functions/v1/create-paypal-subscription`
- Edge Functions:
  - `supabase/functions/create-razorpay-subscription/index.ts`
  - `supabase/functions/create-paypal-subscription/index.ts`
- Premium check in web app:
  - `src/contexts/AuthContext.tsx` checks `subscriptions` and `premium_email_extensions`.

### 6.10 CUET simulator (sectioned exam attempts)
- UI:
  - `src/pages/CUETSimulator.tsx`
- Concept:
  - User selects 3–6 subjects. Exam is sectioned: each subject gets its own timed section.
- Data:
  - `public.cuet_attempts` stores the overall attempt and a JSON `config` describing sections, qids, status.
  - `public.cuet_attempt_answers` stores per-question selections.
  - `cuet_questions` / `cuet_options` store the CUET question bank (these tables are referenced in code; migrations for them are not present in the scanned set, so they may be created elsewhere or pre-existing).
- How questions are sourced:
  1) Try DB (`cuet_questions` + `cuet_options`) for the current subject.
  2) If insufficient questions exist:
     - Generate via GPT (`OpenAIService`, with a CUET blueprint and optional RAG context)
     - Fall back to web search via Edge Function `cuet-web-search`.
     - For English, a final local fallback generator ensures the section can reach 50 items.
- Web-search Edge Function:
  - `supabase/functions/cuet-web-search/index.ts`
  - Uses Tavily + OpenAI to normalize web results into strict JSON questions.
- Optional CUET syllabus fetch:
  - `supabase/functions/cuet-syllabus-fetch/index.ts`
  - Populates `public.cuet_syllabi` (see migrations).

### 6.11 Teacher portal (classes, assignments, AI mock tests)
- UI:
  - `src/pages/TeacherPortal.tsx` (router shell)
  - `src/pages/TeacherPanel.tsx` and `src/pages/TeacherClassDashboard.tsx`
- Data:
  - `classes`, `class_members`, `assignments`, `announcements`, `notifications`.
  - Storage bucket `assignments` is used for uploads.
- AI features:
  - Generates daily mock tests via `supabase.functions.invoke('teacher-generate-mock')`.
  - Creates an assignment and posts notifications to class members.

### 6.12 Curriculum scheduling
- Client API wrappers:
  - `src/lib/curriculumApi.ts` calls Edge Functions:
    - `generate-monthly-curriculum`
    - `reschedule-week`
    - `apply-exam-to-curriculum`
- Data:
  - `curriculum_plans`, `monthly_curricula`, `curriculum_tasks`, `plan_tasks`, `task_completions` etc. (from migrations).

### 6.13 Video generation (Manim)
This project includes a full “generate a video lesson” pipeline.

- Server:
  - `scripts/server.ts` exposes an HTTP endpoint.
  - Creates a `video_generations` DB row and spawns the worker.
- Worker:
  - `scripts/generate-manim-video.ts` orchestrates generation:
    - calls Python scripts in `manim_engine/`
    - renders a silent video
    - generates narration + subtitle alignment
    - merges audio/video with ffmpeg
    - uploads output into Supabase Storage bucket `videos`
    - updates progress in `video_generations`
- Python engine:
  - `manim_engine/` (renderer, generator, audio/subtitle utilities)

---

## 7) Supabase database (what tables exist)

The migrations in `supabase/migrations/` define core tables and RLS policies.

Examples you definitely have in migrations:
- `user_profiles` (roles, admin flags, etc.)
- `meeting_notes`
- `chat_history`
- `notifications`
- `classes`, `class_members`, `assignments`, `announcements`
- `video_generations` (and realtime publication)
- `voice_lectures`, `lessons`, `user_progress`, `ai_tutor_personalities`, `user_voice_preferences`
- `cbse_syllabi`
- `cuet_attempts`, `cuet_attempt_answers`
- `cuet_syllabi`
- `exam_plans`
- `curriculum_*` tables
- `plan_tasks`, `task_completions`, `attendance_events`

Tables referenced by the frontend but not confirmed by the scanned migration set include (likely exist in the remote DB or older migrations):
- `flashcards`
- `practice_tests`, `practice_test_attempts`
- `question_bank`
- `cuet_questions`, `cuet_options`
- vector search RPCs like `match_questions`, `match_cuet_questions`

---

## 8) Supabase Edge Functions (API surface)

Edge Functions are in `supabase/functions/` and are called from the web app in two ways:
- `fetch(`${SUPABASE_URL}/functions/v1/<function>`, ...)`
- `supabase.functions.invoke('<function>', { body })`

Functions observed from code scans include:
- AI planning/testing/content:
  - `generate-study-plan`
  - `generate-practice-test`
  - `generate-flashcards`
  - `format-notes-with-ai`
  - `generate-questions-from-notes`
  - `openai-proxy`
  - `openai-embeddings-proxy` (folder present)
- CUET tools:
  - `cuet-web-search`
  - `cuet-syllabus-fetch`
- Teacher tools:
  - `teacher-generate-mock`
  - `teacher-ai-insights`
- Curriculum tools:
  - `generate-monthly-curriculum`
  - `reschedule-week`
  - `apply-exam-to-curriculum`
- Payments:
  - `create-razorpay-subscription`
  - `razorpay-webhook`
  - `create-paypal-subscription`
  - `paypal-webhook`

---

## 9) Tooling scripts (data ingestion and admin operations)

See `scripts/README.md` for the canonical flow. Highlights:
- PYQ extraction workflow:
  - Extract: `scripts/extract-pyq-from-pdf.ts` -> writes JSON under `pyq-extracted/`
  - Review/edit JSON manually
  - Import: `scripts/import-pyq-json.ts` -> inserts into DB
- Question bank operations:
  - Populate pool via Edge Function: `scripts/populate-question-bank.ts`
  - Generate embeddings: `scripts/generate-embeddings.ts`
- Manim video pipeline:
  - `scripts/server.ts` + `scripts/generate-manim-video.ts` + `manim_engine/`

---

## 10) Mobile app (Expo)

- Location: `studybud-mobile/`
- Tech:
  - Expo
  - Expo Router
  - Supabase
- Structure:
  - `studybud-mobile/app/` includes routes/screens.
- Feature coverage:
  - Auth
  - Study plans (browse + create)
  - Profile

---

## 11) Environment variables (what you need)

### Web (Vite)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GOOGLE_CLIENT_ID`
- Some features also reference:
  - `VITE_OPENAI_API_KEY` (note: some client code still uses it directly for embeddings/TTS; you may want to standardize this via server proxies).

### Supabase Edge Functions (server-side)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `TAVILY_API_KEY` (for CUET web search + syllabus fetch)
- Payments:
  - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
  - `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_BASE_URL`, `FRONTEND_URL`

### Mobile (Expo)
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

---

## 12) End-to-end “click flows” (how it works from a user perspective)

### Flow A: Create a study plan
1) User signs in.
2) User goes to Create Plan page.
3) Frontend calls `generate-study-plan` Edge Function.
4) Function verifies JWT, checks premium/free tier, calls OpenAI, stores plan.
5) User sees the plan and can use it to generate flashcards/tests.

### Flow B: Generate and take a practice test
1) User opens Practice Test tool.
2) Frontend calls `generate-practice-test` Edge Function with plan details.
3) New test saved in `practice_tests`.
4) User starts timed attempt.
5) Attempt saved in `practice_test_attempts`.

### Flow C: CUET sectioned simulator
1) User selects 3–6 domains and starts.
2) Frontend inserts row in `cuet_attempts` with config describing sections.
3) When user starts a section:
   - Load from DB question bank; if insufficient, use GPT + Tavily web search.
   - Persist selected question IDs back into attempt config.
4) User answers: selections stored per question in `cuet_attempt_answers`.
5) Section completion updates config, then moves to next section.

### Flow D: Teacher daily mock test
1) Teacher opens class dashboard.
2) Teacher enters “topics taught today” and clicks generate.
3) Calls Edge Function `teacher-generate-mock`.
4) Saves JSON to Storage (`assignments` bucket) and creates an `assignments` row.
5) Inserts `notifications` for class members.

---

## 13) Known gaps / things to verify
These are not “errors”, just places where the scanned repo doesn’t show the full story:
- Some tables referenced in frontend (e.g., `flashcards`, `practice_tests`, `cuet_questions`) do not appear in the visible migration set. They likely exist in the Supabase project already or are created by older migrations not present here.
- Some AI calls happen via Edge Functions (good) while a few utilities still use client-side keys (e.g., embeddings/TTS in `src/lib/openaiService.ts`). If you want a single security model, you can route all OpenAI calls through Edge Functions.

---

## 14) Quick “where do I edit X?” index
- Add/remove routes: `src/App.tsx`
- Auth logic / premium checks: `src/contexts/AuthContext.tsx`
- Supabase client: `src/lib/supabase.ts`
- Payments: `src/hooks/usePayment.ts` + `supabase/functions/create-*/index.ts`
- Study plan generation: `src/pages/CreatePlan.tsx` + `supabase/functions/generate-study-plan/index.ts`
- CUET simulator: `src/pages/CUETSimulator.tsx` + `supabase/functions/cuet-web-search/index.ts`
- Teacher dashboard: `src/pages/TeacherClassDashboard.tsx`
- PWA behavior: `vite.config.ts` + `src/sw-update.ts`
- PYQ tools: `scripts/README.md` + `scripts/*.ts`

---

If you want, I can also generate a diagram-only version (Mermaid graphs) mapping:
- routes -> components -> tables -> edge functions
- edge functions -> external providers -> tables/storage
