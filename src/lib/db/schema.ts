import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  name: text("name"),
  xUserId: text("x_user_id").unique(),
  websiteUrl: text("website_url"),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const authCodes = pgTable("auth_codes", {
  code: text("code").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const socialAccounts = pgTable("social_accounts", {
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
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true, mode: "date" }),
  automationEnabled: boolean("automation_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const automationSettings = pgTable("automation_settings", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .unique()
    .references(() => socialAccounts.id, { onDelete: "cascade" }),
  mode: text("mode", { enum: ["draft", "auto"] }).notNull().default("draft"),
  growthPreset: text("growth_preset", {
    enum: ["safe", "balanced", "aggressive"],
  })
    .notNull()
    .default("safe"),
  repliesEnabled: boolean("replies_enabled").notNull().default(true),
  threadRepliesEnabled: boolean("thread_replies_enabled").notNull().default(true),
  followsEnabled: boolean("follows_enabled").notNull().default(true),
  postsEnabled: boolean("posts_enabled").notNull().default(true),
  dmsEnabled: boolean("dms_enabled").notNull().default(false),
  maxRepliesPerDay: integer("max_replies_per_day").notNull().default(20),
  maxFollowsPerDay: integer("max_follows_per_day").notNull().default(12),
  maxPostsPerDay: integer("max_posts_per_day").notNull().default(4),
  maxDmsPerDay: integer("max_dms_per_day").notNull().default(3),
  minMinutesBetweenActions: integer("min_minutes_between_actions")
    .notNull()
    .default(10),
  toneMix: text("tone_mix").notNull().default('["informative","funny","serious","empathetic"]'),
  productContext: text("product_context"),
  websiteUrl: text("website_url"),
  targetKeywords: text("target_keywords").notNull().default(
    '["indie hacker","saas founder","build in public","side project","bootstrap"]'
  ),
  targetAccounts: text("target_accounts").notNull().default(
    '["levelsio","dvassallo","arvidkahl","marc_louvion","thepatwalls"]'
  ),
  requireApproval: boolean("require_approval").notNull().default(true),
  discloseAutomation: boolean("disclose_automation").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const automationQueue = pgTable("automation_queue", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => socialAccounts.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["reply", "follow", "post", "dm"] }).notNull(),
  status: text("status", {
    enum: ["pending", "approved", "rejected", "executed", "failed", "skipped"],
  })
    .notNull()
    .default("pending"),
  payload: text("payload").notNull(),
  engagementScore: integer("engagement_score"),
  complianceNotes: text("compliance_notes"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }),
  executedAt: timestamp("executed_at", { withTimezone: true, mode: "date" }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const engagementLogs = pgTable("engagement_logs", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => socialAccounts.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  externalId: text("external_id"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type SocialAccount = typeof socialAccounts.$inferSelect;
export type AutomationSetting = typeof automationSettings.$inferSelect;
export type AutomationQueueItem = typeof automationQueue.$inferSelect;
