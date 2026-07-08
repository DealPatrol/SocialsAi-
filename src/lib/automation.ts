import { and, count, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db, ensureDb } from "@/lib/db";
import {
  automationQueue,
  automationSettings,
  dmTemplates,
  engagementTracking,
  postedTweets,
  socialAccounts,
} from "@/lib/db/schema";
import { getAuthenticatedXClient } from "@/lib/x/token";
import {
  validateDmContent,
  validateFollowAction,
  validateLikeAction,
  validatePostAction,
} from "@/lib/x/compliance";
import { executeQueueItem } from "@/lib/automation/engine";

const DEFAULT_DM_TEMPLATE =
  "Thanks for following, {{name}} — appreciate it. What are you building right now?";

type QueueTweetInput = {
  accountId: string;
  tweets: string[];
  source?: string;
  schedule?: "queue" | "now";
};

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

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function safeJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

async function countEngagementToday(accountId: string, action: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(engagementTracking)
    .where(
      and(
        eq(engagementTracking.accountId, accountId),
        eq(engagementTracking.action, action as typeof engagementTracking.$inferSelect.action),
        gte(engagementTracking.createdAt, startOfDay())
      )
    );
  return Number(row?.c ?? 0);
}

async function countEngagementThisHour(accountId: string, action: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(engagementTracking)
    .where(
      and(
        eq(engagementTracking.accountId, accountId),
        eq(engagementTracking.action, action as typeof engagementTracking.$inferSelect.action),
        gte(engagementTracking.createdAt, startOfHour())
      )
    );
  return Number(row?.c ?? 0);
}

async function getAccountSettings(accountId: string) {
  const [settings] = await db
    .select()
    .from(automationSettings)
    .where(eq(automationSettings.accountId, accountId));
  return settings;
}

export async function queueGeneratedTweets({
  accountId,
  tweets,
  source = "generator",
  schedule = "queue",
}: QueueTweetInput): Promise<{ queued: number; posted: number }> {
  await ensureDb();

  const [account] = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.id, accountId));
  if (!account) throw new Error("Account not found");

  const cleanTweets = tweets
    .map((tweet) => tweet.trim())
    .filter((tweet) => tweet.length > 0 && tweet.length <= 280);

  if (cleanTweets.length === 0) {
    throw new Error("No valid tweets to queue");
  }

  let queued = 0;
  let posted = 0;
  for (const tweet of cleanTweets) {
    const [duplicate] = await db
      .select({ id: postedTweets.id })
      .from(postedTweets)
      .where(and(eq(postedTweets.accountId, accountId), eq(postedTweets.text, tweet)))
      .limit(1);
    if (duplicate) continue;

    const id = uuid();
    await db.insert(automationQueue).values({
      id,
      accountId,
      type: "post",
      status: "pending",
      payload: JSON.stringify({
        postText: tweet,
        source,
        queuedBy: "user",
      }),
      complianceNotes: JSON.stringify({
        allowed: true,
        score: 100,
        issues: [],
        suggestions: [],
      }),
      scheduledAt: schedule === "now" ? new Date() : hoursFromNow(randomBetween(2, 4)),
    });
    queued++;

    if (schedule === "now") {
      const ok = await executeQueueItem(id);
      if (ok) posted++;
    }
  }

  return { queued, posted };
}

export async function postNextQueuedTweet(
  accountId?: string
): Promise<{ posted: boolean; queueId?: string; skipped?: string }> {
  await ensureDb();

  const conditions = [
    eq(automationQueue.type, "post"),
    inArray(automationQueue.status, ["pending", "approved"]),
    or(isNull(automationQueue.scheduledAt), lte(automationQueue.scheduledAt, new Date())),
  ];
  if (accountId) {
    conditions.push(eq(automationQueue.accountId, accountId));
  }

  const [item] = await db
    .select()
    .from(automationQueue)
    .where(and(...conditions))
    .orderBy(automationQueue.scheduledAt, automationQueue.createdAt)
    .limit(1);

  if (!item) return { posted: false, skipped: "No due queued tweets" };

  const settings = await getAccountSettings(item.accountId);
  if (!settings?.postsEnabled) {
    return { posted: false, skipped: "Posting automation disabled" };
  }

  const postsToday = await countEngagementToday(item.accountId, "post");
  const postsHour = await countEngagementThisHour(item.accountId, "post");
  const rate = validatePostAction(postsToday, postsHour, Math.min(settings.maxPostsPerDay, 3));
  if (!rate.allowed) {
    return { posted: false, queueId: item.id, skipped: rate.issues.join("; ") };
  }

  const ok = await executeQueueItem(item.id);
  return ok
    ? { posted: true, queueId: item.id }
    : { posted: false, queueId: item.id, skipped: "Post failed" };
}

