# Environment Variables — ElevenFolks

**Last verified:** 2026-08-04 (P0.1). All keys present in `.env`. Values never committed.

## Required — Core platform

| Key | Purpose | Needed by |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | everything (auth, DB, edge functions) |
| `VITE_SUPABASE_ANON_KEY` | Public anon key (RLS-guarded) | client |
| `SUPABASE_SERVICE_ROLE_KEY` | Service key — **server-side only, never ship to client** | scripts, edge functions, metering rollups |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth sign-in | `Auth.tsx` (`@react-oauth/google`) |

## Required — AI provider

| Key | Purpose |
|---|---|
| `VITE_GEMINI_API_KEY` | Primary LLM (chat, drill gen, syllabus parsing) via `geminiService.ts` |
| `VITE_OPENAI_API_KEY` | Secondary/fallback provider in `aiService.ts` |
| `VITE_GEMINI_STT_MODEL` | Speech-to-text model id for voice input |
| `OPUSMAX_API_KEY` | Internal tooling (grader-agent) |

## Voice (Phase 0 decision: consolidate)

| Key | Status | Notes |
|---|---|---|
| `VITE_VAPI_API_KEY` / `VITE_VAPI_PUBLIC_KEY` | **Keep** | Live voice sessions (Vapi web SDK) |
| `VITE_VAPI_ASSISTANT_ID` / `VITE_VAPI_VOICE_ID` | **Keep** | Assistant config |
| `VITE_MURF_*` (3 keys) | Deprecate P0.5 | Pre-rendered TTS — candidate to cut |
| `VITE_HEYGEN_*` (3 keys) | Deprecate P0.5 | Avatar video — candidate to cut |

## Payments

| Key | Notes |
|---|---|
| `DODO_PAYMENTS_API_KEY` / `VITE_DODO_API_KEY` | Dodo Payments (current merchant of record) |
| `DODO_PRODUCT_ID` / `DODO_SEMESTER_PRODUCT_ID` / `VITE_DODO_PRODUCT_ID` | Pro + semester SKUs |
| `DODO_PAYMENTS_WEBHOOK_KEY` | Webhook verification (server) |
| `DODO_TEST_MODE` | `true` until launch |
| Razorpay / PayPal | Integrated per `PAYPAL_INTEGRATION.md`; keys live in Supabase edge-function secrets, not client env |

## Media/ingest

| Key | Purpose |
|---|---|
| `VITE_YOUTUBE_API_KEY` | SYOW YouTube ingestion metadata |
| `VITE_VIDEO_SERVER_URL` | Manim/remotion render server (`scripts/server.ts`) |

## Phase 0 additions (new flags)

| Key | Default | Purpose |
|---|---|---|
| `VITE_LEGACY_PAGES` | `off` | `on` exposes pre-Curve legacy routes (pages/*) for school accounts |
| `VITE_ANALYTICS_PROVIDER` | `inhouse` | `inhouse` (closed_loop tables) or `posthog` — decided P0.4 |

## Rules

1. Any `VITE_` key ships to the browser — no secrets behind `VITE_` except anon/public keys.
2. New keys must be added here + to `env.template` in the same PR.
3. Verify monthly: `grep -o '^[A-Z_]*=' .env` vs this doc.
