/**
 * X (Twitter) automation guardrails aligned with platform policies.
 * @see https://help.x.com/en/rules-and-policies/x-automation
 */

export const X_RATE_LIMITS = {
  /** Conservative daily caps — well below API/platform abuse thresholds */
  maxRepliesPerDay: 50,
  maxFollowsPerDay: 25,
  maxPostsPerDay: 10,
  minMinutesBetweenActions: 5,
  maxRepliesPerHour: 8,
  maxFollowsPerHour: 5,
} as const;

const SPAM_PATTERNS = [
  /follow\s+me\s+back/i,
  /dm\s+me\s+for/i,
  /click\s+here\s+now/i,
  /free\s+money/i,
  /guaranteed\s+viral/i,
  /buy\s+followers/i,
  /#\w+\s+#\w+\s+#\w+\s+#\w+\s+#\w+/i,
];

const MANIPULATION_PATTERNS = [
  /like\s+and\s+retweet\s+to\s+win/i,
  /rt\s+to\s+enter/i,
  /engagement\s+bait/i,
];

export interface ComplianceResult {
  allowed: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
}

export function validateReplyContent(text: string): ComplianceResult {
  const issues: string[] = [];
  const suggestions: string[] = [];

  if (text.length > 280) {
    issues.push("Exceeds 280 character limit");
  }
  if (text.length < 20) {
    issues.push("Reply too short to add meaningful value");
  }

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      issues.push("Contains spam-like phrasing");
      break;
    }
  }

  for (const pattern of MANIPULATION_PATTERNS) {
    if (pattern.test(text)) {
      issues.push("Contains engagement manipulation patterns");
      break;
    }
  }

  const linkCount = (text.match(/https?:\/\//g) ?? []).length;
  if (linkCount > 1) {
    issues.push("Too many links in a single reply");
  }

  const hashtagCount = (text.match(/#\w+/g) ?? []).length;
  if (hashtagCount > 2) {
    suggestions.push("Reduce hashtags — X deprioritizes hashtag-stuffed replies");
  }

  if (!/[.!?]/.test(text) && text.length > 100) {
    suggestions.push("Add punctuation for readability");
  }

  const score = Math.max(0, 100 - issues.length * 25 - suggestions.length * 5);

  return {
    allowed: issues.length === 0,
    score,
    issues,
    suggestions,
  };
}

export function validateFollowAction(
  followsToday: number,
  followsThisHour: number,
  maxPerDay: number
): ComplianceResult {
  const issues: string[] = [];

  if (followsToday >= Math.min(maxPerDay, X_RATE_LIMITS.maxFollowsPerDay)) {
    issues.push("Daily follow limit reached");
  }
  if (followsThisHour >= X_RATE_LIMITS.maxFollowsPerHour) {
    issues.push("Hourly follow limit reached — wait before following more");
  }

  return {
    allowed: issues.length === 0,
    score: issues.length === 0 ? 100 : 0,
    issues,
    suggestions: [],
  };
}

export function validateReplyAction(
  repliesToday: number,
  repliesThisHour: number,
  maxPerDay: number
): ComplianceResult {
  const issues: string[] = [];

  if (repliesToday >= Math.min(maxPerDay, X_RATE_LIMITS.maxRepliesPerDay)) {
    issues.push("Daily reply limit reached");
  }
  if (repliesThisHour >= X_RATE_LIMITS.maxRepliesPerHour) {
    issues.push("Hourly reply limit reached");
  }

  return {
    allowed: issues.length === 0,
    score: issues.length === 0 ? 100 : 0,
    issues,
    suggestions: [],
  };
}

export function applyAutomationDisclosure(
  text: string,
  disclose: boolean
): string {
  if (!disclose) return text;
  const tag = " (automated assist)";
  if (text.length + tag.length > 280) return text;
  return text + tag;
}
