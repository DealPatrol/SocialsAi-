import { and, count, desc, eq, gte } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, ensureDb } from "@/lib/db";
import {
  automationQueue,
  automationSettings,
  engagementLogs,
  socialAccounts,
} from "@/lib/db/schema";
import {
  parseToneMix,
  pickNextTone,
  type ContentTone,
} from "@/lib/engagement";
import { generateStrategicReply, finalizeReply } from "./reply-generator";
import {
  generateOriginalPost,
  finalizePost,
  pickNextPillar,
} from "./post-generator";
import { generateWarmDm } from "./dm-generator";
import { getAuthenticatedXClient } from "@/lib/x/token";
import {
  GROWTH_PRESET_LIMITS,
  type GrowthPreset,
} from "@/lib/x/growth";
import {
  checkActionCooldown,
  validateDmAction,
  validateFollowAction,
  validatePostAction,
  validateReplyAction,
} from "@/lib/x/compliance";
import type { PillarId } from "@/lib/strategy";
import { getXOAuthConfig } from "@/lib/x/oauth";
import type { ThreadOpportunity } from "@/lib/platforms/types";

function startOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfHour(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  return d;
}

async function countActionsToday(accountId: string, action: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(engagementLogs)
    .where(
      and(
        eq(engagementLogs.accountId, accountId),
        eq(engagementLogs.action, action),
        gte(engagementLogs.createdAt, startOfDay())
      )
    );
  return Number(row?.c ?? 0);
}

async function countActionsThisHour(accountId: string, action: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(engagementLogs)
    .where(
      and(
        eq(engagementLogs.accountId, accountId),
        eq(engagementLogs.action, action),
        gte(engagementLogs.createdAt, startOfHour())
      )
    );
  return Number(row?.c ?? 0);
}

async function getLastActionAt(accountId: string): Promise<Date | null> {
  const [row] = await db
    .select({ createdAt: engagementLogs.createdAt })
    .from(engagementLogs)
    .where(eq(engagementLogs.accountId, accountId))
    .orderBy(desc(engagementLogs.createdAt))
    .limit(1);
  return row?.createdAt ?? null;
}

async function getRecentTones(
  accountId: string,
  type: "reply" | "post" | "dm" = "reply"
): Promise<ContentTone[]> {
  const items = await db
    .select({ payload: automationQueue.payload })
    .from(automationQueue)
    .where(
      and(
        eq(automationQueue.accountId, accountId),
        eq(automationQueue.type, type === "dm" ? "dm" : type)
      )
    )
    .orderBy(desc(automationQueue.createdAt))
    .limit(5);

  return items
    .map((i) => {
      try {
        const p = JSON.parse(i.payload) as { tone?: ContentTone };
        return p.tone;
      } catch {
        return undefined;
      }
    })
    .filter((t): t is ContentTone => !!t);
}

async function getRecentPillarIds(accountId: string): Promise<PillarId[]> {
  const items = await db
    .select({ payload: automationQueue.payload })
    .from(automationQueue)
    .where(
      and(eq(automationQueue.accountId, accountId), eq(automationQueue.type, "post"))
    )
    .orderBy(desc(automationQueue.createdAt))
    .limit(5);

  return items
    .map((i) => {
      try {
        const p = JSON.parse(i.payload) as { pillarId?: PillarId };
        return p.pillarId;
      } catch {
        return undefined;
      }
    })
    .filter((id): id is PillarId => !!id);
}

function effectiveLimits(settings: typeof automationSettings.$inferSelect) {
  const preset = GROWTH_PRESET_LIMITS[settings.growthPreset as GrowthPreset] ?? GROWTH_PRESET_LIMITS.safe;
  return {
    maxReplies: Math.min(settings.maxRepliesPerDay, preset.maxRepliesPerDay),
    maxFollows: Math.min(settings.maxFollowsPerDay, preset.maxFollowsPerDay),
    maxPosts: Math.min(settings.maxPostsPerDay, preset.maxPostsPerDay),
    maxDms: Math.min(settings.maxDmsPerDay, preset.maxDmsPerDay),
    minMinutes: Math.max(settings.minMinutesBetweenActions, preset.minMinutesBetweenActions),
  };
}

