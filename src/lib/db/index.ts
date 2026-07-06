import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

function isValidLibsqlUrl(url: string): boolean {
  return (
    url === ":memory:" ||
    url.startsWith("file:") ||
    url.startsWith("libsql:") ||
    url.startsWith("https://") ||
    url.startsWith("http://")
  );
}

function resolveDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL?.trim();
  if (envUrl && isValidLibsqlUrl(envUrl)) return envUrl;

  // Invalid placeholder (e.g. "Turso/libSQL/URL") — don't crash builds
  if (process.env.NEXT_PHASE === "phase-production-build") return ":memory:";
  if (process.env.VERCEL) return ":memory:";
  return "file:./data/socials.db";
}

let client: Client | null = null;
let dbInstance: LibSQLDatabase<typeof schema> | null = null;

function getClient(): Client {
  if (!client) {
    client = createClient({ url: resolveDatabaseUrl() });
  }
  return client;
}

export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    if (!dbInstance) {
      dbInstance = drizzle(getClient(), { schema });
    }
    return Reflect.get(dbInstance, prop, receiver);
  },
});

async function tryAlter(sql: string) {
  try {
    await getClient().execute(sql);
  } catch {
    // column may already exist
  }
}

export async function ensureDb() {
  const c = getClient();
  await c.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      name TEXT,
      x_user_id TEXT UNIQUE,
      website_url TEXT,
      onboarding_complete INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `);
  await tryAlter(`ALTER TABLE users ADD COLUMN x_user_id TEXT`);
  await tryAlter(`ALTER TABLE users ADD COLUMN website_url TEXT`);
  await tryAlter(`ALTER TABLE users ADD COLUMN onboarding_complete INTEGER DEFAULT 0`);

  await c.execute(`
    CREATE TABLE IF NOT EXISTS auth_codes (
      code TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    )
  `);

  await c.execute(`
    CREATE TABLE IF NOT EXISTS social_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      platform_user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      display_name TEXT,
      access_token_enc TEXT NOT NULL,
      refresh_token_enc TEXT,
      token_expires_at INTEGER,
      automation_enabled INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `);

  await c.execute(`
    CREATE TABLE IF NOT EXISTS automation_settings (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL UNIQUE REFERENCES social_accounts(id) ON DELETE CASCADE,
      mode TEXT NOT NULL DEFAULT 'draft',
      growth_preset TEXT NOT NULL DEFAULT 'safe',
      replies_enabled INTEGER NOT NULL DEFAULT 1,
      thread_replies_enabled INTEGER NOT NULL DEFAULT 1,
      follows_enabled INTEGER NOT NULL DEFAULT 1,
      posts_enabled INTEGER NOT NULL DEFAULT 1,
      dms_enabled INTEGER NOT NULL DEFAULT 0,
      max_replies_per_day INTEGER NOT NULL DEFAULT 20,
      max_follows_per_day INTEGER NOT NULL DEFAULT 12,
      max_posts_per_day INTEGER NOT NULL DEFAULT 4,
      max_dms_per_day INTEGER NOT NULL DEFAULT 3,
      min_minutes_between_actions INTEGER NOT NULL DEFAULT 10,
      tone_mix TEXT NOT NULL DEFAULT '["informative","funny","serious","empathetic"]',
      product_context TEXT,
      website_url TEXT,
      target_keywords TEXT NOT NULL,
      target_accounts TEXT NOT NULL DEFAULT '[]',
      require_approval INTEGER NOT NULL DEFAULT 1,
      disclose_automation INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    )
  `);
  await tryAlter(`ALTER TABLE automation_settings ADD COLUMN growth_preset TEXT DEFAULT 'safe'`);
  await tryAlter(`ALTER TABLE automation_settings ADD COLUMN thread_replies_enabled INTEGER DEFAULT 1`);
  await tryAlter(`ALTER TABLE automation_settings ADD COLUMN dms_enabled INTEGER DEFAULT 0`);
  await tryAlter(`ALTER TABLE automation_settings ADD COLUMN max_dms_per_day INTEGER DEFAULT 3`);
  await tryAlter(`ALTER TABLE automation_settings ADD COLUMN website_url TEXT`);
  await tryAlter(`ALTER TABLE automation_settings ADD COLUMN target_accounts TEXT DEFAULT '[]'`);

  await c.execute(`
    CREATE TABLE IF NOT EXISTS automation_queue (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payload TEXT NOT NULL,
      engagement_score INTEGER,
      compliance_notes TEXT,
      scheduled_at INTEGER,
      executed_at INTEGER,
      error_message TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  await c.execute(`
    CREATE TABLE IF NOT EXISTS engagement_logs (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      external_id TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL
    )
  `);
}
