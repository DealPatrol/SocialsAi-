import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/utils/supabase/admin";
import { postTweet } from "@/lib/twitter";
import {
  getValidAccessToken,
  refreshStoredAccessToken,
} from "@/lib/x-accounts";

export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "development";

type QueueRow = {
  id: string;
  user_id: string;
  tweet_content: string;
  scheduled_for: string;
};

type SettingsRow = {
  user_id: string;
  auto_post_enabled: boolean;
  post_interval_hours: number | null;
};

function isAuthorized(request: NextRequest): boolean {
  return request.headers.get("authorization") === `Bearer ${CRON_SECRET}`;
}

function isCreditsError(message?: string): boolean {
  if (!message) return false;
  return /credits? depleted|402/i.test(message);
}

async function runPostTweets() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Supabase service role is not configured" },
      { status: 500 }
    );
  }

  const supabase = createAdminClient();

  const { data: queuedTweets, error: fetchError } = await supabase
    .from("automation_queue")
    .select("id, user_id, tweet_content, scheduled_for")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(10);

  if (fetchError) {
    console.error("[v0] Cron: Error fetching queue", fetchError);
    return NextResponse.json(
      { error: "Failed to fetch queue", details: fetchError.message },
      { status: 500 }
    );
  }

  if (!queuedTweets || queuedTweets.length === 0) {
    return NextResponse.json({
      success: true,
      processed: 0,
      message: "No tweets to post",
    });
  }

  const userIds = [...new Set(queuedTweets.map((t: QueueRow) => t.user_id))];
  const { data: settingsRows, error: settingsError } = await supabase
    .from("automation_settings")
    .select("user_id, auto_post_enabled, post_interval_hours")
    .in("user_id", userIds);

  if (settingsError) {
    console.error("[v0] Cron: Error fetching settings", settingsError);
    return NextResponse.json(
      { error: "Failed to fetch settings", details: settingsError.message },
      { status: 500 }
    );
  }

  const settingsByUser = new Map<string, SettingsRow>(
    (settingsRows ?? []).map((row: SettingsRow) => [row.user_id, row])
  );

  let posted = 0;
  let failed = 0;
  let skipped = 0;
  const lastPostedAt = new Map<string, number>();
  const tokenCache = new Map<string, string | null>();
  const disabledUsers = new Set<string>();
  const depletedUsers = new Set<string>();

  for (const tweet of queuedTweets as QueueRow[]) {
    const settings = settingsByUser.get(tweet.user_id);
    if (!settings?.auto_post_enabled) {
      skipped++;
      continue;
    }

    if (depletedUsers.has(tweet.user_id) || disabledUsers.has(tweet.user_id)) {
      skipped++;
      continue;
    }

    const intervalHours = Math.max(settings.post_interval_hours ?? 3, 2);
    if (!lastPostedAt.has(tweet.user_id)) {
      const { data: lastPosted } = await supabase
        .from("automation_queue")
        .select("posted_at")
        .eq("user_id", tweet.user_id)
        .eq("status", "posted")
        .order("posted_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ posted_at: string | null }>();
      lastPostedAt.set(
        tweet.user_id,
        lastPosted?.posted_at ? new Date(lastPosted.posted_at).getTime() : 0
      );
    }

    const lastAt = lastPostedAt.get(tweet.user_id) ?? 0;
    if (lastAt && Date.now() - lastAt < intervalHours * 60 * 60 * 1000) {
      skipped++;
      continue;
    }

    if (!tokenCache.has(tweet.user_id)) {
      try {
        tokenCache.set(tweet.user_id, await getValidAccessToken(tweet.user_id));
      } catch (error) {
        console.error("[v0] Cron: Token load failed", error);
        tokenCache.set(tweet.user_id, null);
      }
    }

    let accessToken = tokenCache.get(tweet.user_id);
    if (!accessToken) {
      await supabase
        .from("automation_queue")
        .update({
          status: "failed",
          error_message:
            "No stored X access token. Sign in with Twitter once so Auto Post can publish as you.",
        })
        .eq("id", tweet.id);
      failed++;
      disabledUsers.add(tweet.user_id);
      continue;
    }

    const text = tweet.tweet_content?.trim();
    if (!text) {
      await supabase
        .from("automation_queue")
        .update({
          status: "failed",
          error_message: "Queued tweet is missing tweet_content",
        })
        .eq("id", tweet.id);
      failed++;
      continue;
    }

    try {
      let result = await postTweet({ text, accessToken });

      if ("code" in result && result.code === 401) {
        const refreshed = await refreshStoredAccessToken(tweet.user_id);
        if (refreshed) {
          accessToken = refreshed;
          tokenCache.set(tweet.user_id, refreshed);
          result = await postTweet({ text, accessToken });
        }
      }

      if ("data" in result && result.data?.id) {
        await supabase
          .from("automation_queue")
          .update({
            status: "posted",
            posted_at: new Date().toISOString(),
            posted_tweet_id: result.data.id,
            error_message: null,
          })
          .eq("id", tweet.id);

        lastPostedAt.set(tweet.user_id, Date.now());
        posted++;
      } else {
        const error = result as { message?: string; details?: string; code?: number };
        const message = [error.message, error.details].filter(Boolean).join(" — ");
        await supabase
          .from("automation_queue")
          .update({
            status: "failed",
            error_message: message || "Unknown error",
          })
          .eq("id", tweet.id);

        failed++;
        if (error.code === 402 || isCreditsError(message)) {
          depletedUsers.add(tweet.user_id);
        }
      }
    } catch (error) {
      console.error("[v0] Cron: Error posting tweet", error);
      const message =
        error instanceof Error ? error.message : "Unknown error";
      await supabase
        .from("automation_queue")
        .update({
          status: "failed",
          error_message: message,
        })
        .eq("id", tweet.id);
      failed++;
      if (isCreditsError(message)) {
        depletedUsers.add(tweet.user_id);
      }
    }

    const delay = Math.random() * 6000 + 2000;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  console.log(
    `[v0] Cron: Tweet posting complete. Posted: ${posted}, Failed: ${failed}, Skipped: ${skipped}`
  );

  return NextResponse.json({
    success: true,
    processed: posted + failed,
    posted,
    failed,
    skipped,
  });
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await runPostTweets();
  } catch (error) {
    console.error("[v0] Cron: Error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