export interface AutomationRunResult {
  accountId: string;
  username: string;
  repliesQueued: number;
  postsQueued: number;
  followsQueued: number;
  dmsQueued: number;
  executed: number;
  skipped: string[];
}

async function queueAction(
  accountId: string,
  type: "reply" | "follow" | "post" | "dm",
  payload: Record<string, unknown>,
  settings: typeof automationSettings.$inferSelect,
  engagementScore: number,
  complianceNotes: string,
  options?: { dryRun?: boolean }
): Promise<{ queueId: string; status: string }> {
  const status =
    settings.mode === "auto" && !settings.requireApproval ? "approved" : "pending";

  const queueId = uuid();
  await db.insert(automationQueue).values({
    id: queueId,
    accountId,
    type,
    status,
    payload: JSON.stringify(payload),
    engagementScore,
    complianceNotes,
    scheduledAt: status === "approved" ? new Date() : undefined,
  });

  if (status === "approved" && !options?.dryRun) {
    await executeQueueItem(queueId);
  }

  return { queueId, status };
}

export async function runAutomationForAccount(
  accountId: string,
  options?: { dryRun?: boolean }
): Promise<AutomationRunResult> {
  await ensureDb();

  const [account] = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.id, accountId));

  if (!account || !account.automationEnabled || account.platform !== "x") {
    throw new Error("Account not found or automation disabled");
  }

  const [settings] = await db
    .select()
    .from(automationSettings)
    .where(eq(automationSettings.accountId, accountId));

  if (!settings) throw new Error("Automation settings missing");

  const result: AutomationRunResult = {
    accountId,
    username: account.username,
    repliesQueued: 0,
    postsQueued: 0,
    followsQueued: 0,
    dmsQueued: 0,
    executed: 0,
    skipped: [],
  };

  if (!getXOAuthConfig()) {
    result.skipped.push("X API credentials not configured");
    return result;
  }

  const cooldown = await checkActionCooldown(
    accountId,
    effectiveLimits(settings).minMinutes,
    getLastActionAt
  );
  if (!cooldown.allowed) {
    result.skipped.push(cooldown.issues.join("; "));
    return result;
  }

  let client;
  try {
    client = await getAuthenticatedXClient(accountId);
  } catch {
    result.skipped.push("Invalid X token — reconnect account");
    return result;
  }

  const limits = effectiveLimits(settings);
  const keywords: string[] = JSON.parse(settings.targetKeywords);
  const targetAccounts: string[] = JSON.parse(settings.targetAccounts);
  const tones = parseToneMix(settings.toneMix);
  const recentReplyTones = await getRecentTones(accountId, "reply");
  const recentPostTones = await getRecentTones(accountId, "post");
  const recentPillarIds = await getRecentPillarIds(accountId);
  const productContext = settings.productContext ?? undefined;

  // ── Original posts ──
  if (settings.postsEnabled) {
    const postsToday = await countActionsToday(accountId, "post");
    const postsHour = await countActionsThisHour(accountId, "post");
    const rateCheck = validatePostAction(postsToday, postsHour, limits.maxPosts);

    if (!rateCheck.allowed) {
      result.skipped.push(rateCheck.issues.join("; "));
    } else {
      const pillar = pickNextPillar(recentPillarIds);
      const tone = pickNextTone(tones, recentPostTones);
      const draft = await generateOriginalPost(tone, pillar, productContext);
      const final = finalizePost(draft, settings.discloseAutomation);

      if (!final.compliance.allowed) {
        result.skipped.push(`Post blocked: ${final.compliance.issues.join(", ")}`);
      } else {
        const { status } = await queueAction(
          accountId,
          "post",
          {
            postText: final.text,
            tone: final.tone,
            pillarId: final.pillarId,
            pillarLabel: final.pillarLabel,
          },
          settings,
          final.engagementScore,
          JSON.stringify(final.compliance),
          options
        );
        result.postsQueued++;
        if (status === "approved") result.executed++;
      }
    }
  }

  // ── Strategic replies (threads + authority accounts) ──
  if (settings.repliesEnabled && settings.threadRepliesEnabled) {
    const repliesToday = await countActionsToday(accountId, "reply");
    const repliesHour = await countActionsThisHour(accountId, "reply");
    const rateCheck = validateReplyAction(repliesToday, repliesHour, limits.maxReplies);

    if (!rateCheck.allowed) {
      result.skipped.push(rateCheck.issues.join("; "));
    } else {
      const opportunities = await client.findThreadOpportunities(
        keywords,
        targetAccounts
      );

      for (const tweet of opportunities.slice(0, 4)) {
        const tone = pickNextTone(tones, recentReplyTones);
        recentReplyTones.push(tone);

        const draft = await generateStrategicReply(
          tweet,
          tone,
          productContext
        );
        const final = finalizeReply(draft, settings.discloseAutomation);

        if (!final.compliance.allowed) {
          result.skipped.push(
            `Reply to @${tweet.authorUsername} blocked: ${final.compliance.issues.join(", ")}`
          );
          continue;
        }

        const { status } = await queueAction(
          accountId,
          "reply",
          {
            tweetId: tweet.id,
            tweetText: tweet.text,
            authorUsername: tweet.authorUsername,
            authorId: tweet.authorId,
            replyText: final.text,
            tone: final.tone,
            tactic: tweet.tactic ?? "thread",
            opportunityScore: tweet.opportunityScore,
          },
          settings,
          final.engagementScore,
          JSON.stringify(final.compliance),
          options
        );
        result.repliesQueued++;
        if (status === "approved") result.executed++;

        // Queue warm DM if enabled and we just engaged publicly
        if (settings.dmsEnabled) {
          await maybeQueueWarmDm(
            accountId,
            tweet,
            final.text,
            settings,
            limits.maxDms,
            options
          ).then((queued) => {
            if (queued) result.dmsQueued++;
          });
        }
      }
    }
  }

  // ── Smart follows ──
  if (settings.followsEnabled) {
    const followsToday = await countActionsToday(accountId, "follow");
    const followsHour = await countActionsThisHour(accountId, "follow");
    const rateCheck = validateFollowAction(followsToday, followsHour, limits.maxFollows);

    if (!rateCheck.allowed) {
      result.skipped.push(rateCheck.issues.join("; "));
    } else {
      const candidates = await client.findFollowCandidates(keywords);

      for (const candidate of candidates.slice(0, 3)) {
        const { status } = await queueAction(
          accountId,
          "follow",
          {
            userId: candidate.userId,
            username: candidate.username,
            prospectScore: candidate.prospectScore,
            followBackScore: candidate.followBackScore,
            reason: candidate.reason,
          },
          settings,
          Math.round(
            ((candidate.prospectScore ?? 0) + (candidate.followBackScore ?? 0)) / 2
          ),
          "{}",
          options
        );
        result.followsQueued++;
        if (status === "approved") result.executed++;
      }
    }
  }

  return result;
}

