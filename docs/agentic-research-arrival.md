# Curve research arrival

Date: 2026-10-18

## Reference research

Used the reverse-engineer-anything skill and REA to load the public [Manus analyst page](https://manus.im/solutions/analysts) in temporary headless Chrome, wait two seconds, and capture accessibility text and the final URL. Both declared steps completed; the owned browser was terminated. Complete returned evidence is saved in [research-evidence/agentic-arrival-manus.json](research-evidence/agentic-arrival-manus.json).

Evidence ID: `ev_f520c7ceb42a99d3de39baac256d6de4567cf0aefa9f2f13bdfd697861a63dc1`.

Observed: the public page groups autonomous research around tangible outputs, including reports, spreadsheets, and dashboards; it presents recurring monitoring and parallel research as concrete deliverables. This establishes the public presentation, not authenticated product behavior. No account was created, and no private data was uploaded. Screenshot appearance and authenticated delivery animations were not observed.

Supporting primary sources: [Manus Wide Research](https://help.manus.im/en/articles/11960169-what-is-wide-research) documents research divided into parallel tasks. [Gemini scheduled actions](https://blog.google/products-and-platforms/products/gemini/scheduled-actions-gemini-app/) describes proactive personalized updates and scheduled summaries. These support the research-delivery concept; they do not establish the exact animation implemented here.

## Curve adaptation

Design choices: Curve greets the returning student in first person, names the researched topics, and presents saved briefs with source counts and preparation dates. An agent introduction leads into staggered brief previews and matching activity tabs. The student chooses which report to open. Existing report, sources, review/next, and close behavior remains connected to saved workspace artifacts.

The arrival opens over a previously saved passive view when unread research exists. Sessions, assessment drafts, and independent checks retain their active view. Any foreground message, tool action, or tab selection dismisses automatic arrival for that workspace mount. Returning to Today still exposes unread research.

Only nonempty saved research artifacts count. Reviewed and closed artifacts are excluded from the arrival. Running, pending, failed, and paused states explain what is happening without claiming completed work. The animation presents existing work; it does not run or simulate a new research job. Background research generation and refresh use the existing backend.

Uses installed GSAP with React scope cleanup, transform/opacity animation, reduced-motion support, and a skip control. Opening a brief uses the existing persisted activation API. Animation itself writes no workspace state.

## Validation

- Unit checks cover unread selection, recency ordering, excluded empty/closed/reviewed work, and protection of sessions, assessments, and checkpoints.
- Interactive sample: `/tests/agent-arrival.html` on the local Vite server. Uses sample research and performs no account writes.
- Headless Chrome: desktop 1440 × 1000 and mobile 390 × 844. Verified arrival, three tabs, report selection, sources, review/next, closing, running/failed/paused states, mobile overflow, and reduced motion. No page runtime errors.
- Production Vite build passes. Whole-project TypeScript checking still reports existing errors outside the changed components; no diagnostics point to the changed research arrival, dashboard, workspace, or tabs.

Authenticated live-account persistence and a new background research job were not exercised in this pass.
