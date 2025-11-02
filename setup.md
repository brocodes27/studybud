# Studybud — Local setup guide

This file explains how to run the frontend (FE) and backend functions (BE) locally and how to connect them for local development.

## ✅ Currently Running Services

All services are **UP AND RUNNING** in this workspace:

- **Frontend (Vite React):** http://localhost:5173/
- **Backend Functions:**
  - generate-flashcards: http://localhost:8000/
  - generate-practice-test: http://localhost:8001/
  - generate-study-plan: http://localhost:8002/
  - pabbly-webhook: http://localhost:8003/

## Quick summary

- Frontend (Vite React) dev server: npm run dev ➜ http://localhost:5173/
- Backend functions: run with Deno directly for each function (see commands below)
- Alternative: install Supabase CLI + Docker and run `supabase start` + `supabase functions serve`

## Prerequisites

- **Node.js** (v18+ recommended). ✅ Node 20.15.1 installed in this workspace.
- **Package manager:** pnpm (preferred) or npm (fallback). ✅ npm available.
- **Deno** (for running functions directly). ✅ Deno 2.5.6 installed in this workspace.
- Supabase CLI and Docker — only required if you want to run the local Supabase stack (database, auth, and functions gateway).

Notes:
- On Windows, use Git Bash, WSL, or a terminal with bash support for the commands that use `VAR=value <command>` syntax.

## 1) Frontend — install and run

From the project root (where `package.json` lives):

1. Install dependencies

If you have pnpm available (recommended):

```bash
# enable via corepack (Node 18+)
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
```

If pnpm cannot be installed on your machine, use npm (works fine):

```bash
npm install
```

2. Create a local env file for Vite

✅ The `.env.local` file already exists with your Supabase credentials:

```env
VITE_GEMINI_API_KEY=AIzaSyD2Ga-QYs3oEdcA5q6FnUbdjxsdC77dnA0
VITE_GOOGLE_CLIENT_ID=451001975335-d22klr7jqbehak8kt0voitcurrdvdk9g.apps.googleusercontent.com
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_URL=https://yjdcshkqgzcubniinwoc.supabase.co
```

3. Run the dev server

```bash
npm run dev
```

✅ **Currently running** at http://localhost:5173/

## 2) Backend functions — quick local method (Deno)

✅ **All functions are currently running** in this workspace.

The functions in `supabase/functions/*` are written for Deno and use `Deno.serve(...)` — you can run them directly with Deno. This does not require Docker or the Supabase CLI.

1. Install Deno

✅ Deno 2.5.6 is already installed at `$HOME/.deno/bin/deno`

Official install for new setups (bash/WSL):

```bash
curl -fsSL https://deno.land/install.sh | sh
# Then add Deno to your PATH (the installer prints the path instructions)
```

Or on Windows use PowerShell:

```powershell
irm https://deno.land/install.ps1 | iex
```

2. Environment variables

✅ The `.env.functions` file already exists with your credentials:

