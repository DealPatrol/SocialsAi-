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
    maxFollowsPerDay: number;
    maxPostsPerDay: number;
    maxDmsPerDay: number;
    minMinutesBetweenActions: number;
  }
> = {
  safe: {
    maxRepliesPerDay: 15,
    maxFollowsPerDay: 8,
    maxPostsPerDay: 3,
    maxDmsPerDay: 2,
    minMinutesBetweenActions: 12,
  },
  balanced: {
    maxRepliesPerDay: 25,
    maxFollowsPerDay: 15,
    maxPostsPerDay: 5,
    maxDmsPerDay: 3,
    minMinutesBetweenActions: 8,
  },
  aggressive: {
    maxRepliesPerDay: 40,
    maxFollowsPerDay: 22,
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

/** Follow-back likelihood + business prospect score */
export function scoreFollowCandidate(user: {
  bio?: string;
  username: string;
  followerCount?: number;
  followingCount?: number;
}): { prospectScore: number; followBackScore: number; reason: string } {
  const text = `${user.bio ?? ""} ${user.username}`.toLowerCase();
  let prospectScore = 25;
  let followBackScore = 40;
  const signals: string[] = [];

  const icpPatterns: Array<[RegExp, number, string]> = [
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

  // Accounts that follow many = more likely to follow back
  if (following > 0 && followers > 0) {
    const ratio = following / followers;
    if (ratio > 0.8 && ratio < 3) followBackScore += 25;
    if (followers >= 200 && followers <= 50_000) followBackScore += 15;
    if (followers < 100_000) followBackScore += 10;
  }

  if (/bot|spam|crypto\s*airdrop|nft\s*flip/i.test(text)) {
    prospectScore -= 50;
    followBackScore -= 40;
  }

  return {
    prospectScore: Math.min(100, Math.max(0, prospectScore)),
    followBackScore: Math.min(100, Math.max(0, followBackScore)),
    reason:
      signals.length > 0
        ? `${signals.slice(0, 2).join(", ")} · follow-back ${followBackScore}`
        : `follow-back likelihood ${followBackScore}`,
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
  return [...candidates].sort((a, b) => {
    const aScore = (a.prospectScore + (a.followBackScore ?? 0)) / 2;
    const bScore = (b.prospectScore + (b.followBackScore ?? 0)) / 2;
    return bScore - aScore;
  });
}
