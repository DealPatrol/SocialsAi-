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
import {
  XApiClient,
  findFollowCandidates,
  buildSearchQuery,
} from "@/lib/x/client";
import {
  validateFollowAction,
  validatePostAction,
  validateReplyAction,
} from "@/lib/x/compliance";
import type { PillarId } from "@/lib/strategy";
import { getXOAuthConfig } from "@/lib/x/oauth";

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

async function countActionsToday(
  accountId: string,
  action: string
): Promise<number> {
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
  return row?.c ?? 0;
}

async function countActionsThisHour(
  accountId: string,
  action: string
): Promise<number> {
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
  return row?.c ?? 0;
}

async function getRecentTones(
  accountId: string,
  type: "reply" | "post" = "reply"
): Promise<ContentTone[]> {
  const items = await db
    .select({ payload: automationQueue.payload })
    .from(automationQueue)
    .where(
      and(
        eq(automationQueue.accountId, accountId),
        eq(automationQueue.type, type)
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
      and(
        eq(automationQueue.accountId, accountId),
        eq(automationQueue.type, "post")
      )
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

export interface AutomationRunResult {
  accountId: string;
  username: string;
  repliesQueued: number;
  postsQueued: number;
  followsQueued: number;
  executed: number;
  skipped: string[];
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

  if (!settings) {
    throw new Error("Automation settings missing");
  }

  const result: AutomationRunResult = {
    accountId,
    username: account.username,
    repliesQueued: 0,
    postsQueued: 0,
    followsQueued: 0,
    executed: 0,
    skipped: [],
  };

  const xConfigured = !!getXOAuthConfig();
  let client: XApiClient | null = null;

  if (xConfigured) {
    try {
      client = XApiClient.fromEncrypted(account.accessTokenEnc);
    } catch {
      result.skipped.push("Invalid X token — reconnect account");
      return result;
    }
  } else if (!options?.dryRun) {
    result.skipped.push("X API credentials not configured");
    return result;
  }

  const keywords: string[] = JSON.parse(settings.targetKeywords);
  const tones = parseToneMix(settings.toneMix);
  const recentReplyTones = await getRecentTones(accountId, "reply");
  const recentPostTones = await getRecentTones(accountId, "post");
  const recentPillarIds = await getRecentPillarIds(accountId);

  if (settings.postsEnabled) {
    const postsToday = await countActionsToday(accountId, "post");
    const postsHour = await countActionsThisHour(accountId, "post");
    const rateCheck = validatePostAction(
      postsToday,
      postsHour,
      settings.maxPostsPerDay
    );

    if (!rateCheck.allowed) {
      result.skipped.push(rateCheck.issues.join("; "));
    } else {
      const pillar = pickNextPillar(recentPillarIds);
      const tone = pickNextTone(tones, recentPostTones);

      const draft = await generateOriginalPost(
        tone,
        pillar,
        settings.productContext ?? undefined
      );
      const final = finalizePost(draft, settings.discloseAutomation);

      if (!final.compliance.allowed) {
        result.skipped.push(
          `Post blocked: ${final.compliance.issues.join(", ")}`
        );
      } else {
        const status =
          settings.mode === "auto" && !settings.requireApproval
            ? "approved"
            : "pending";

        const queueId = uuid();
        await db.insert(automationQueue).values({
          id: queueId,
          accountId,
          type: "post",
          status,
          payload: JSON.stringify({
            postText: final.text,
            tone: final.tone,
            pillarId: final.pillarId,
            pillarLabel: final.pillarLabel,
          }),
          engagementScore: final.engagementScore,
          complianceNotes: JSON.stringify(final.compliance),
          scheduledAt: status === "approved" ? new Date() : undefined,
        });
        result.postsQueued++;

        if (status === "approved" && !options?.dryRun && client) {
          const executed = await executeQueueItem(queueId);
          if (executed) result.executed++;
        } else if (status === "approved" && !client) {
          result.skipped.push("X API not configured — post queued only");
        }
      }
    }
  }

  if (settings.repliesEnabled && client) {
    const repliesToday = await countActionsToday(accountId, "reply");
    const repliesHour = await countActionsThisHour(accountId, "reply");
    const rateCheck = validateReplyAction(
      repliesToday,
      repliesHour,
      settings.maxRepliesPerDay
    );

    if (!rateCheck.allowed) {
      result.skipped.push(rateCheck.issues.join("; "));
    } else {
      const query = buildSearchQuery(keywords);
      const tweets = await client.searchRecentTweets(query, 8);

      for (const tweet of tweets.slice(0, 3)) {
        const tone = pickNextTone(tones, recentReplyTones);
        recentReplyTones.push(tone);

        const draft = await generateStrategicReply(
          tweet,
          tone,
          settings.productContext ?? undefined
        );
        const final = finalizeReply(draft, settings.discloseAutomation);

        if (!final.compliance.allowed) {
          result.skipped.push(
            `Reply to @${tweet.authorUsername} blocked: ${final.compliance.issues.join(", ")}`
          );
          continue;
        }

        const status =
          settings.mode === "auto" && !settings.requireApproval
            ? "approved"
            : "pending";

        const queueId = uuid();
        await db.insert(automationQueue).values({
          id: queueId,
          accountId,
          type: "reply",
          status,
          payload: JSON.stringify({
            tweetId: tweet.id,
            tweetText: tweet.text,
            authorUsername: tweet.authorUsername,
            replyText: final.text,
            tone: final.tone,
          }),
          engagementScore: final.engagementScore,
          complianceNotes: JSON.stringify(final.compliance),
          scheduledAt:
            status === "approved" ? new Date() : undefined,
        });
        result.repliesQueued++;

        if (status === "approved" && !options?.dryRun) {
          const executed = await executeQueueItem(queueId);
          if (executed) result.executed++;
        }
      }
    }
  }

  if (settings.followsEnabled && client) {
    const followsToday = await countActionsToday(accountId, "follow");
    const followsHour = await countActionsThisHour(accountId, "follow");
    const rateCheck = validateFollowAction(
      followsToday,
      followsHour,
      settings.maxFollowsPerDay
    );

    if (!rateCheck.allowed) {
      result.skipped.push(rateCheck.issues.join("; "));
    } else {
      const candidates = await findFollowCandidates(client, keywords);

      for (const candidate of candidates.slice(0, 2)) {
        const status =
          settings.mode === "auto" && !settings.requireApproval
            ? "approved"
            : "pending";

        const queueId = uuid();
        await db.insert(automationQueue).values({
          id: queueId,
          accountId,
          type: "follow",
          status,
          payload: JSON.stringify({
            userId: candidate.userId,
            username: candidate.username,
            prospectScore: candidate.prospectScore,
            reason: candidate.reason,
          }),
          engagementScore: candidate.prospectScore,
          scheduledAt: status === "approved" ? new Date() : undefined,
        });
        result.followsQueued++;

        if (status === "approved" && !options?.dryRun) {
          const executed = await executeQueueItem(queueId);
          if (executed) result.executed++;
        }
      }
    }
  }

  return result;
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
    const client = XApiClient.fromEncrypted(account.accessTokenEnc);
    const payload = JSON.parse(item.payload) as Record<string, string>;

    if (item.type === "reply") {
      const externalId = await client.postReply(
        payload.tweetId,
        payload.replyText
      );
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
        executed: 0,
        skipped: [
          err instanceof Error ? err.message : "Unknown error",
        ],
      });
    }
  }
  return results;
}

/** Demo mode: queue sample items without calling X API */
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
        "Honest answer: picking ONE repo to ship. I ran mine through RepoFuse — found 3 ideas I'd already half-built. Killed the analysis paralysis.",
      tone: "serious",
    }),
    engagementScore: 82,
    complianceNotes: JSON.stringify({ allowed: true, score: 95, issues: [], suggestions: [] }),
  });

  await db.insert(automationQueue).values({
    id: uuid(),
    accountId,
    type: "post",
    status: "pending",
    payload: JSON.stringify({
      postText:
        "Scanned 12 old repos last night. Found payment logic I'd forgotten, a half-built auth flow, and one idea that's honestly a $2k/mo niche SaaS. Your graveyard isn't dead — it's inventory.",
      tone: "informative",
      pillarId: "dev-pain-points",
      pillarLabel: "Developer Pain Points",
    }),
    engagementScore: 88,
    complianceNotes: JSON.stringify({ allowed: true, score: 95, issues: [], suggestions: [] }),
  });
}
