import { TwitterApi } from "twitter-api-v2";

export function getOAuthClient() {
  return new TwitterApi({
    clientId: process.env.TWITTER_CLIENT_ID!,
    clientSecret: process.env.TWITTER_CLIENT_SECRET!,
  });
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
