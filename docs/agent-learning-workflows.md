# Adaptive learning workspace and agent protocols

## Behavior

Study/doubt requests open a persisted assessment tab. The student chooses up to 15 library topics, available revision time and confidence in the form or chat. Chat saves the resolved scope before asking to start; a short confirmation such as “yes pls” starts the saved diagnostic. Starting confirms only selected topics, stored as `metadata.confirmed_topics`, while preserving the rest of the library. Defaults are 60 revision minutes (at least five per topic) and unsure confidence. Exam-tomorrow mode also captures the exam date. The server creates concept/application checks, one topic at a time, using teaching excerpts rather than testing the structure of a syllabus. If an upload only outlines the topic, it retrieves teaching snippets through the configured search provider. Answers retain verified quotes and real source links; external snippets are never labeled as pages of the upload. The server accepts completion only from saved, graded sessions. It allocates revision time from actual independent accuracy, putting weak topics first. The final plan is shown step by step and summarized in chat. Explanation and follow-up checks use the existing source-backed study tools.

Exam recovery accepts marks and pasted feedback, or imports searchable PDF/TXT/Markdown. The student reviews the extracted text before submission. The diagnostic informs the recovery plan; the report analysis must quote exact evidence from the report for each suggested correction. Scanned images do not currently have OCR in this intake.

Chat has an assistant-side typing indicator, Markdown rendering and durable tab actions. Context includes confirmed materials, enrolled course syllabus topics, study preferences, recent graded results and excerpts of the active source. A student in an independent check cannot switch activities or request explanations until submitting.

Daily research selects up to three unassessed or weak topics using completed independent checks. A service worker claims jobs atomically, retries failures at most three times per UTC day and saves cited briefs while the browser is closed. The dashboard fetches completed briefs on focus and every 30 seconds, preserving foreground work. Briefs appear in tabs with a “mark reviewed & continue” action. Closing a tab is persisted. Research is enabled by default and can be switched off in the dashboard.

## AG-UI

The frontend uses `@ag-ui/core` 1.0.2 to validate run inputs and SSE events. `workspace-agent` emits run lifecycle, tool-call, text, state and message events; final snapshots remain server-authoritative. Client state, history and tool definitions cannot replace saved context. Existing NDJSON clients remain supported. Tests validate emitted events against the official AG-UI schemas and check interrupted streams.

## A2A

Daily research supports a server-configured **A2A 1.0 JSON-RPC specialist**. Set `A2A_RESEARCH_CARD_URL` to the specialist's HTTPS Agent Card URL and optionally `A2A_RESEARCH_TOKEN` to its bearer token. Discovery selects a supported 1.0 JSONRPC interface, preserves its tenant, sends `SendMessage`, and polls `GetTask` for unfinished tasks. The client accepts completed task artifacts or direct messages. The hosted `research-specialist` function also provides an A2A 1.0 Agent Card and authenticated `SendMessage` endpoint, returning a direct cited research message. It uses the same Tavily/Meta research implementation as the built-in fallback.

The endpoint must share the configured card origin; redirects are rejected to prevent credential forwarding. Requests are bounded to 45 seconds and responses to 128 KB. Only course and topic names are sent, never student identity, chat, notes, marks or exam reports. Expected artifact data (a `data` part, or JSON in a `text` part):

```json
{"text":"A concise explanation with numbered citations [1], a supported worked example and a practice question.","sources":[{"title":"Source title","url":"https://example.org/lesson"}]}
```

The response must include 1–8 HTTPS sources without embedded URL credentials. Links are validated, but remote source claims still depend on the configured specialist. When A2A is absent or fails, research falls back to Tavily search and the existing Meta synthesis service if `TAVILY_API_KEY` is configured. Configure either provider, or both for fallback.

