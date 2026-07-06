import { TwitterApi } from "twitter-api-v2";

export function getOAuthClient() {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET must be set");
  }

  return new TwitterApi({ clientId, clientSecret });
}

export async function postTweets(accessToken: string, tweets: string[]): Promise<string> {
  const client = new TwitterApi(accessToken).readWrite;
  let replyToId: string | undefined;

  for (const text of tweets) {
    const { data } = await client.v2.tweet({
      text,
      ...(replyToId ? { reply: { in_reply_to_tweet_id: replyToId } } : {}),
    });
    replyToId = data.id;
  }

  return replyToId!;
}
