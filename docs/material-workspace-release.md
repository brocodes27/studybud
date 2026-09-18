# Curve material workspace — implementation record

## Delivered

- [x] Responsive landing page and sign-in screens inspired by the supplied dashboard reference, with a labeled interactive sample workspace.
- [x] A course-agnostic library accepting searchable PDF, TXT, Markdown, and pasted notes; no fixed subject catalog.
- [x] Editable topics and exam dates, source viewing, deletion, and a suggested next topic based on recent sessions and exam timing.
- [x] Guided practice with hints and separate independent checks, server-held answer keys, source quotations, saved sessions, and local answer drafts.
- [x] Activity and accuracy based on actual completed sessions, with separate guided and independent evidence. Removed routes to the simulated emergency-grade screen.
- [x] Private material ownership checks, session RLS, bounded AI requests, source validation, and question reporting.
- [x] Removed private API response caching from the service worker and cleared its old cache on activation.
- [x] Mirrored design tokens and visual guide in `docs/design.md` and `docs/design.html`.

## Backend deployment

Applied `20260908114704_curve_material_sessions.sql` and `20260908115233_curve_material_permissions.sql` to the existing studyplan project (`yjdcshkqgzcubniinwoc`). Deployed `material-study` version 1 with JWT verification enabled. Local migration versions match the remote migration history.

Verified database policies and grants: students can read only their own sessions; they cannot insert or overwrite scores, read answer keys, or modify the AI request ledger. Anonymous users cannot reserve sessions. Reports allow the owner to insert and read, but not rewrite them. Material ownership policies remain intact.

The frontend is available in the local preview. The public website has not been redeployed.

## Verification

All 14 repository test groups passed using the existing tests and the Node `tsx` import loader. The original `tsx` CLI could not open its IPC pipe in the sandbox; the import loader runs the same test code without that pipe. New tests cover topic limits, date validation, independent evidence, activity, source verification, answer validation, and server grading.

Browser checks exercised the actual React workspace components with an isolated test transport at `/tests/learning-workspace.html`. No real account or remote study data was created. Verified:

- Empty dashboard and library, notes intake, searchable PDF extraction through the PDF worker, and readable extracted source text.
- Topic suggestion, topic confirmation, guided practice, hints, answer navigation, correct and incorrect feedback, and source citations.
- An unsent answer survives a browser refresh and resuming the saved session.
- Guided practice does not populate independent accuracy; completing an independent check updates it separately.
- Independent checks expose no hint control.
- Desktop and phone layouts, including a 390-pixel study viewport without horizontal overflow.
- Landing sample tabs, course selection, sign-up navigation, and public page rendering.

Production builds pass. New learning screens have no TypeScript errors and no lint errors. The repository-wide checks still contain existing errors in unrelated files, including three hook-rule errors in `src/openui/atlasLibrary.tsx` and existing TypeScript issues elsewhere.

A separate Codex review was rejected by automatic approval review because it could transmit source code to an external review service. A local code and security review was performed instead. It found and fixed duplicate reservation races, inherited anonymous function permissions, request-budget resets after failed generation or material deletion, oversized library reads, and private API caching.

## Practical limits and remaining validation

Live authenticated AI generation has not been smoke-tested against a real user account. Deployment verifies the function bundle and access configuration, but does not establish provider availability or question quality. The existing `GEMINI_API_KEY` must be valid in the Supabase project.

This is the first material-driven beta slice, not a validated exam-readiness predictor. Generated questions require subject review before any accuracy or exam-outcome claims. Progress describes attempted questions; exact-repeat filtering is not a guarantee of semantically independent assessment.

Current intake limits: 20 MB, 100 PDF pages, 300,000 text characters, and 30 editable topics per material. Scanned PDFs, images, audio, and presentations are not supported. AI works from bounded excerpts, so it does not promise exhaustive document coverage. A student can make 30 new AI requests per rolling 24 hours, including failed attempts. Saved sessions remain usable. Progress currently summarizes the latest 500 sessions.

## Repeat the browser check

Start the normal development server and open `/tests/learning-workspace.html`. This entry intercepts all Supabase requests and keeps its data in that tab's session storage. Use `tests/fixtures/photosynthesis.pdf` to verify PDF extraction. The harness is a separate development entry and is not included in the production app bundle.