async function maybeQueueWarmDm(
  accountId: string,
  tweet: ThreadOpportunity,
  replyText: string,
  settings: typeof automationSettings.$inferSelect,
  maxDms: number,
  options?: { dryRun?: boolean }
): Promise<boolean> {
  const dmsToday = await countActionsToday(accountId, "dm");
  const dmsHour = await countActionsThisHour(accountId, "dm");
  const rateCheck = validateDmAction(dmsToday, dmsHour, maxDms);
  if (!rateCheck.allowed) return false;

  const warmContext = `You replied to their tweet: "${tweet.text.slice(0, 120)}" with: "${replyText.slice(0, 120)}"`;
  const draft = await generateWarmDm(
    tweet.authorUsername,
    warmContext,
    settings.productContext ?? "",
    settings.websiteUrl ?? undefined
  );

  if (!draft.compliance.allowed) return false;

  const { status } = await queueAction(
    accountId,
    "dm",
    {
      userId: tweet.authorId,
      username: tweet.authorUsername,
      dmText: draft.text,
      warmReason: "Public reply engagement",
    },
    settings,
    draft.engagementScore,
    JSON.stringify(draft.compliance),
    options
  );

  return status === "approved" || status === "pending";
}

export async function executeQueueItem(queueId: string): Promise<boolean> {
  const [item] = await db
    .select()
    .from(automationQueue)
    .where(eq(automationQueue.id, queueId));

  if (!item || (item.status !== "approved" && item.status !== "pending")) {
    return false;
  }

  const [account] = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.id, item.accountId));

  if (!account) return false;

  try {
    const client = await getAuthenticatedXClient(item.accountId);
    const payload = JSON.parse(item.payload) as Record<string, string>;

    if (item.type === "reply") {
      const externalId = await client.postReply(payload.tweetId, payload.replyText);
      await db.insert(engagementLogs).values({
        id: uuid(),
        accountId: item.accountId,
        action: "reply",
        externalId,
        metadata: item.payload,
      });
    } else if (item.type === "follow") {
      await client.followUser(payload.userId);
      await db.insert(engagementLogs).values({
        id: uuid(),
        accountId: item.accountId,
        action: "follow",
        externalId: payload.userId,
        metadata: item.payload,
      });
    } else if (item.type === "post") {
      const externalId = await client.postTweet(payload.postText);
      await db.insert(engagementLogs).values({
        id: uuid(),
        accountId: item.accountId,
        action: "post",
        externalId,
        metadata: item.payload,
      });
    } else if (item.type === "dm") {
      const externalId = await client.sendDm(payload.userId, payload.dmText);
      await db.insert(engagementLogs).values({
        id: uuid(),
        accountId: item.accountId,
        action: "dm",
        externalId,
        metadata: item.payload,
      });
    }

    await db
      .update(automationQueue)
      .set({ status: "executed", executedAt: new Date() })
      .where(eq(automationQueue.id, queueId));

    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Execution failed";
    await db
      .update(automationQueue)
      .set({ status: "failed", errorMessage: message })
      .where(eq(automationQueue.id, queueId));
    return false;
  }
}

