/**
 * Twitter API client for posting tweets
 * Uses OAuth 2.0 with user-provided access tokens
 * Follows Twitter API guidelines: rate limiting, character limits, etc.
 */

const TWITTER_API_BASE = "https://api.twitter.com/2";
const TWEET_CHAR_LIMIT = 280;

export interface TwitterPostRequest {
  text: string;
  reply_to_tweet_id?: string;
  accessToken: string;
}

export interface TwitterPostResponse {
  data: {
    id: string;
    text: string;
  };
}

export interface TwitterError {
  code: number;
  message: string;
  details?: string;
}

/**
 * Validate tweet follows Twitter guidelines
 */
export function validateTweet(text: string): {
  valid: boolean;
  error?: string;
} {
  // Check length
  if (text.length === 0) {
    return { valid: false, error: "Tweet cannot be empty" };
  }

  if (text.length > TWEET_CHAR_LIMIT) {
    return {
      valid: false,
      error: `Tweet exceeds ${TWEET_CHAR_LIMIT} character limit (${text.length} chars)`,
    };
  }

  // Check for spam patterns (multiple hashtags, excessive caps, etc.)
  const hashtagCount = (text.match(/#/g) || []).length;
  if (hashtagCount > 5) {
    return {
      valid: false,
      error: "Too many hashtags (max 5 per tweet)",
    };
  }

  const urlCount = (text.match(/https?:\/\//g) || []).length;
  if (urlCount > 3) {
    return {
      valid: false,
      error: "Too many URLs (max 3 per tweet)",
    };
  }

  // Check for @mentions spam (reply farming)
  // Use a lookbehind so @ must be at start-of-string or after whitespace,
  // which avoids counting email addresses (e.g. user@example.com).
  const mentionCount = (text.match(/(?<=^|\s)@[a-zA-Z0-9_]+/g) || []).length;
  if (mentionCount > 10) {
    return {
      valid: false,
      error: "Too many mentions (max 10 per tweet)",
    };
  }

  return { valid: true };
}

/**
 * Post a tweet using Twitter API v2
 */
export async function postTweet(
  request: TwitterPostRequest
): Promise<TwitterPostResponse | TwitterError> {
  // Validate tweet content
  const validation = validateTweet(request.text);
  if (!validation.valid) {
    return {
      code: 400,
      message: "Validation failed",
      details: validation.error,
    };
  }

  try {
    const payload: {
      text: string;
      reply?: { in_reply_to_tweet_id: string };
    } = {
      text: request.text,
    };

    // Add reply_settings if replying to another tweet
    if (request.reply_to_tweet_id) {
      payload.reply = {
        in_reply_to_tweet_id: request.reply_to_tweet_id,
      };
    }

    const response = await fetch(`${TWITTER_API_BASE}/tweets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": "SocialsAI/1.0",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[v0] Twitter API error:", {
        status: response.status,
        error: errorData,
      });

      // Handle specific Twitter API errors
      if (response.status === 429) {
        return {
          code: 429,
          message: "Rate limit exceeded",
          details: "You've hit Twitter's rate limit. Please wait before posting again.",
        };
      }

      if (response.status === 401) {
        return {
          code: 401,
          message: "Unauthorized",
          details:
            "Your Twitter session expired. Please log in again to post.",
        };
      }

      if (response.status === 403) {
        return {
          code: 403,
          message: "Forbidden",
          details:
            "Your account doesn't have permission to post. Check your Twitter app settings.",
        };
      }

      return {
        code: response.status,
        message: errorData?.errors?.[0]?.message || "Failed to post tweet",
        details: errorData?.detail,
      };
    }

    const data: TwitterPostResponse = await response.json();
    console.log("[v0] Tweet posted successfully:", data.data.id);
    return data;
  } catch (error) {
    console.error("[v0] Twitter posting error:", error);
    return {
      code: 500,
      message: "Failed to post tweet",
      details:
        error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * A recent public tweet from a target account, used as read-only context
 * for drafting reply suggestions. Fetching public tweets is not a write
 * action and carries none of the spam/ToS risk of automated follows,
 * likes, or DMs.
 */
export interface RecentTweet {
  id: string;
  text: string;
}

/**
 * Look up a user's recent original tweets by @handle (read-only).
 */
export async function getRecentTweetsByHandle(
  handle: string,
  accessToken: string
): Promise<{ tweets: RecentTweet[] } | { error: string }> {
  const username = handle.replace(/^@/, "");

  try {
    const userRes = await fetch(
      `${TWITTER_API_BASE}/users/by/username/${encodeURIComponent(username)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!userRes.ok) {
      if (userRes.status === 429) {
        return { error: `Rate limit exceeded resolving @${username}` };
      }
      return { error: `Failed to resolve @${username} (${userRes.status})` };
    }

    const userData = await userRes.json();
    const userId = userData?.data?.id;
    if (!userId) {
      return { error: `No such account: @${username}` };
    }

    const tweetsRes = await fetch(
      `${TWITTER_API_BASE}/users/${userId}/tweets?max_results=5&exclude=retweets,replies`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!tweetsRes.ok) {
      if (tweetsRes.status === 429) {
        return { error: "Rate limit exceeded fetching recent tweets" };
      }
      return { error: `Failed to fetch tweets for @${username}` };
    }

    const tweetsData = await tweetsRes.json();
    const tweets: RecentTweet[] = (tweetsData?.data ?? []).map(
      (t: { id: string; text: string }) => ({ id: t.id, text: t.text })
    );

    return { tweets };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
