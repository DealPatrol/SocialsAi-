import { decrypt } from "@/lib/encryption";
import {
  buildKeywordQuery,
  buildTargetAccountQuery,
  buildThreadQuery,
  rankFollowCandidates,
  rankThreadOpportunities,
  scoreFollowCandidate,
  scoreThreadOpportunity,
} from "@/lib/x/growth";
import type {
  FollowCandidate,
  ThreadOpportunity,
  TweetCandidate,
} from "@/lib/platforms/types";

const X_API = "https://api.x.com/2";

type RawTweet = {
  id: string;
  text: string;
  author_id: string;
  public_metrics?: {
    like_count?: number;
    reply_count?: number;
    retweet_count?: number;
  };
};

export class XApiClient {
  private meId: string | null = null;

  constructor(private accessToken: string) {}

  static fromEncrypted(accessTokenEnc: string): XApiClient {
    return new XApiClient(decrypt(accessTokenEnc));
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${X_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`X API ${res.status}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  private mapTweets(
    data: {
      data?: RawTweet[];
      includes?: { users?: Array<{ id: string; username: string }> };
    },
    meta?: { tactic?: TweetCandidate["tactic"]; isTarget?: boolean }
  ): TweetCandidate[] {
    const users = new Map(
      (data.includes?.users ?? []).map((u) => [u.id, u.username])
    );

    return (data.data ?? []).map((t) => ({
      id: t.id,
      text: t.text,
      authorId: t.author_id,
      authorUsername: users.get(t.author_id) ?? "unknown",
      likeCount: t.public_metrics?.like_count,
      replyCount: t.public_metrics?.reply_count,
      isThreadRoot: true,
      isFromTargetAccount: meta?.isTarget,
      tactic: meta?.tactic,
    }));
  }

  async searchRecentTweets(
    query: string,
    maxResults = 10,
    meta?: { tactic?: TweetCandidate["tactic"]; isTarget?: boolean }
  ): Promise<TweetCandidate[]> {
    const params = new URLSearchParams({
      query,
      max_results: String(Math.min(maxResults, 100)),
      "tweet.fields": "public_metrics,author_id,conversation_id",
      expansions: "author_id",
      "user.fields": "username",
    });

    const data = await this.request<{
      data?: RawTweet[];
      includes?: { users?: Array<{ id: string; username: string }> };
    }>(`/tweets/search/recent?${params}`);

    return this.mapTweets(data, meta);
  }

  async getMe(): Promise<{ id: string; username?: string; name?: string }> {
    if (this.meId) return { id: this.meId };
    const data = await this.request<{
      data: { id: string; username?: string; name?: string };
    }>("/users/me?user.fields=username,name");
    this.meId = data.data.id;
    return data.data;
  }

  async findThreadOpportunities(
    keywords: string[],
    targetAccounts: string[]
  ): Promise<ThreadOpportunity[]> {
    const seen = new Set<string>();
    const all: ThreadOpportunity[] = [];

    const threadTweets = await this.searchRecentTweets(
      buildThreadQuery(keywords),
      15,
      { tactic: "thread" }
    );
    const targetTweets = await this.searchRecentTweets(
      buildTargetAccountQuery(targetAccounts),
      10,
      { tactic: "authority", isTarget: true }
    );
    const keywordTweets = await this.searchRecentTweets(
      buildKeywordQuery(keywords),
      10,
      { tactic: "keyword" }
    );

    for (const tweet of [...threadTweets, ...targetTweets, ...keywordTweets]) {
      if (seen.has(tweet.id)) continue;
      seen.add(tweet.id);
      all.push({
        ...tweet,
        opportunityScore: scoreThreadOpportunity(tweet),
      });
    }

    return rankThreadOpportunities(all).filter((t) => t.opportunityScore >= 45);
  }

  async postReply(inReplyToTweetId: string, text: string): Promise<string> {
    const data = await this.request<{ data: { id: string } }>("/tweets", {
      method: "POST",
      body: JSON.stringify({
        text,
        reply: { in_reply_to_tweet_id: inReplyToTweetId },
      }),
    });
    return data.data.id;
  }

  async postTweet(text: string): Promise<string> {
    const data = await this.request<{ data: { id: string } }>("/tweets", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    return data.data.id;
  }

  async likeTweet(tweetId: string): Promise<void> {
    const me = await this.getMe();
    await this.request(`/users/${me.id}/likes`, {
      method: "POST",
      body: JSON.stringify({ tweet_id: tweetId }),
    });
  }

  async followUser(targetUserId: string): Promise<void> {
    const me = await this.getMe();
    await this.request(`/users/${me.id}/following`, {
      method: "POST",
      body: JSON.stringify({ target_user_id: targetUserId }),
    });
  }

  async sendDm(participantId: string, text: string): Promise<string> {
    const data = await this.request<{ data: { dm_event_id: string } }>(
      `/dm_conversations/with/${participantId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ text }),
      }
    );
    return data.data.dm_event_id;
  }

  async lookupUserByUsername(username: string): Promise<{
    id: string;
    username: string;
    name: string;
    description?: string;
    public_metrics?: {
      followers_count?: number;
      following_count?: number;
    };
  } | null> {
    const clean = username.replace(/^@/, "");
    try {
      const data = await this.request<{
        data: {
          id: string;
          username: string;
          name: string;
          description?: string;
          public_metrics?: {
            followers_count?: number;
            following_count?: number;
          };
        };
      }>(
        `/users/by/username/${clean}?user.fields=description,public_metrics`
      );
      return data.data;
    } catch {
      return null;
    }
  }

  async getUserProfile(userId: string): Promise<{
    id: string;
    username: string;
    name: string;
    description?: string;
    public_metrics?: {
      followers_count?: number;
      following_count?: number;
    };
  } | null> {
    try {
      const data = await this.request<{
        data: {
          id: string;
          username: string;
          name: string;
          description?: string;
          public_metrics?: {
            followers_count?: number;
            following_count?: number;
          };
        };
      }>(`/users/${userId}?user.fields=username,name,description,public_metrics`);
      return data.data;
    } catch {
      return null;
    }
  }

  async getRecentTweetsByUser(userId: string, maxResults = 5): Promise<TweetCandidate[]> {
    const data = await this.request<{
      data?: RawTweet[];
      includes?: { users?: Array<{ id: string; username: string }> };
    }>(
      `/users/${userId}/tweets?max_results=${Math.min(maxResults, 10)}&tweet.fields=public_metrics,author_id,conversation_id&expansions=author_id&user.fields=username`
    );
    return this.mapTweets(data, { tactic: "authority", isTarget: true });
  }

  async getFollowers(maxResults = 25): Promise<
    Array<{
      id: string;
      username: string;
      name: string;
      description?: string;
    }>
  > {
    const me = await this.getMe();
    const data = await this.request<{
      data?: Array<{
        id: string;
        username: string;
        name: string;
        description?: string;
      }>;
    }>(
      `/users/${me.id}/followers?max_results=${Math.min(maxResults, 100)}&user.fields=username,name,description`
    );
    return data.data ?? [];
  }

  async findFollowCandidates(keywords: string[]): Promise<FollowCandidate[]> {
    const tweets = await this.searchRecentTweets(
      buildKeywordQuery(keywords),
      25
    );
    const seen = new Set<string>();
    const candidates: FollowCandidate[] = [];

    for (const tweet of tweets) {
      if (seen.has(tweet.authorId)) continue;
      seen.add(tweet.authorId);

      const user = await this.lookupUserByUsername(tweet.authorUsername);
      if (!user) continue;

      const { prospectScore, followBackScore, reason } = scoreFollowCandidate({
        bio: user.description,
        username: user.username,
        followerCount: user.public_metrics?.followers_count,
        followingCount: user.public_metrics?.following_count,
      });

      const combined = (prospectScore + followBackScore) / 2;
      if (combined < 50) continue;

      candidates.push({
        userId: user.id,
        username: user.username,
        bio: user.description,
        followerCount: user.public_metrics?.followers_count,
        followingCount: user.public_metrics?.following_count,
        prospectScore,
        followBackScore,
        reason,
      });
    }

    return rankFollowCandidates(candidates);
  }
}

// Re-export query builders for tests/engine
export { buildKeywordQuery } from "@/lib/x/growth";