export async function runAllAutomations(): Promise<AutomationRunResult[]> {
  await ensureDb();
  const accounts = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.automationEnabled, true));

  const results: AutomationRunResult[] = [];
  for (const account of accounts) {
    if (account.platform !== "x") continue;
    try {
      results.push(await runAutomationForAccount(account.id));
    } catch (err) {
      results.push({
        accountId: account.id,
        username: account.username,
        repliesQueued: 0,
        postsQueued: 0,
        followsQueued: 0,
        dmsQueued: 0,
        executed: 0,
        skipped: [err instanceof Error ? err.message : "Unknown error"],
      });
    }
  }
  return results;
}

export async function seedDemoQueue(accountId: string): Promise<void> {
  await db.insert(automationQueue).values({
    id: uuid(),
    accountId,
    type: "reply",
    status: "pending",
    payload: JSON.stringify({
      tweetId: "demo-1",
      authorUsername: "levelsio",
      tweetText: "What's the hardest part of shipping as a solo founder?",
      replyText:
        "Honest answer: picking ONE repo to ship. I ran mine through RepoFuse — found 3 ideas I'd already half-built.",
      tone: "serious",
      tactic: "authority",
    }),
    engagementScore: 82,
    complianceNotes: JSON.stringify({ allowed: true, score: 95, issues: [], suggestions: [] }),
  });
}
