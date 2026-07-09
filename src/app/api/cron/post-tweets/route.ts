import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { postTweet } from "@/lib/twitter";

// Verify cron secret
const CRON_SECRET = process.env.CRON_SECRET || "development";

export async function POST(request: NextRequest) {
  // Verify this is a legitimate Vercel cron request
  if (request.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all pending tweets from automation queue
    const { data: queuedTweets, error: fetchError } = await supabase
      .from("automation_queue")
      .select("*")
      .eq("status", "pending")
      .lt("scheduled_for", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(10); // Process max 10 per run

    if (fetchError) {
      console.error("[v0] Cron: Error fetching queue", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch queue", details: fetchError },
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

    let posted = 0;
    let failed = 0;

    // Process each tweet
    for (const tweet of queuedTweets) {
      try {
        // Get user's access token from auth table
        const { data: authData, error: authError } = await supabase
          .from("auth_sessions")
          .select("access_token")
          .eq("user_id", tweet.user_id)
          .single();

        if (authError || !authData?.access_token) {
          // Mark as failed - no access token
          await supabase
            .from("automation_queue")
            .update({
              status: "failed",
              error_message: "User access token expired or not found",
            })
            .eq("id", tweet.id);

          failed++;
          continue;
        }

        // Post the tweet
        const result = await postTweet({
          text: tweet.tweet_content,
          accessToken: authData.access_token,
        });

        if ("data" in result && result.data?.id) {
          // Success
          await supabase
            .from("automation_queue")
            .update({
              status: "posted",
              posted_at: new Date().toISOString(),
            })
            .eq("id", tweet.id);

          posted++;
        } else {
          // Failed
          const error = result as { message?: string };
          await supabase
            .from("automation_queue")
            .update({
              status: "failed",
              error_message: error.message || "Unknown error",
            })
            .eq("id", tweet.id);

          failed++;
        }
      } catch (error) {
        console.error("[v0] Cron: Error posting tweet", error);
        await supabase
          .from("automation_queue")
          .update({
            status: "failed",
            error_message:
              error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", tweet.id);

        failed++;
      }

      // Add random delay between 2-8 seconds to look natural
      const delay = Math.random() * 6000 + 2000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    console.log(
      `[v0] Cron: Tweet posting complete. Posted: ${posted}, Failed: ${failed}`
    );

    return NextResponse.json({
      success: true,
      processed: posted + failed,
      posted,
      failed,
    });
  } catch (error) {
    console.error("[v0] Cron: Error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
