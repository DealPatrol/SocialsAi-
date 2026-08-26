import type {
  FollowCandidate,
  ThreadOpportunity,
  TweetCandidate,
} from "@/lib/platforms/types";

export type GrowthPreset = "safe" | "balanced" | "aggressive";

export const GROWTH_PRESET_LIMITS: Record<
  GrowthPreset,
  {
    maxRepliesPerDay: number;
    maxPostsPerDay: number;
    maxDmsPerDay: number;
    minMinutesBetweenActions: number;
  }
> = {
  safe: {
    maxRepliesPerDay: 15,
    maxPostsPerDay: 3,
    maxDmsPerDay: 2,
    minMinutesBetweenActions: 12,
  },
  balanced: {
    maxRepliesPerDay: 25,
    maxPostsPerDay: 5,
    maxDmsPerDay: 3,
    minMinutesBetweenActions: 8,
  },
  aggressive: {
    maxRepliesPerDay: 40,
    maxPostsPerDay: 8,
    maxDmsPerDay: 5,
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

/** Audience-fit score for accounts worth reviewing before any manual engagement. */
export function scoreFollowCandidate(user: {
  bio?: string;
  username: string;
  followerCount?: number;
  followingCount?: number;
}): { prospectScore: number; reason: string } {
  const text = `${user.bio ?? ""} ${user.username}`.toLowerCase();
  let prospectScore = 25;
  const signals: string[] = [];

  const icpPatterns: Array<[RegExp, number, string]> = [
    [/\bai\b|artificial intelligence|machine learning|llm|agent/i, 20, "AI-focused"],
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

  if (following > 0 && followers > 0) {
    const ratio = following / followers;
    if (followers >= 200 && followers <= 50_000) {
      prospectScore += 12;
      signals.push("reachable audience size");
    }
    if (ratio > 0.1 && ratio < 5) {
      prospectScore += 8;
      signals.push("organic account ratio");
    }
  }

  if (/bot|spam|crypto\s*airdrop|nft\s*flip/i.test(text)) {
    prospectScore -= 50;
  }

  return {
    prospectScore: Math.min(100, Math.max(0, prospectScore)),
    reason:
      signals.length > 0
        ? signals.slice(0, 3).join(", ")
        : "audience fit review candidate",
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

export function rankFollowCandidates(
  candidates: FollowCandidate[]
): FollowCandidate[] {
  return [...candidates].sort((a, b) => b.prospectScore - a.prospectScore);
}
