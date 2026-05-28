import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const socialAccounts = sqliteTable("social_accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform", {
    enum: ["x", "instagram", "facebook", "youtube"],
  }).notNull(),
  platformUserId: text("platform_user_id").notNull(),
  username: text("username").notNull(),
  displayName: text("display_name"),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc"),
  tokenExpiresAt: integer("token_expires_at", { mode: "timestamp" }),
  automationEnabled: integer("automation_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const automationSettings = sqliteTable("automation_settings", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .unique()
    .references(() => socialAccounts.id, { onDelete: "cascade" }),
  mode: text("mode", { enum: ["draft", "auto"] }).notNull().default("draft"),
  repliesEnabled: integer("replies_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  followsEnabled: integer("follows_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  postsEnabled: integer("posts_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  maxRepliesPerDay: integer("max_replies_per_day").notNull().default(25),
  maxFollowsPerDay: integer("max_follows_per_day").notNull().default(15),
  maxPostsPerDay: integer("max_posts_per_day").notNull().default(5),
  minMinutesBetweenActions: integer("min_minutes_between_actions")
    .notNull()
    .default(8),
  toneMix: text("tone_mix").notNull().default('["informative","funny","serious","empathetic"]'),
  productContext: text("product_context"),
  targetKeywords: text("target_keywords").notNull().default(
    '["indie hacker","saas founder","build in public","side project","bootstrap"]'
  ),
  requireApproval: integer("require_approval", { mode: "boolean" })
    .notNull()
    .default(true),
  discloseAutomation: integer("disclose_automation", { mode: "boolean" })
    .notNull()
    .default(false),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const automationQueue = sqliteTable("automation_queue", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => socialAccounts.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["reply", "follow", "post"] }).notNull(),
  status: text("status", {
    enum: ["pending", "approved", "rejected", "executed", "failed", "skipped"],
  })
    .notNull()
    .default("pending"),
  payload: text("payload").notNull(),
  engagementScore: integer("engagement_score"),
  complianceNotes: text("compliance_notes"),
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
  executedAt: integer("executed_at", { mode: "timestamp" }),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const engagementLogs = sqliteTable("engagement_logs", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => socialAccounts.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  externalId: text("external_id"),
  metadata: text("metadata"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type SocialAccount = typeof socialAccounts.$inferSelect;
export type AutomationSetting = typeof automationSettings.$inferSelect;
export type AutomationQueueItem = typeof automationQueue.$inferSelect;
