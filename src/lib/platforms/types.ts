export type SocialPlatform = "x" | "instagram" | "facebook" | "youtube";

export interface PlatformCapabilities {
  canPost: boolean;
  canReply: boolean;
  canFollow: boolean;
  canSearch: boolean;
  oauthAvailable: boolean;
  status: "live" | "coming_soon";
}

export const PLATFORM_CAPABILITIES: Record<
  SocialPlatform,
  PlatformCapabilities
> = {
  x: {
    canPost: true,
    canReply: true,
    canFollow: true,
    canSearch: true,
    oauthAvailable: true,
    status: "live",
  },
  instagram: {
    canPost: false,
    canReply: false,
    canFollow: false,
    canSearch: false,
    oauthAvailable: false,
    status: "coming_soon",
  },
  facebook: {
    canPost: false,
    canReply: false,
    canFollow: false,
    canSearch: false,
    oauthAvailable: false,
    status: "coming_soon",
  },
  youtube: {
    canPost: false,
    canReply: false,
    canFollow: false,
    canSearch: false,
    oauthAvailable: false,
    status: "coming_soon",
  },
};

export interface TweetCandidate {
  id: string;
  text: string;
  authorId: string;
  authorUsername: string;
  likeCount?: number;
  replyCount?: number;
}

export interface FollowCandidate {
  userId: string;
  username: string;
  bio?: string;
  followerCount?: number;
  prospectScore: number;
  reason: string;
}
