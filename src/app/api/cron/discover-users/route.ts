import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  searchUsersInNiche,
  calculateEngagementScore,
} from "@/lib/twitter";

export const maxDuration = 60; // 60 seconds for long-running task

export async function GET(request: Request) {
  try {
    // Verify CRON_SECRET
    const cronSecret = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const accessToken = process.env.TWITTER_OAUTH_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Twitter OAuth token not configured" },
        { status: 500 }
      );
    }

    // Get all users with niche keywords
    const { data: userRows, error: usersError } = await supabase
      .from("niche_keywords")
      .select("user_id");

    if (usersError || !userRows) {
      throw new Error(`Failed to fetch users: ${usersError?.message}`);
    }

    // De-duplicate user_ids in JS since PostgREST has no DISTINCT support
    const uniqueUserIds = Array.from(
      new Set(userRows.map((row) => row.user_id))
    );

    const stats = { discovered: 0, errors: 0, updated: 0 };

    // Process each user's keywords
    for (const user_id of uniqueUserIds) {
      try {
        // Get keywords for this user
        const { data: keywords, error: keywordsError } = await supabase
          .from("niche_keywords")
          .select("*")
          .eq("user_id", user_id);

        if (keywordsError || !keywords) {
          stats.errors++;
          continue;
        }

        // Search for users matching each keyword
        for (const kw of keywords) {
          try {
            // Random delay to avoid rate limiting
            await new Promise((resolve) =>
              setTimeout(resolve, Math.random() * 2000 + 1000)
            );

            const searchResults = await searchUsersInNiche(
              kw.keyword,
              accessToken,
              10
            );

            if ("error" in searchResults) {
              console.error(`[v0] Search error for ${kw.keyword}:`, searchResults.error);
              stats.errors++;
              continue;
            }

            // Process results
            for (const user of searchResults) {
              try {
                // Calculate engagement score
                const engagementScore = calculateEngagementScore({
                  followers_count: user.followers_count,
                  verified: user.verified,
                  bio: user.bio,
                });

                // Skip low-scoring users
                if (engagementScore < 30) continue;

                // Check if user already discovered
                const { data: existing } = await supabase
                  .from("user_discovery_candidates")
                  .select("id")
                  .eq("user_id", user_id)
                  .eq("target_twitter_id", user.id)
                  .single();

                if (existing) {
                  stats.updated++;
                  continue;
                }

                // Add new candidate
                await supabase.from("user_discovery_candidates").insert([
                  {
                    user_id,
                    target_twitter_id: user.id,
                    target_handle: user.username,
                    target_name: user.name,
                    target_bio: user.bio,
                    followers_count: user.followers_count,
                    engagement_score: engagementScore,
                    keyword_matched: kw.keyword,
                    status: "discovered",
                  },
                ]);

                stats.discovered++;
              } catch (err) {
                console.error(`[v0] Error processing user ${user.username}:`, err);
                stats.errors++;
              }
            }

            // Update keyword's last_searched timestamp
            await supabase
              .from("niche_keywords")
              .update({ last_searched: new Date().toISOString() })
              .eq("id", kw.id);
          } catch (err) {
            console.error(`[v0] Error searching keyword ${kw.keyword}:`, err);
            stats.errors++;
          }
        }
      } catch (err) {
        console.error(`[v0] Error processing user ${user_id}:`, err);
        stats.errors++;
      }
    }

    console.log("[v0] Cron: Discovery completed", stats);
    return NextResponse.json({
      success: true,
      stats,
      message: `Discovered ${stats.discovered} users, updated ${stats.updated}, ${stats.errors} errors`,
    });
  } catch (error) {
    console.error("[v0] Cron: Discovery error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
