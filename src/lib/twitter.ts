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
 * Follow a user on Twitter
 */
export async function followUser(
  userId: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${TWITTER_API_BASE}/users/:id/following`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ target_user_id: userId }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return {
          success: false,
          error: "Rate limit exceeded on follows",
        };
      }
      const error = await response.json();
      return {
        success: false,
        error: error?.errors?.[0]?.message || "Failed to follow user",
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Like a tweet
 */
export async function likeTweet(
  tweetId: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${TWITTER_API_BASE}/tweets/:id/liking`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tweet_id: tweetId }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return {
          success: false,
          error: "Rate limit exceeded on likes",
        };
      }
      const error = await response.json();
      return {
        success: false,
        error: error?.errors?.[0]?.message || "Failed to like tweet",
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send a direct message
 */
export async function sendDM(
  recipientId: string,
  message: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${TWITTER_API_BASE}/dm_conversations/with/:id/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        participant_ids: [recipientId],
        message: { text: message },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return {
          success: false,
          error: "Rate limit exceeded on DMs",
        };
      }
      const error = await response.json();
      return {
        success: false,
        error: error?.errors?.[0]?.message || "Failed to send DM",
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get user profile info for DM personalization
 */
export async function getUserProfile(
  userId: string,
  accessToken: string
): Promise<
  | {
      id: string;
      name: string;
      username: string;
      bio?: string;
      followers_count: number;
    }
  | { error: string }
> {
  try {
    const response = await fetch(
      `${TWITTER_API_BASE}/users/${userId}?user.fields=description,public_metrics`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      return { error: "Failed to fetch user profile" };
    }

    const data = await response.json();
    return {
      id: data.data.id,
      name: data.data.name,
      username: data.data.username,
      bio: data.data.description,
      followers_count: data.data.public_metrics?.followers_count || 0,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Personalize a DM template with user data
 */
export function personalizeDMTemplate(
  template: string,
  userData: {
    name?: string;
    username?: string;
    bio?: string;
    followers_count?: number;
  }
): string {
  let message = template;
  message = message.replace(/{name}/g, userData.name || "there");
  message = message.replace(/{handle}/g, userData.username || "");
  message = message.replace(/{bio}/g, userData.bio || "");
  message = message.replace(
    /{followers}/g,
    userData.followers_count?.toString() || "0"
  );
  return message;
}
