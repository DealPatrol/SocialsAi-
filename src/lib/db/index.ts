import postgres, { type Sql } from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

function resolveDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  if (url && (url.startsWith("postgres://") || url.startsWith("postgresql://"))) {
    return url;
  }
  return null;
}

let sqlClient: Sql | null = null;
let dbInstance: PostgresJsDatabase<typeof schema> | null = null;

function getSql(): Sql {
  if (!sqlClient) {
    const url = resolveDatabaseUrl();
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set to a valid Postgres connection string"
      );
    }
    sqlClient = postgres(url, {
      max: 5,
      prepare: false,
      idle_timeout: 20,
    });
  }
  return sqlClient;
}

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    if (!dbInstance) {
      dbInstance = drizzle(getSql(), { schema });
    }
    return Reflect.get(dbInstance, prop, receiver);
  },
});

const DDL = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    name TEXT,
    x_user_id TEXT UNIQUE,
    website_url TEXT,
    onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS auth_codes (
    code TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS social_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    platform_user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT,
    access_token_enc TEXT NOT NULL,
    refresh_token_enc TEXT,
    token_expires_at TIMESTAMPTZ,
    automation_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS automation_settings (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL UNIQUE REFERENCES social_accounts(id) ON DELETE CASCADE,
    mode TEXT NOT NULL DEFAULT 'draft',
    growth_preset TEXT NOT NULL DEFAULT 'safe',
    replies_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    thread_replies_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    follows_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    posts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    dms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    max_replies_per_day INTEGER NOT NULL DEFAULT 20,
    max_follows_per_day INTEGER NOT NULL DEFAULT 12,
    max_posts_per_day INTEGER NOT NULL DEFAULT 4,
    max_dms_per_day INTEGER NOT NULL DEFAULT 3,
    min_minutes_between_actions INTEGER NOT NULL DEFAULT 10,
    tone_mix TEXT NOT NULL DEFAULT '["informative","funny","serious","empathetic"]',
    product_context TEXT,
    website_url TEXT,
    target_keywords TEXT NOT NULL DEFAULT '["indie hacker","saas founder","build in public","side project","bootstrap"]',
    target_accounts TEXT NOT NULL DEFAULT '[]',
    require_approval BOOLEAN NOT NULL DEFAULT TRUE,
    disclose_automation BOOLEAN NOT NULL DEFAULT FALSE,
    likes_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    max_likes_per_day INTEGER NOT NULL DEFAULT 3,
    posting_windows TEXT NOT NULL DEFAULT '[]',
    dm_template_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS automation_queue (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payload TEXT NOT NULL,
    engagement_score INTEGER,
    compliance_notes TEXT,
    scheduled_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS posted_tweets (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
    queue_id TEXT REFERENCES automation_queue(id) ON DELETE SET NULL,
    tweet_id TEXT NOT NULL UNIQUE,
    text TEXT NOT NULL,
    post_type TEXT NOT NULL DEFAULT 'post',
    posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metrics JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS engagement_tracking (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
    target_user_id TEXT,
    target_username TEXT,
    target_tweet_id TEXT,
    action TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'executed',
    reason TEXT,
    scheduled_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS engagement_tracking_dedupe_idx
    ON engagement_tracking (account_id, action, COALESCE(target_user_id, ''), COALESCE(target_tweet_id, ''))`,
  `CREATE TABLE IF NOT EXISTS dm_templates (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    template TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS engagement_logs (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    external_id TEXT,
    metadata TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
];

let ensured: Promise<void> | null = null;

async function tryQuery(sql: Sql, statement: string): Promise<void> {
  try {
    await sql.unsafe(statement);
  } catch {
    // Existing deployments may already have the object.
  }
}

export function ensureDb(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      const sql = getSql();
      for (const ddl of DDL) {
        await sql.unsafe(ddl);
      }
      await tryQuery(sql, "ALTER TABLE automation_settings ADD COLUMN likes_enabled BOOLEAN NOT NULL DEFAULT TRUE");
      await tryQuery(sql, "ALTER TABLE automation_settings ADD COLUMN max_likes_per_day INTEGER NOT NULL DEFAULT 3");
      await tryQuery(sql, "ALTER TABLE automation_settings ADD COLUMN posting_windows TEXT NOT NULL DEFAULT '[]'");
      await tryQuery(sql, "ALTER TABLE automation_settings ADD COLUMN dm_template_id TEXT");
      for (const table of [
        "users",
        "auth_codes",
        "social_accounts",
        "automation_settings",
        "automation_queue",
        "posted_tweets",
        "engagement_tracking",
        "dm_templates",
        "engagement_logs",
      ]) {
        await tryQuery(sql, `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      }
    })().catch((err) => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}
