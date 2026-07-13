import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { postTweet, TwitterPostResponse } from "@/lib/twitter";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.email || "unknown";
    const body = await req.json();
    const action = body.action as "dismiss" | "post";

    const supabase = await createClient();

    const { data: suggestion, error: fetchError } = await supabase
      .from("reply_suggestions")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (fetchError || !suggestion) {
      return NextResponse.json(
        { error: "Suggestion not found" },
        { status: 404 }
      );
    }

    if (suggestion.status !== "pending") {
      return NextResponse.json(
        { error: "Suggestion already resolved" },
        { status: 400 }
      );
    }

    if (action === "dismiss") {
      const { error: updateError } = await supabase
        .from("reply_suggestions")
        .update({ status: "dismissed" })
        .eq("id", id);

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to dismiss suggestion" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (action === "post") {
      const token = await getToken({ req });
      if (!token?.accessToken) {
        return NextResponse.json(
          { error: "Please log in with Twitter to post" },
          { status: 401 }
        );
      }

      const text: string = (body.text ?? suggestion.suggested_reply).trim();
      if (!text) {
        return NextResponse.json(
          { error: "Reply text is required" },
          { status: 400 }
        );
      }

      const result = await postTweet({
        text,
        reply_to_tweet_id: suggestion.target_tweet_id,
        accessToken: token.accessToken,
      });

      if ("code" in result) {
        return NextResponse.json(
          { error: result.message, details: result.details },
          { status: result.code }
        );
      }

      const successResult: TwitterPostResponse = result;

      await supabase
        .from("reply_suggestions")
        .update({
          status: "posted",
          posted_tweet_id: successResult.data.id,
        })
        .eq("id", id);

      return NextResponse.json({
        success: true,
        tweetId: successResult.data.id,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[v0] Suggestion action error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