## Onboarding and required paid access — September 2026

New account entry runs through goal selection, custom course names (up to 12 starting courses), an optional exam date, a daily study target, and paid plan selection. Preferences persist in owner-protected `curve_study_preferences`; the workspace displays the saved study plan. Existing accounts without these preferences also complete setup. Public landing, demo, legal, and receipt routes remain public. `/demo/onboarding` is a clearly marked interactive preview without persistence or checkout.

The plans retain the existing app prices: USD 12.99 for 30 days or USD 39 for 120 days, one-time passes without automatic renewal. Checkout checks the configured provider product against the advertised price and one-time billing mode before proceeding. It authenticates the user server-side and requires completed onboarding. Missing or mismatched configuration fails with a recoverable error; it does not charge a different product as fallback.

Paid entry uses a server lookup with expiry checks, not profile flags, email-domain grants, or checkout-return parameters. Unpaid, expired, refunded, and unverifiable accounts remain outside the workspace. Material-study actions and Curve material/session policies enforce paid access on the backend. Subscription mutation privileges are service-only. Dodo webhook verification follows Standard Webhooks with timestamp checking; provider payment reconciliation and an atomic payment ledger prevent duplicate grants and late success notifications from reactivating a refunded payment. Refund revocation targets the matching current payment; earlier payments on an account with a newer purchase require manual billing reconciliation.

Applied migrations: `20260910091259`, `20260910091456`, `20260910091606`. Deployed `create-dodo-payment` v24, `dodo-webhook` v17, and `material-study` v2 to the existing project. The frontend is a local preview; no public frontend deployment was performed.

Validation: production build and learning/billing checks pass. New screens have no TypeScript errors; scoped lint reports warnings but no errors. `tests/onboarding-access.sql` verifies unpaid/active/expired access, duplicate delivery, renewal, refund, late success, and service-only payment grants in a rolled-back transaction. `tests/onboarding.html` tests the actual entry components with intercepted requests: save failure retains answers, successful save opens plan selection, refresh retains setup, direct links remain gated, checkout failure is recoverable, confirmation unlocks entry, and access-check failure closes it. The private payment ledger intentionally has RLS enabled with no public policies; the advisor's no-policy notice reflects service-only access.

No real payment was made. The initial onboarding checks did not verify provider configuration; the subsequent live configuration checks are recorded below. A completed purchase and provider-delivered payment event remain untested. Dodo references: [checkout sessions](https://docs.dodopayments.com/api-reference/checkout-sessions/create), [product details](https://docs.dodopayments.com/api-reference/products/get-products-1), [signed webhooks](https://docs.dodopayments.com/developer-resources/integration-guide).

Final responsive check: the onboarding-to-plan demo works at the phone breakpoint; the plan page measured 390px viewport / 384px document width with no horizontal overflow. Desktop selection, course validation, and the full saved-account flow were verified separately. Temporary browser viewport overrides were reset after testing.

## Live Dodo plan configuration — September 15, 2026

Created and verified the following live products through the Dodo API. Both use one-time USD prices, without discounts or automatic renewal; applicable taxes are additional.

| Pass | Product ID | Price | Access |
| --- | --- | --- | --- |
| Curve Monthly pass | `pdt_0NnfhGU3I9u3NaFFgupqt` | $12.99 | 30 days |
| Curve Semester pass | `pdt_0NnfhGYDg4qnLXuhYcDRJ` | $39.00 | 120 days |

Connected both product IDs and the working live API key to the existing Supabase project. Verified remote secret digests, live mode, and the existing webhook signing key. Synchronized local configuration and removed the unused browser-prefixed API secret. Existing unrelated Dodo products were left intact.

The enabled webhook `ep_3Hj6id0blSUyamHISOP4djQfBPx` targets `https://yjdcshkqgzcubniinwoc.supabase.co/functions/v1/dodo-webhook` and includes payment success, refund success, and accepted/lost disputes.

Live verification: both products successfully created checkout sessions using the application's request structure and a reserved example email. No payment was submitted. The deployed webhook accepted a correctly signed, ignored configuration event and rejected an invalid signature with HTTP 401; this check did not grant access or simulate a successful payment. Actual checkout completion and provider-triggered entitlement activation remain to be verified with a real authorized purchase. The public frontend has not been redeployed.
