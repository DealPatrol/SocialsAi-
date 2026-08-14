import type {
  AudienceCandidate,
  ThreadOpportunity,
  TweetCandidate,
} from "@/lib/platforms/types";

export type GrowthPreset = "safe" | "balanced" | "aggressive";

export const GROWTH_PRESET_LIMITS: Record<
  GrowthPreset,
  {
    maxRepliesPerDay: number;
    maxPostsPerDay: number;
    minMinutesBetweenActions: number;
  }
> = {
  safe: {
    maxRepliesPerDay: 15,
    maxPostsPerDay: 3,
    minMinutesBetweenActions: 12,
  },
  balanced: {
    maxRepliesPerDay: 25,
    maxPostsPerDay: 5,
    minMinutesBetweenActions: 8,
  },
  aggressive: {
    maxRepliesPerDay: 40,
    maxPostsPerDay: 8,
    minMinutesBetweenActions: 6,
  },
};

/** Score tweet for reply opportunity — higher = more visibility potential */
export function scoreThreadOpportunity(tweet: TweetCandidate): number {
  const likes = tweet.likeCount ?? 0;
  const replies = tweet.replyCount ?? 0;
  let score = 20;

  // Sweet spot: active threads with room to add value
  if (replies >= 5 && replies <= 80) score += 25;
  if (likes >= 10 && likes <= 500) score += 20;
  if (tweet.isFromTargetAccount) score += 30;
  if (tweet.isThreadRoot) score += 15;

  // Penalize dead or oversaturated threads
  if (replies > 200) score -= 20;
  if (likes > 2000) score -= 10;

  return Math.min(100, Math.max(0, score));
}

/** Relevance score for accounts that may be worth monitoring or replying to. */
export function scoreAudienceCandidate(user: {
  bio?: string;
  username: string;
  followerCount?: number;
  followingCount?: number;
}): { prospectScore: number; relevanceScore: number; reason: string } {
  const text = `${user.bio ?? ""} ${user.username}`.toLowerCase();
  let prospectScore = 25;
  let relevanceScore = 30;
  const signals: string[] = [];

  const icpPatterns: Array<[RegExp, number, string]> = [
    [/ai|artificial intelligence|machine learning|ml\b/i, 22, "AI-focused"],
    [/indie\s*hack/i, 18, "indie hacker"],
    [/saas|founder|bootstrap/i, 16, "SaaS founder"],
    [/build(ing)?\s+in\s+public/i, 14, "build in public"],
    [/solo\s+dev|developer|engineer/i, 12, "developer"],
    [/github|open\s*source/i, 10, "GitHub-focused"],
    [/monetiz|revenue|mrr/i, 14, "monetization-minded"],
  ];

  for (const [re, pts, label] of icpPatterns) {
    if (re.test(text)) {
      prospectScore += pts;
      signals.push(label);
    }
  }

  const followers = user.followerCount ?? 0;
  const following = user.followingCount ?? 0;

  if (followers >= 200 && followers <= 50_000) {
    relevanceScore += 20;
    signals.push("reachable audience size");
  }
  if (following > 0 && followers > 0) {
    const ratio = followers / following;
    if (ratio >= 0.25 && ratio <= 8) relevanceScore += 10;
  }

  if (/bot|spam|crypto\s*airdrop|nft\s*flip/i.test(text)) {
    prospectScore -= 50;
    relevanceScore -= 40;
  }

  return {
    prospectScore: Math.min(100, Math.max(0, prospectScore)),
    relevanceScore: Math.min(100, Math.max(0, relevanceScore)),
    reason:
      signals.length > 0
        ? signals.slice(0, 3).join(", ")
        : `audience relevance ${relevanceScore}`,
  };
}

export function buildKeywordQuery(keywords: string[]): string {
  const terms = keywords
    .slice(0, 5)
    .map((k) => `"${k.replace(/"/g, "")}"`)
    .join(" OR ");
  return `(${terms}) -is:retweet lang:en`;
}

export function buildThreadQuery(keywords: string[]): string {
  const terms = keywords
    .slice(0, 4)
    .map((k) => `"${k.replace(/"/g, "")}"`)
    .join(" OR ");
  return `(${terms}) min_replies:5 -is:retweet lang:en`;
}

export function buildTargetAccountQuery(handles: string[]): string {
  const from = handles
    .slice(0, 5)
    .map((h) => `from:${h.replace(/^@/, "")}`)
    .join(" OR ");
  return `(${from}) -is:retweet -is:reply lang:en`;
}

export function rankThreadOpportunities(
  tweets: ThreadOpportunity[]
): ThreadOpportunity[] {
  return [...tweets].sort(
    (a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0)
  );
}

export function rankAudienceCandidates(
  candidates: AudienceCandidate[]
): AudienceCandidate[] {
  return [...candidates].sort((a, b) => {
    const aScore = (a.prospectScore + a.relevanceScore) / 2;
    const bScore = (b.prospectScore + b.relevanceScore) / 2;
    return bScore - aScore;
  });
}
