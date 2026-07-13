import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient } from "@/lib/anthropic";
import { getRecentTweetsByHandle, validateTweet } from "@/lib/twitter";
import { PRODUCT_CONTEXT, TARGET_ACCOUNTS, VOICE_GUIDELINES } from "@/lib/strategy";

const CRON_SECRET = process.env.CRON_SECRET || "development";

// How many target accounts to check for fresh tweets per cron run. Kept
// small and read-only to stay well under Twitter API rate limits.
const ACCOUNTS_PER_RUN = 3;

async function draftReply(tweetText: string): Promise<string | null> {
  const client = getAnthropicClient();

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: `You are drafting a strategic reply for ${PRODUCT_CONTEXT.name} (${PRODUCT_CONTEXT.tagline}).

Voice guidelines:
${VOICE_GUIDELINES}

Output only the reply text, under 280 characters, no explanations or meta-commentary.`,
    messages: [
      {
        role: "user",
        content: `Draft one thoughtful reply to this tweet:\n\n"${tweetText}"\n\nIt must add a genuine insight or data point — never a generic compliment like "Great post!". Weave in ${PRODUCT_CONTEXT.name} only if it fits naturally.`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text.trim() : "";

  if (!text || !validateTweet(text).valid) {
    return null;
  }

  return text;
}

/**
 * Drafts reply suggestions from public tweets of target accounts using
 * Claude, for a human to review and post themselves. This never follows,
 * likes, or DMs anyone, and never posts anything automatically — it only
 * reads public tweets and writes draft suggestions to the database.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: users, error: usersError } = await supabase
      .from("automation_settings")
      .select("user_id, max_suggestions_per_day")
      .eq("suggestions_enabled", true);

    if (usersError) {
      console.error("[v0] Cron: Error fetching users", usersError);
      return NextResponse.json(
        { error: "Failed to fetch users", details: usersError },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        drafted: 0,
        message: "No users with reply suggestions enabled",
      });
    }

    const readToken = process.env.TWITTER_OAUTH_ACCESS_TOKEN;
    if (!readToken) {
      return NextResponse.json(
        { error: "Twitter OAuth token not configured" },
        { status: 500 }
      );
    }

    const accounts = [...TARGET_ACCOUNTS]
      .sort(() => Math.random() - 0.5)
      .slice(0, ACCOUNTS_PER_RUN);

    let drafted = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
      const today = new Date().toISOString().split("T")[0];
      const { count: todayCount, error: countError } = await supabase
        .from("reply_suggestions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.user_id)
        .gte("created_at", `${today}T00:00:00Z`);

      if (countError) {
        console.error("[v0] Cron: Error counting today's suggestions", countError);
        errors++;
        continue;
      }

      const maxPerDay = user.max_suggestions_per_day || 5;
      let remaining = maxPerDay - (todayCount || 0);
      if (remaining <= 0) {
        skipped++;
        continue;
      }

      for (const account of accounts) {
        if (remaining <= 0) break;

        const recent = await getRecentTweetsByHandle(account.handle, readToken);
        if ("error" in recent || recent.tweets.length === 0) {
          continue;
        }

        const tweet = recent.tweets[0];

        try {
          const suggestedReply = await draftReply(tweet.text);
          if (!suggestedReply) continue;

          const { error: insertError } = await supabase
            .from("reply_suggestions")
            .insert({
              user_id: user.user_id,
              target_handle: account.handle,
              target_tweet_id: tweet.id,
              target_tweet_text: tweet.text,
              suggested_reply: suggestedReply,
              status: "pending",
            });

          if (insertError) {
            // 23505 = unique_violation: a suggestion for this tweet was
            // already drafted (unique constraint on user_id +
            // target_tweet_id) — expected, not a real error.
            if (insertError.code !== "23505") {
              console.error("[v0] Cron: Error inserting suggestion", insertError);
              errors++;
            }
            continue;
          }

          drafted++;
          remaining--;
        } catch (error) {
          console.error("[v0] Cron: Error drafting suggestion", error);
          errors++;
        }
      }
    }

    console.log(
      `[v0] Cron: Suggestion drafting complete. Drafted: ${drafted}, Skipped: ${skipped}, Errors: ${errors}`
    );

    return NextResponse.json({ success: true, drafted, skipped, errors });
  } catch (error) {
    console.error("[v0] Cron: Error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
