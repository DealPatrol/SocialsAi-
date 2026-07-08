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
  if (tweets.length === 0) {
    throw new Error("At least one tweet is required");
  }

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

export async function followUser(
  accessToken: string,
  targetUserId: string
): Promise<void> {
  const client = new TwitterApi(accessToken).readWrite;
  const me = await client.v2.me();
  await client.v2.follow(me.data.id, targetUserId);
}

export async function likeTweet(
  accessToken: string,
  tweetId: string
): Promise<void> {
  const client = new TwitterApi(accessToken).readWrite;
  const me = await client.v2.me();
  await client.v2.like(me.data.id, tweetId);
}

export async function sendDM(
  accessToken: string,
  participantId: string,
  text: string
): Promise<string> {
  const client = new TwitterApi(accessToken).readWrite;
  const result = (await client.v2.sendDmToParticipant(participantId, {
    text,
  })) as unknown as { data?: { dm_event_id?: string }; dm_event_id?: string };
  return result.data?.dm_event_id ?? result.dm_event_id ?? "";
}

export async function getUserProfile(
  accessToken: string,
  userId: string
): Promise<{
  id: string;
  username?: string;
  name?: string;
  description?: string;
} | null> {
  const client = new TwitterApi(accessToken).readOnly;
  try {
    const { data } = await client.v2.user(userId, {
      "user.fields": ["username", "name", "description"],
    });
    return data;
  } catch {
    return null;
  }
}