Protocol reference: [A2A 1.0 specification](https://a2a-protocol.org/v1.0.0/specification/).

## Deployment

The backend is deployed to Supabase project `yjdcshkqgzcubniinwoc`. Both workspace migrations are applied. Generated private keys are configured for the scheduler and hosted A2A specialist, with matching Vault configuration. Apply the workspace migration `20261010115436_agent_workspace.sql` if it is not already applied, then `20261014155410_workspace_exam_research.sql`. Do not mark historical migrations as applied without checking the target database.

Deployed `workspace-agent`, `workspace-voice-session` (uses shared workspace tools/context), `workspace-research`, `research-specialist` and `material-study`. The research function has JWT verification disabled in config and authenticates its cron caller with a dedicated secret.

Configure Edge Function secrets:

- Existing Meta credentials used by `_shared/meta.ts`.
- `WORKSPACE_RESEARCH_SECRET`: a newly generated private random secret.
- `TAVILY_API_KEY`, and/or `A2A_RESEARCH_CARD_URL` plus optional `A2A_RESEARCH_TOKEN`.

Configure Vault entries `project_url` (the project's base HTTPS URL) and `workspace_research_secret` (the same private research secret). The migration schedules `workspace-daily-research` once a minute. With missing Vault entries it makes no HTTP call. The worker processes up to three users per invocation with row locking; a healthy 100-user queue drains in roughly 34 minutes, subject to provider limits and failures. This is scheduled personalized research, not 100 parallel live research requests.

Deploy the frontend only after the migrations and functions, since loading workspace snapshots now reads research settings. Verify production with an authenticated student: create and finish an assessment, reload its saved plan/chat, submit exam feedback, check source citations, and confirm a completed research job becomes tabs after returning. Verify another student's research/session records are inaccessible. Turn off daily research and confirm no new jobs are claimed.

## Local verification

All 15 repository test groups passed using the Node `tsx` import loader. The learning suite has 73 passing tests, including official AG-UI event validation, A2A discovery/task lifecycle/correlation/source validation, ownership checks and the two-topic backend assessment transition. `npm run build` passed. Full-project TypeScript checking still reports pre-existing errors outside this feature; no errors are reported in the new agent workflow files.

Headless Chrome exercised actual React components with an isolated mock transport: assistant typing, study request opening a form, three independent answers producing a plan and chat summary, text result import, research review advancing to the next tab, reload persistence, and a 390px mobile layout without page overflow. This does not replace production verification of live provider calls, migrations, cron or RLS. The separate Codex CLI reviewer could not run because its configured model was rejected by the installed CLI/account; the changes received a manual review instead.

Production checks verified all five functions reject unauthorized POSTs, the hosted A2A specialist returns a brief with four cited sources, the authenticated research worker accepts its private scheduler key, and cron has saved three briefs to an existing workspace. The research table has RLS enabled with own-user read access, and anonymous/authenticated callers cannot execute the worker claim RPC. Existing security-advisor findings outside the changed workspace schema remain.

The frontend production deployment is live at https://www.curveapp.tech (Vercel deployment `dpl_G9m9JSX9hpBBbyC38Pcznz9YJMfr`). The server-generated scheduler/A2A keys were stored in Supabase, the scheduler key was mirrored into Vault, and temporary local key files were removed. Existing model and Tavily provider keys were reused. `.vercelignore` excludes local generated dependencies/artifacts from future uploads. The frontend build completed on Vercel.

## Assessment confirmation fix — 15 October 2026

Deployed the saved chat scope and confirmation flow to Supabase project `yjdcshkqgzcubniinwoc`: `material-study` version 11, `workspace-agent` version 9, and `workspace-voice-session` version 10, all retaining JWT verification. No schema migration was needed; per-topic confirmations use the existing material metadata JSON.

The production frontend is published at https://www.curveapp.tech via Vercel deployment `dpl_E7Zyeq3nmADyai97N6tgQ2JgqZER`. The production build passed, and the learning suite passed 96 tests, including the ten-topic scope through GitHub remote/push/clone and a chat-route regression for “yes pls” starting the saved assessment. Full-project typechecking still reports existing errors outside the changed learning workflow files. Live verification checks the public page/assets and unauthenticated function responses; it does not exercise a signed-in student's diagnostic or live question generation.


## Curriculum question correction — 15 October 2026

The generation prompt and validator reject questions about curriculum structure, module placement, credit hours and topic-list recall. The model must identify teaching evidence; curriculum-only or structurally invalid output triggers a bounded teaching-source search and one generation attempt against those snippets. If evidence remains insufficient, generation fails without saving or scoring a question set. Revision explanations use the same source fallback. Teaching-source links appear with post-submission feedback, not as accessible hints during the independent check.

The assessment tab includes “Restart assessment with fresh questions”; chat also accepts “restart assessment” during a check. Restarting keeps the selected topics and intake, creates a fresh session namespace for every topic, and excludes earlier attempts from the new revision plan. Earlier sessions are preserved. Failure to generate a replacement leaves the current assessment state intact.

The learning suite passed 103 tests and the production frontend build passed. Deployed `material-study` version 12, `workspace-agent` version 10 and `workspace-voice-session` version 11 with JWT verification enabled. Frontend deployment `dpl_31gEBbvemjCRYm3rKevRiqAT4M1M` is live at https://www.curveapp.tech. No migration was required. Regression coverage reproduces the screenshot's Module 3 question, exercises the teaching-source fallback and verifies restart does not reuse older question sets or their scores. A signed-in student's live generated diagnostic has not been exercised by these checks.


## Assessment selection preservation — 15 October 2026

Assessment forms now compare the values of saved intake fields rather than snapshot array identity. Focus/visibility refreshes, background polling and unrelated saved field changes preserve local topic selections and other unsaved form input. Per-assessment drafts are kept in the mounted workspace across artifact-tab switches and cleared on account changes. Actual changed fields from chat replace only those fields. Drafts are in memory; a full page reload still restores the saved server intake, not unsaved local changes.

The learning suite passed 106 tests, including focus/polling snapshots, per-tab draft restoration, real chat updates and React updater replay. The production build passed. Vercel deployment `dpl_6xGs2iSXR5kNQUeLdb5droFRMDVq` is live at https://www.curveapp.tech. No backend deployment or migration was required. Live verification checks that the domain serves the matching current JavaScript asset; the signed-in UI interactions were covered by the local hook regression harness rather than a live browser session.
