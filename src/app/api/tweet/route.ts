import { NextRequest, NextResponse } from "next/server";
import { postTweets } from "@/lib/twitter";
import { cookies } from "next/headers";

export interface TweetRequest {
  tweets: string[];
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("twitter_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ error: "Not connected to Twitter" }, { status: 401 });
  }

  const body: TweetRequest = await req.json();
  if (!body.tweets?.length) {
    return NextResponse.json({ error: "tweets array is required" }, { status: 400 });
  }

  try {
    const tweetId = await postTweets(accessToken, body.tweets);
    return NextResponse.json({ tweetId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to post";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