export async function runEngagementAutomation(
  accountId?: string
): Promise<Array<{ accountId: string; liked: number; followsScheduled: number; followsExecuted: number; skipped: string[] }>> {
  await ensureDb();
  const accounts = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.automationEnabled, true));

  const results = [];
  for (const account of accounts.filter((a) => !accountId || a.id === accountId)) {
    const skipped: string[] = [];
    let liked = 0;
    let followsScheduled = 0;
    let followsExecuted = 0;
    const settings = await getAccountSettings(account.id);
    if (!settings || account.platform !== "x") continue;

    const client = await getAuthenticatedXClient(account.id);

    if (settings.likesEnabled) {
      const likesToday = await countEngagementToday(account.id, "like");
      const likesHour = await countEngagementThisHour(account.id, "like");
      const rate = validateLikeAction(likesToday, likesHour, Math.min(settings.maxLikesPerDay, 3));
      if (rate.allowed) {
        const targetAccounts = safeJsonArray(settings.targetAccounts).slice(0, 5);
        for (const handle of targetAccounts) {
          const profile = await client.lookupUserByUsername(handle);
          if (!profile) continue;
          const tweets = await client.getRecentTweetsByUser(profile.id, 5);
          const tweet = tweets.find((t) => t.authorId !== account.platformUserId);
          if (!tweet) continue;

          const [already] = await db
            .select({ id: engagementTracking.id })
            .from(engagementTracking)
            .where(
              and(
                eq(engagementTracking.accountId, account.id),
                eq(engagementTracking.action, "like"),
                eq(engagementTracking.targetTweetId, tweet.id)
              )
            )
            .limit(1);
          if (already) continue;

          await client.likeTweet(tweet.id);
          await db.insert(engagementTracking).values({
            id: uuid(),
            accountId: account.id,
            action: "like",
            status: "executed",
            targetUserId: tweet.authorId,
            targetUsername: tweet.authorUsername,
            targetTweetId: tweet.id,
            reason: "Target account recent tweet",
            executedAt: new Date(),
            metadata: { tweetText: tweet.text },
          });
          liked++;
          break;
        }
      } else {
        skipped.push(rate.issues.join("; "));
      }
    }

    if (settings.followsEnabled) {
      const followsToday = await countEngagementToday(account.id, "follow");
      const followsHour = await countEngagementThisHour(account.id, "follow");
      const rate = validateFollowAction(followsToday, followsHour, Math.min(settings.maxFollowsPerDay, 2));

      if (rate.allowed) {
        const [dueFollow] = await db
          .select()
          .from(engagementTracking)
          .where(
            and(
              eq(engagementTracking.accountId, account.id),
              eq(engagementTracking.action, "follow"),
              eq(engagementTracking.status, "scheduled"),
              lte(engagementTracking.scheduledAt, new Date())
            )
          )
          .orderBy(engagementTracking.scheduledAt)
          .limit(1);

        if (dueFollow?.targetUserId) {
          await client.followUser(dueFollow.targetUserId);
          await db
            .update(engagementTracking)
            .set({ status: "executed", executedAt: new Date() })
            .where(eq(engagementTracking.id, dueFollow.id));
          followsExecuted++;
        } else {
          const candidates = await client.findFollowCandidates(
            safeJsonArray(settings.targetKeywords)
          );
          for (const candidate of candidates.slice(0, 3)) {
            const [existing] = await db
              .select({ id: engagementTracking.id })
              .from(engagementTracking)
              .where(
                and(
                  eq(engagementTracking.accountId, account.id),
                  eq(engagementTracking.action, "follow"),
                  eq(engagementTracking.targetUserId, candidate.userId)
                )
              )
              .limit(1);
            if (existing) continue;

            await db.insert(engagementTracking).values({
              id: uuid(),
              accountId: account.id,
              action: "follow",
              status: "scheduled",
              targetUserId: candidate.userId,
              targetUsername: candidate.username,
              reason: candidate.reason,
              scheduledAt: hoursFromNow(randomBetween(48, 72)),
              metadata: {
                prospectScore: candidate.prospectScore,
                followBackScore: candidate.followBackScore,
              },
            });
            followsScheduled++;
            break;
          }
        }
      } else {
        skipped.push(rate.issues.join("; "));
      }
    }

    results.push({
      accountId: account.id,
      liked,
      followsScheduled,
      followsExecuted,
      skipped,
    });
  }
  return results;
}

function renderDmTemplate(
  template: string,
  follower: { name: string; username: string; description?: string }
): string {
  return template
    .replaceAll("{{name}}", follower.name || follower.username)
    .replaceAll("{{username}}", follower.username)
    .replaceAll("{{bio}}", follower.description ?? "")
    .trim();
}

