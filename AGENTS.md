<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Single Next.js 15 / React 19 app (`socials-ai`), npm-managed. Scripts live in `package.json`: `npm run dev` (port 3000), `npm run build`, `npm run lint`. There is no test script.

- **Database is Postgres, not SQLite.** Despite `README.md` / `.env.example` showing `DATABASE_URL=file:./data/socials.db`, `src/lib/db/index.ts` only accepts a `postgres://` / `postgresql://` URL and throws otherwise. Dev uses a local Postgres (db `socialsai`, user/pass `postgres`/`postgres`); `.env.local` sets `DATABASE_URL=postgres://postgres:postgres@localhost:5432/socialsai`.
- **Postgres is not auto-started on boot.** Start it before running the app: `sudo pg_ctlcluster 16 main start`.
- **Schema self-provisions at runtime** via `ensureDb()` (`CREATE TABLE IF NOT EXISTS`) on first query — no migration step is needed, and the `supabase/migrations/*.sql` file is not required for local dev.
- **Required env** in `.env.local`: `AUTH_SECRET` (NextAuth session signing) and `DATABASE_URL`. `NEXTAUTH_URL=http://localhost:3000`. Registration, login, onboarding, and the dashboard all work with just these.
- **`ANTHROPIC_API_KEY`** is only needed for AI features (Studio content generation and automation drafting); those endpoints error without it, but the rest of the app is unaffected. **X OAuth** (`X_CLIENT_ID`/`X_CLIENT_SECRET`/`X_CALLBACK_URL`) and `CRON_SECRET` are optional and only gate connecting a real X account / running scheduled automation.
- The root `middleware.ts` (Clerk) is vestigial; real auth is NextAuth via `src/middleware.ts` + `src/auth.ts`. Do not add Clerk keys.
- Known cosmetic quirk: `GET /icon.svg` returns 500 in dev; it does not affect functionality.
