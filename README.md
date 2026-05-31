<<<<<<< HEAD
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
=======
# SocialsAI — RepoFuse Growth Engine

AI-powered social growth for **RepoFuse** and your own products. Generate posts manually or connect **X (Twitter)** for compliant automation: high-engagement replies, smart follows, and an approval queue.

Instagram, Facebook, and YouTube are scaffolded as **coming soon**.

## Features

- **Content studio** — tweets, threads, strategic replies (Claude)
- **Multi-user accounts** — register, sign in, connect your own X account
- **Automation** — AI drafts original posts and strategic replies (informative + funny / serious / empathetic tones), scores engagement potential
- **Smart follows** — targets users likely to care about repo/SaaS tools (RepoFuse ICP)
- **X compliance** — official API only, rate limits, spam/manipulation filters, approval queue by default
- **Cron** — optional scheduled runs via Vercel Cron (`/api/cron/automation`)

## Setup

1. Copy env:

```bash
cp .env.example .env.local
```

2. Required variables:

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | AI generation |
| `AUTH_SECRET` | Session signing (`openssl rand -base64 32`) |
| `DATABASE_URL` | `file:./data/socials.db` (local) or Turso URL |
| `X_CLIENT_ID` / `X_CLIENT_SECRET` | X developer app OAuth 2.0 |
| `X_CALLBACK_URL` | e.g. `http://localhost:3000/api/accounts/x/callback` |
| `CRON_SECRET` | Protects cron endpoint |

3. X developer app scopes: `tweet.read`, `tweet.write`, `users.read`, `follows.write`, `offline.access`

4. Run:

```bash
npm install
npm run dev
```

5. Register → **Dashboard** → **Connect X** → enable automation → review **Approval queue**

## Recommended automation settings

- **Require approval**: ON (safest for X policies and brand voice)
- **Max replies/day**: 15–25
- **Max follows/day**: 10–15
- **Disclose automation**: optional, for transparency

## Architecture

- `src/lib/automation/engine.ts` — orchestration, queue, execution
- `src/lib/x/compliance.ts` — rate limits & content policy checks
- `src/lib/engagement.ts` — tone rotation & engagement scoring
- `src/lib/x/client.ts` — X API v2 wrapper

## License

See LICENSE.
>>>>>>> origin/main
