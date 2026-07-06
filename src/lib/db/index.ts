import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Ephemeral store on Vercel serverless until Turso/Postgres is configured
  if (process.env.VERCEL) return ":memory:";
  return "file:./data/socials.db";
}

const url = resolveDatabaseUrl();

const client = createClient({ url });

export const db = drizzle(client, { schema });

export async function ensureDb() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at INTEGER NOT NULL
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
      replies_enabled INTEGER NOT NULL DEFAULT 1,
      follows_enabled INTEGER NOT NULL DEFAULT 0,
      posts_enabled INTEGER NOT NULL DEFAULT 0,
      max_replies_per_day INTEGER NOT NULL DEFAULT 25,
      max_follows_per_day INTEGER NOT NULL DEFAULT 15,
      max_posts_per_day INTEGER NOT NULL DEFAULT 5,
      min_minutes_between_actions INTEGER NOT NULL DEFAULT 8,
      tone_mix TEXT NOT NULL DEFAULT '["informative","funny","serious","empathetic"]',
      product_context TEXT,
      target_keywords TEXT NOT NULL,
      require_approval INTEGER NOT NULL DEFAULT 1,
      disclose_automation INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    )
  `);
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