```env
GEMINI_API_KEY=AIzaSyD2Ga-QYs3oEdcA5q6FnUbdjxsdC77dnA0
SUPABASE_URL=https://yjdcshkqgzcubniinwoc.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. Run functions (currently running in background)

**Generate Flashcards (port 8000)** ✅ Running

```bash
GEMINI_API_KEY=AIzaSyD2Ga-QYs3oEdcA5q6FnUbdjxsdC77dnA0 \
SUPABASE_URL=https://yjdcshkqgzcubniinwoc.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZGNzaGtxZ3pjdWJuaWlud29jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQzODU3NywiZXhwIjoyMDY2MDE0NTc3fQ.Xy0OJkdKN_v8A9HXizxwwZ5bJ2IGvvZ8LggpljK2_6A \
FUNCTION_PORT=8000 \
$HOME/.deno/bin/deno run --allow-env --allow-net --no-check ./supabase/functions/generate-flashcards/index.ts
```

**Generate Practice Test (port 8001)** ✅ Running

```bash
GEMINI_API_KEY=AIzaSyD2Ga-QYs3oEdcA5q6FnUbdjxsdC77dnA0 \
SUPABASE_URL=https://yjdcshkqgzcubniinwoc.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZGNzaGtxZ3pjdWJuaWlud29jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQzODU3NywiZXhwIjoyMDY2MDE0NTc3fQ.Xy0OJkdKN_v8A9HXizxwwZ5bJ2IGvvZ8LggpljK2_6A \
FUNCTION_PORT=8001 \
$HOME/.deno/bin/deno run --allow-env --allow-net --no-check ./supabase/functions/generate-practice-test/index.ts
```

**Generate Study Plan (port 8002)** ✅ Running

```bash
GEMINI_API_KEY=AIzaSyD2Ga-QYs3oEdcA5q6FnUbdjxsdC77dnA0 \
SUPABASE_URL=https://yjdcshkqgzcubniinwoc.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZGNzaGtxZ3pjdWJuaWlud29jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQzODU3NywiZXhwIjoyMDY2MDE0NTc3fQ.Xy0OJkdKN_v8A9HXizxwwZ5bJ2IGvvZ8LggpljK2_6A \
FUNCTION_PORT=8002 \
$HOME/.deno/bin/deno run --allow-env --allow-net --no-check ./supabase/functions/generate-study-plan/index.ts
```

**Pabbly Webhook (port 8003)** ✅ Running

```bash
GEMINI_API_KEY=AIzaSyD2Ga-QYs3oEdcA5q6FnUbdjxsdC77dnA0 \
SUPABASE_URL=https://yjdcshkqgzcubniinwoc.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZGNzaGtxZ3pjdWJuaWlud29jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQzODU3NywiZXhwIjoyMDY2MDE0NTc3fQ.Xy0OJkdKN_v8A9HXizxwwZ5bJ2IGvvZ8LggpljK2_6A \
FUNCTION_PORT=8003 \
$HOME/.deno/bin/deno run --allow-env --allow-net --no-check ./supabase/functions/pabbly-webhook/index.ts
```

4. Test the functions

Once running, hit the function endpoints. Example for **generate-flashcards** at http://localhost:8000/:

```bash
curl -X POST http://localhost:8000/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
  -d '{"topic":"algebra","subject":"Math","class":"10","count":2}'
```

Example for **generate-study-plan** at http://localhost:8002/:

```bash
curl -X POST http://localhost:8002/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
  -d '{"class":"10","subject":"Math","chapters":"Algebra, Geometry","exam_date":"2025-12-01"}'
