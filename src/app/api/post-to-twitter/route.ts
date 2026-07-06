import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { postTweet, validateTweet, TwitterPostResponse } from "@/lib/twitter";

export interface PostToTwitterRequest {
  text: string;
  replyToTweetId?: string;
}

export interface PostToTwitterResponse {
  success: boolean;
  tweetId?: string;
  error?: string;
  details?: string;
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication and retrieve access token from the JWT
    const token = await getToken({ req });
    if (!token?.accessToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unauthorized. Please log in with Twitter to post tweets.",
        },
        { status: 401 }
      );
    }

    const body: PostToTwitterRequest = await req.json();

    // Validate request
    if (!body.text?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Tweet text is required",
        },
        { status: 400 }
      );
    }

    // Validate tweet guidelines
    const validation = validateTweet(body.text);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
        },
        { status: 400 }
      );
    }

    // Post tweet using user's access token
    const result = await postTweet({
      text: body.text,
      reply_to_tweet_id: body.replyToTweetId,
      accessToken: token.accessToken,
    });

    // Check if response is an error
    if ("code" in result) {
      return NextResponse.json(
        {
          success: false,
          error: result.message,
          details: result.details,
        },
        { status: result.code }
      );
    }

    // Success response — TypeScript narrows result to TwitterPostResponse here
    const successResult: TwitterPostResponse = result;
    return NextResponse.json({
      success: true,
      tweetId: successResult.data.id,
    });
  } catch (err) {
    console.error("[v0] Post to Twitter error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: `Failed to post tweet: ${message}`,
      },
      { status: 500 }
    );
  }
}
