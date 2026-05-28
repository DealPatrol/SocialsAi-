import { decrypt } from "@/lib/encryption";
import type { FollowCandidate, TweetCandidate } from "@/lib/platforms/types";

const X_API = "https://api.x.com/2";

export class XApiClient {
  constructor(private accessToken: string) {}

  static fromEncrypted(accessTokenEnc: string): XApiClient {
    return new XApiClient(decrypt(accessTokenEnc));
  }

  private async request<T>(
    path: string,
    init?: RequestInit
  ): Promise<T> {
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

  async searchRecentTweets(
    query: string,
    maxResults = 10
  ): Promise<TweetCandidate[]> {
    const params = new URLSearchParams({
      query,
      max_results: String(maxResults),
      "tweet.fields": "public_metrics,author_id",
      expansions: "author_id",
      "user.fields": "username",
    });

    const data = await this.request<{
      data?: Array<{
        id: string;
        text: string;
        author_id: string;
        public_metrics?: { like_count?: number; reply_count?: number };
      }>;
      includes?: { users?: Array<{ id: string; username: string }> };
    }>(`/tweets/search/recent?${params}`);

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
    }));
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

  async followUser(targetUserId: string): Promise<void> {
    const me = await this.request<{ data: { id: string } }>("/users/me");
    await this.request(`/users/${me.data.id}/following`, {
      method: "POST",
      body: JSON.stringify({ target_user_id: targetUserId }),
    });
  }

  async lookupUserByUsername(username: string): Promise<{
    id: string;
    username: string;
    name: string;
    description?: string;
    public_metrics?: { followers_count?: number };
  } | null> {
    const clean = username.replace(/^@/, "");
    try {
      const data = await this.request<{
        data: {
          id: string;
          username: string;
          name: string;
          description?: string;
          public_metrics?: { followers_count?: number };
        };
      }>(
        `/users/by/username/${clean}?user.fields=description,public_metrics`
      );
      return data.data;
    } catch {
      return null;
    }
  }
}

/** Score how likely an X user is to pay for RepoFuse-style tools */
export function scoreProspect(bio?: string, username?: string): {
  score: number;
  reason: string;
} {
  const text = `${bio ?? ""} ${username ?? ""}`.toLowerCase();
  let score = 30;
  const signals: string[] = [];

  const patterns: Array<[RegExp, number, string]> = [
    [/indie\s*hack/i, 20, "indie hacker"],
    [/saas|founder|bootstrap/i, 18, "SaaS founder"],
    [/build(ing)?\s+in\s+public/i, 15, "build in public"],
    [/solo\s+dev|developer|engineer/i, 12, "developer"],
    [/side\s+project|maker/i, 12, "side project builder"],
    [/github|open\s*source/i, 10, "GitHub-focused"],
    [/startup|product/i, 8, "product builder"],
    [/monetiz|revenue|mrr/i, 15, "monetization-minded"],
  ];

  for (const [re, pts, label] of patterns) {
    if (re.test(text)) {
      score += pts;
      signals.push(label);
    }
  }

  if (/bot|spam|crypto\s*airdrop|nft\s*flip/i.test(text)) {
    score -= 40;
    signals.push("low-quality signals");
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    reason:
      signals.length > 0
        ? `Matches: ${signals.slice(0, 3).join(", ")}`
        : "General tech audience",
  };
}

export function buildSearchQuery(keywords: string[]): string {
  const terms = keywords
    .slice(0, 5)
    .map((k) => `"${k.replace(/"/g, "")}"`)
    .join(" OR ");
  return `(${terms}) -is:retweet -is:reply lang:en`;
}

export async function findFollowCandidates(
  client: XApiClient,
  keywords: string[]
): Promise<FollowCandidate[]> {
  const tweets = await client.searchRecentTweets(
    buildSearchQuery(keywords),
    20
  );
  const seen = new Set<string>();
  const candidates: FollowCandidate[] = [];

  for (const tweet of tweets) {
    if (seen.has(tweet.authorId)) continue;
    seen.add(tweet.authorId);

    const user = await client.lookupUserByUsername(tweet.authorUsername);
    if (!user) continue;

    const { score, reason } = scoreProspect(user.description, user.username);
    if (score < 55) continue;

    candidates.push({
      userId: user.id,
      username: user.username,
      bio: user.description,
      followerCount: user.public_metrics?.followers_count,
      prospectScore: score,
      reason,
    });
  }

  return candidates.sort((a, b) => b.prospectScore - a.prospectScore);
}
