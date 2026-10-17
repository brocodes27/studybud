# Learning flow implementation

Updated 2026-10-18.

## Delivered

- Material-first onboarding: add a course source, review/edit topics against the source, select covered topics, set an optional exam date and daily pace, then save the existing semester plan.
- Confirmation preserves full source pages and metadata when the library supplies only a lightweight material record. Reads and writes retain owner filters.
- Today's dashboard: primary study/rest recommendation, saved-session resume, searchable bookshelf, actual weekly activity, and independent accuracy. Layout follows the existing Curve palette with responsive navigation and restrained illustrations.
- Existing enrollment-based stage queue/map/session routes now have readable stage labels, reasons, durations, error recovery, and explicit saved-progress receipts. Encoding feedback remains visible until Continue.
- First-course uploads stay in setup; established-course uploads open the reader. Manual semester setup remains available.

## Review of intervening changes

Kept the useful session exit controls, checkpoint unlock behavior, draft handling, and encoding feedback improvements. Removed duplicate exit controls and incomplete-session grading that treated unanswered questions as wrong. An unfinished session can be saved and resumed; it does not produce a score.

Exit failures now remain visible and retryable. The native exit dialog traps focus, supports Escape, and restores focus to its opener. Background refreshes restore valid local draft answers; completed sessions ignore drafts. Cancelling a checkpoint cannot remove an unrelated activity. Chat exit detection requires an explicit request, so negated or descriptive language does not silently end a check.

## Validation

- Production build passes.
- Learning suite: 154 tests pass, plus draft-recovery assertions in the model test script.
- Gate, planner, map, and stage-save regression suite: 54 tests pass.
- Scoped ESLint: zero errors; existing/type-signature warnings remain.
- Repository-wide TypeScript still fails in existing unrelated files; no diagnostics in the changed learning-flow modules.
- REA captured current desktop and mobile fixture rendering without page errors. Selected evidence metadata is in research-evidence/learning-flow-verification.json.
- In-app browser verified source-topic confirmation, pace selection, plan creation, search empty/clear states, failed draft-save recovery, Escape dismissal, and focus restoration. Browser fixtures use sample data and do not write to an account.

## Boundaries

No deployment was performed and live authenticated persistence was not exercised. Persistence/error behavior is covered by mocked API regression tests. The existing material-based learning workspace and enrollment-based stage engine remain distinct data systems. Mixed-stage practice and exam fluency retain their pre-existing fallback behavior; this pass does not claim a new interleaving engine.

Local review fixture: http://127.0.0.1:5173/tests/learning-flow.html

## Production deployment — 18 October 2026

Published the current workspace, including interactive research briefs and the activity tab strip, to https://www.curveapp.tech. Vercel deployment: https://elevenfolks-gg5sob2rr-brocodes27s-projects.vercel.app (inspection ID `3wNJVU4pPDFYLBVPVhossGLDR1Rk`). The Vercel production build passed.

Deployed affected Supabase functions: `material-study` v18, `workspace-agent` v20, `workspace-voice-session` v17, `workspace-voice` v4, `workspace-research` v6, and `research-specialist` v4. All six are active and reject unauthenticated POST requests with HTTP 401. Existing JWT and application-level secret checks are preserved.

Validation: all 156 learning tests and 11 stage map/data tests passed. The production domain serves the new entry asset `index-ewKaJGVO.js`, which references `CurveApp-C5oq7L9X.js`; the workspace asset contains the activity tab and interactive brief UI. Live signed-in generation and persistence were not exercised. No schema changes were required: the locally named `20261015160846` free-syllabus migration is already applied remotely under version `20261015174737`; migration history was left unchanged.