export async function sendScheduledDms(
  accountId?: string
): Promise<Array<{ accountId: string; sent: number; skipped: string[] }>> {
  await ensureDb();
  const accounts = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.automationEnabled, true));

  const results = [];
  for (const account of accounts.filter((a) => !accountId || a.id === accountId)) {
    const skipped: string[] = [];
    let sent = 0;
    const settings = await getAccountSettings(account.id);
    if (!settings?.dmsEnabled || account.platform !== "x") continue;

    const client = await getAuthenticatedXClient(account.id);
    const followers = await client.getFollowers(25);
    for (const follower of followers) {
      const [seen] = await db
        .select()
        .from(engagementTracking)
        .where(
          and(
            eq(engagementTracking.accountId, account.id),
            eq(engagementTracking.action, "follower_seen"),
            eq(engagementTracking.targetUserId, follower.id)
          )
        )
        .limit(1);
      if (seen) continue;

      await db.insert(engagementTracking).values({
        id: uuid(),
        accountId: account.id,
        action: "follower_seen",
        status: "scheduled",
        targetUserId: follower.id,
        targetUsername: follower.username,
        scheduledAt: hoursFromNow(randomBetween(24, 48)),
        metadata: { name: follower.name, description: follower.description },
      });
    }

    const dmsToday = await countEngagementToday(account.id, "dm");
    const dmsHour = await countEngagementThisHour(account.id, "dm");
    if (dmsToday >= Math.min(settings.maxDmsPerDay, 2) || dmsHour >= 1) {
      skipped.push("DM rate limit reached");
      results.push({ accountId: account.id, sent, skipped });
      continue;
    }

    const [due] = await db
      .select()
      .from(engagementTracking)
      .where(
        and(
          eq(engagementTracking.accountId, account.id),
          eq(engagementTracking.action, "follower_seen"),
          eq(engagementTracking.status, "scheduled"),
          lte(engagementTracking.scheduledAt, new Date())
        )
      )
      .orderBy(engagementTracking.scheduledAt)
      .limit(1);

    if (!due?.targetUserId || !due.targetUsername) {
      results.push({ accountId: account.id, sent, skipped });
      continue;
    }

    const [template] = settings.dmTemplateId
      ? await db
          .select()
          .from(dmTemplates)
          .where(eq(dmTemplates.id, settings.dmTemplateId))
          .limit(1)
      : await db
          .select()
          .from(dmTemplates)
          .where(and(eq(dmTemplates.accountId, account.id), eq(dmTemplates.active, true)))
          .orderBy(desc(dmTemplates.createdAt))
          .limit(1);

    const metadata = (due.metadata ?? {}) as { name?: string; description?: string };
    const text = renderDmTemplate(template?.template ?? DEFAULT_DM_TEMPLATE, {
      name: metadata.name ?? due.targetUsername,
      username: due.targetUsername,
      description: metadata.description,
    });
    const compliance = validateDmContent(text);
    if (!compliance.allowed) {
      await db
        .update(engagementTracking)
        .set({ status: "skipped", reason: compliance.issues.join("; ") })
        .where(eq(engagementTracking.id, due.id));
      skipped.push(compliance.issues.join("; "));
      results.push({ accountId: account.id, sent, skipped });
      continue;
    }

    const externalId = await client.sendDm(due.targetUserId, text);
    await db.insert(engagementTracking).values({
      id: uuid(),
      accountId: account.id,
      action: "dm",
      status: "executed",
      targetUserId: due.targetUserId,
      targetUsername: due.targetUsername,
      reason: "Delayed new-follower welcome",
      executedAt: new Date(),
      metadata: { text, externalId },
    });
    await db
      .update(engagementTracking)
      .set({ status: "executed", executedAt: new Date() })
      .where(eq(engagementTracking.id, due.id));
    sent++;
    results.push({ accountId: account.id, sent, skipped });
  }
  return results;
}

export async function getAutomationStatus(userId: string) {
  await ensureDb();
  const accounts = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.userId, userId));
  const ids = accounts.map((a) => a.id);

  if (ids.length === 0) {
    return { accounts: [], queue: [], postedTweets: [], engagement: [] };
  }

  const queue = await db
    .select()
    .from(automationQueue)
    .where(inArray(automationQueue.accountId, ids))
    .orderBy(desc(automationQueue.createdAt))
    .limit(50);
  const posted = await db
    .select()
    .from(postedTweets)
    .where(inArray(postedTweets.accountId, ids))
    .orderBy(desc(postedTweets.postedAt))
    .limit(50);
  const engagement = await db
    .select()
    .from(engagementTracking)
    .where(inArray(engagementTracking.accountId, ids))
    .orderBy(desc(engagementTracking.createdAt))
    .limit(100);

  return { accounts, queue, postedTweets: posted, engagement };
}
