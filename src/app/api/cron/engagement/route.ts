import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  followUser,
  likeTweet,
  sendDM,
  getUserProfile,
  personalizeDMTemplate,
} from "@/lib/twitter";

const CRON_SECRET = process.env.CRON_SECRET || "development";

export async function POST(request: NextRequest) {
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

    // Get all users with automation enabled
    const { data: users, error: usersError } = await supabase
      .from("automation_settings")
      .select("user_id, max_likes_per_day, max_follows_per_day, max_dms_per_day, follow_delay_days, dm_delay_hours")
      .eq("auto_follow_enabled", true)
      .or("auto_like_enabled.eq.true,auto_dm_enabled.eq.true");

    if (usersError) {
      console.error("[v0] Cron: Error fetching users", usersError);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "No users with engagement automation enabled",
      });
    }

    const stats = { follows: 0, likes: 0, dms: 0, errors: 0 };

    // Process each user
    for (const user of users) {
      try {
        // Get user's access token
        const { data: authData } = await supabase
          .from("auth_sessions")
          .select("access_token")
          .eq("user_id", user.user_id)
          .single();

        if (!authData?.access_token) {
          stats.errors++;
          continue;
        }

        // Get target accounts
        const { data: targetAccounts } = await supabase
          .from("target_accounts")
          .select("twitter_id, account_handle")
          .eq("user_id", user.user_id);

        if (!targetAccounts || targetAccounts.length === 0) {
          continue;
        }

        // Check today's engagement history
        const today = new Date().toISOString().split("T")[0];
        const { data: todayHistory } = await supabase
          .from("engagement_history")
          .select("action_type")
          .eq("user_id", user.user_id)
          .gte("action_date", `${today}T00:00:00Z`);

        const likesCount = todayHistory?.filter(
          (h) => h.action_type === "like"
        ).length || 0;
        const followsCount = todayHistory?.filter(
          (h) => h.action_type === "follow"
        ).length || 0;
        const dmsCount = todayHistory?.filter(
          (h) => h.action_type === "dm"
        ).length || 0;

        // Random action: follow (40%), like (40%), dm (20%)
        const action = Math.random();
        const maxLikes = user.max_likes_per_day || 3;
        const maxFollows = user.max_follows_per_day || 2;
        const maxDMs = user.max_dms_per_day || 2;

        if (action < 0.4 && followsCount < maxFollows) {
          // Do a follow
          const randomTarget =
            targetAccounts[Math.floor(Math.random() * targetAccounts.length)];
          const followResult = await followUser(
            randomTarget.twitter_id,
            authData.access_token
          );

          if (followResult.success) {
            await supabase.from("engagement_history").insert({
              user_id: user.user_id,
              target_user_id: randomTarget.twitter_id,
              action_type: "follow",
            });
            stats.follows++;
          }
        } else if (action < 0.8 && likesCount < maxLikes) {
          // Do a like
          const randomTarget =
            targetAccounts[Math.floor(Math.random() * targetAccounts.length)];
          const likeResult = await likeTweet(
            randomTarget.twitter_id,
            authData.access_token
          );

          if (likeResult.success) {
            await supabase.from("engagement_history").insert({
              user_id: user.user_id,
              target_user_id: randomTarget.twitter_id,
              action_type: "like",
              tweet_id: randomTarget.twitter_id,
            });
            stats.likes++;
          }
        } else if (dmsCount < maxDMs) {
          // Do a DM
          const randomTarget =
            targetAccounts[Math.floor(Math.random() * targetAccounts.length)];

          // Get DM template
          const { data: templates } = await supabase
            .from("dm_templates")
            .select("template")
            .eq("user_id", user.user_id)
            .limit(1);

          if (templates && templates.length > 0) {
            // Get user profile for personalization
            const profile = await getUserProfile(
              randomTarget.twitter_id,
              authData.access_token
            );

            let message = templates[0].template;
            if ("name" in profile) {
              message = personalizeDMTemplate(message, {
                name: profile.name,
                username: profile.username,
                bio: profile.bio,
                followers_count: profile.followers_count,
              });
            }

            const dmResult = await sendDM(
              randomTarget.twitter_id,
              message,
              authData.access_token
            );

            if (dmResult.success) {
              await supabase.from("engagement_history").insert({
                user_id: user.user_id,
                target_user_id: randomTarget.twitter_id,
                action_type: "dm",
              });
              stats.dms++;
            }
          }
        }
      } catch (error) {
        console.error("[v0] Cron: Error processing user engagement", error);
        stats.errors++;
      }

      // Random delay between 3-10 seconds between users to avoid rate limits
      const delay = Math.random() * 7000 + 3000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    console.log(
      `[v0] Cron: Engagement complete. Follows: ${stats.follows}, Likes: ${stats.likes}, DMs: ${stats.dms}, Errors: ${stats.errors}`
    );

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("[v0] Cron: Error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