```

Replace `YOUR_USER_JWT_TOKEN` with a valid JWT from your Supabase auth session. To get this token:
- Log in to your app at http://localhost:5173/
- Open browser DevTools → Application → Local Storage → look for `sb-<project>-auth-token`
- Or use Supabase client: `supabase.auth.getSession()` returns `session.access_token`

## 3) Backend functions — Supabase CLI (full stack)

If you want a fully integrated local Supabase environment (auth, Postgres, storage, functions gateway), use the Supabase CLI. This requires Docker.

1. Install Supabase CLI

Preferred: follow official instructions at https://supabase.com/docs/guides/cli

Quick install via npm (may not be latest):

```bash
npm install -g supabase
```

(Or download a release binary and place it on PATH.)

2. Start Supabase locally (requires Docker)

```bash
supabase start
```

3. Serve functions through the CLI

```bash
# from project root
supabase functions serve generate-flashcards --env-file ./supabase/.env.functions
# or serve all functions (if you want the full suite)
# supabase functions serve --env-file ./supabase/.env.functions
```

When running via the Supabase CLI, functions will be reachable via the local Supabase functions gateway (the CLI will show the URL and port). The CLI also provides local auth and a Postgres instance so functions can save responses to the database.

## Connecting FE and BE locally

- If you run functions directly with Deno, the functions will be available at the `localhost:FUNCTION_PORT` ports. Point your FE requests to those local endpoints or use a small proxy in the frontend that routes `/api/*` to `http://localhost:8000/` during dev.

- If you run `supabase start` + `supabase functions serve`, the CLI will provide local function URLs and you can configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to point the FE at the local Supabase instance (if you want full auth flows).

## Troubleshooting & Notes

- If `pnpm` install via corepack fails due to permissions on Windows, either run a terminal as administrator or use `npm install` as a fallback. ✅ We used npm in this workspace.
- Deno: the commands above use `--allow-env` and `--allow-net`; you may add `--allow-read`/`--allow-write` if you modify functions to access files.
- Functions require `GEMINI_API_KEY` (Google Gemini API) and valid Supabase credentials to work properly. ✅ Your credentials are configured.
- The `pabbly-webhook` function now reads `FUNCTION_PORT` from env (modified to match the other functions).

## What's currently running in this workspace

✅ **All services are UP:**

1. **Frontend dev server (Vite):**
   - URL: http://localhost:5173/
   - Started with: `npm run dev`

2. **Backend functions (Deno):**
   - generate-flashcards: http://localhost:8000/
   - generate-practice-test: http://localhost:8001/
   - generate-study-plan: http://localhost:8002/
   - pabbly-webhook: http://localhost:8003/

3. **Environment:**
   - Node.js: v20.15.1
   - Deno: v2.5.6
   - All credentials configured in `.env.local` and `.env.functions`

## How frontend connects to backend

Your frontend at http://localhost:5173/ can make requests to the local backend functions:

- Flashcards: `http://localhost:8000/`
- Practice tests: `http://localhost:8001/`
- Study plans: `http://localhost:8002/`

If your frontend code currently points to `https://yjdcshkqgzcubniinwoc.supabase.co/functions/v1/...`, you can:
- Keep using the hosted Supabase functions (recommended for production)
- Or modify your frontend to use localhost URLs during development

The Supabase client in `src/lib/supabase.ts` uses `VITE_SUPABASE_URL` which points to your hosted Supabase, so auth and database queries will work seamlessly.

## Quick copy-paste checklist (for new setup)

```bash
# (1) Install dependencies
npm install

# (2) Start frontend
npm run dev
# Frontend available at: http://localhost:5173/

# (3) Install Deno (if not already installed)
# For Windows PowerShell:
irm https://deno.land/install.ps1 | iex
# For bash/WSL:
curl -fsSL https://deno.land/install.sh | sh

# (4) Start backend functions (run each in a separate terminal)

# Terminal 1 - Flashcards
GEMINI_API_KEY=AIzaSyD2Ga-QYs3oEdcA5q6FnUbdjxsdC77dnA0 \
SUPABASE_URL=https://yjdcshkqgzcubniinwoc.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZGNzaGtxZ3pjdWJuaWlud29jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQzODU3NywiZXhwIjoyMDY2MDE0NTc3fQ.Xy0OJkdKN_v8A9HXizxwwZ5bJ2IGvvZ8LggpljK2_6A \
FUNCTION_PORT=8000 \
$HOME/.deno/bin/deno run --allow-env --allow-net --no-check ./supabase/functions/generate-flashcards/index.ts

# Terminal 2 - Practice Test
GEMINI_API_KEY=AIzaSyD2Ga-QYs3oEdcA5q6FnUbdjxsdC77dnA0 \
SUPABASE_URL=https://yjdcshkqgzcubniinwoc.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZGNzaGtxZ3pjdWJuaWlud29jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQzODU3NywiZXhwIjoyMDY2MDE0NTc3fQ.Xy0OJkdKN_v8A9HXizxwwZ5bJ2IGvvZ8LggpljK2_6A \
FUNCTION_PORT=8001 \
$HOME/.deno/bin/deno run --allow-env --allow-net --no-check ./supabase/functions/generate-practice-test/index.ts

# Terminal 3 - Study Plan
GEMINI_API_KEY=AIzaSyD2Ga-QYs3oEdcA5q6FnUbdjxsdC77dnA0 \
SUPABASE_URL=https://yjdcshkqgzcubniinwoc.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZGNzaGtxZ3pjdWJuaWlud29jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQzODU3NywiZXhwIjoyMDY2MDE0NTc3fQ.Xy0OJkdKN_v8A9HXizxwwZ5bJ2IGvvZ8LggpljK2_6A \
FUNCTION_PORT=8002 \
$HOME/.deno/bin/deno run --allow-env --allow-net --no-check ./supabase/functions/generate-study-plan/index.ts

# Terminal 4 - Pabbly Webhook
GEMINI_API_KEY=AIzaSyD2Ga-QYs3oEdcA5q6FnUbdjxsdC77dnA0 \
SUPABASE_URL=https://yjdcshkqgzcubniinwoc.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZGNzaGtxZ3pjdWJuaWlud29jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQzODU3NywiZXhwIjoyMDY2MDE0NTc3fQ.Xy0OJkdKN_v8A9HXizxwwZ5bJ2IGvvZ8LggpljK2_6A \
FUNCTION_PORT=8003 \
$HOME/.deno/bin/deno run --allow-env --allow-net --no-check ./supabase/functions/pabbly-webhook/index.ts
```

## Service URLs summary

- Frontend: http://localhost:5173/
- Flashcards API: http://localhost:8000/
- Practice Test API: http://localhost:8001/
- Study Plan API: http://localhost:8002/
- Pabbly Webhook: http://localhost:8003/

---

## Additional options

If you'd like, you can also:

- Add a bash script (`start-all.sh`) to start all services with one command
- Use a process manager like `concurrently` or `pm2` to manage all services
- Set up the full Supabase CLI local stack with `supabase start` (requires Docker)

Let me know if you need help with any of these options!
