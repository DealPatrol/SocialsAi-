<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Single Next.js 15 / React 19 app (`socials-ai`), npm-managed. Scripts live in `package.json`: `npm run dev` (port 3000), `npm run build`, `npm run start`, `npm run lint`. There is no test script.

- **Core feature is AI post generation.** The home page (`/`) renders `PostGenerator`, which POSTs to `/api/generate`; that route calls Anthropic (`src/lib/anthropic.ts`) and requires `ANTHROPIC_API_KEY`. Without the key `/api/generate` returns HTTP 500 `{"error":"ANTHROPIC_API_KEY is not set"}` — the rest of the UI still renders and lint/build/dev are unaffected. This is the one secret needed to exercise the product's main action.
- **Data is Supabase, not a local database.** Automation queue/settings and the cron endpoints (`src/utils/supabase/*`, `src/app/api/automation/*`, `src/app/api/cron/*`) use `@supabase/ssr` / `@supabase/supabase-js`. There is no local Postgres, no `src/lib/db`, and no runtime schema provisioning. `AUTOMATION_SCHEMA.sql` is meant to be run in a real Supabase project (see `AUTOMATION_SETUP.md`).
- **Auth is NextAuth v4 with the Twitter OAuth 2.0 provider** (`src/lib/auth.ts`, handler at `src/app/api/auth/[...nextauth]/route.ts`). There is no email/password registration and no `middleware.ts`/`src/auth.ts`/Clerk in this codebase.
- **Required env** in `.env.local` for dev/build: a signing/encryption secret — set `NEXTAUTH_SECRET`, `AUTH_SECRET`, and `ENCRYPTION_KEY` (encryption uses `ENCRYPTION_KEY ?? AUTH_SECRET`), plus `NEXTAUTH_URL=http://localhost:3000`. `.env.local` is gitignored.
- **Optional env** — lint/build/dev and the base UI run without these, but the specific feature's endpoint returns HTTP 500 until the var is set (it does not silently no-op): `ANTHROPIC_API_KEY` (post generation via `/api/generate`), `TWITTER_CLIENT_ID`/`TWITTER_CLIENT_SECRET` (log in + post to a real X account; `src/lib/auth.ts` falls back to `placeholder-*` so startup is unaffected), `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Automation tab + `/api/automation/*`), `SUPABASE_SERVICE_ROLE_KEY` (`/api/cron/*`), and `CRON_SECRET` (cron auth).
- CI (`.github/workflows/ci.yml`) runs `npm ci`, `npm run build`, `npm run lint` with placeholder `AUTH_SECRET`/`ENCRYPTION_KEY`/`DATABASE_URL`. Note: `DATABASE_URL` is set in CI but is not referenced anywhere in the current source; `README.md` / `.env.example` are minimal and do not describe the real setup.
