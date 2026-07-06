import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.VERCEL) return ":memory:";
  return "file:./data/socials.db";
}

const url = resolveDatabaseUrl();
const client = createClient({ url });
export const db = drizzle(client, { schema });

async function tryAlter(sql: string) {
  try {
    await client.execute(sql);
  } catch {
    // column may already exist
  }
}

export async function ensureDb() {
  await client.execute(`
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

  await client.execute(`
    CREATE TABLE IF NOT EXISTS auth_codes (
      code TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    )
  `);

  await client.execute(`
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

  await client.execute(`
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

  await client.execute(`
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

  await client.execute(`
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
