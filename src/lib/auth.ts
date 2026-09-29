import type { DefaultSession, NextAuthOptions } from "next-auth";
import Twitter from "next-auth/providers/twitter";
import { persistXAccount } from "@/lib/x-accounts";

// Use actual env vars if available, otherwise use dummy values for build time
const clientId = process.env.TWITTER_CLIENT_ID || "placeholder-id";
const clientSecret = process.env.TWITTER_CLIENT_SECRET || "placeholder-secret";

export const authOptions: NextAuthOptions = {
  providers: [
    Twitter({
      clientId,
      clientSecret,
      version: "2.0",
      authorization: {
        params: {
          scope: "tweet.read tweet.write users.read offline.access",
        },
      },
    }),
  ],
  pages: {
    signIn: "/",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;

        if (token.sub && account.access_token) {
          const raw = profile as
            | { data?: { id?: string; username?: string }; id?: string; username?: string }
            | undefined;
          const username = raw?.data?.username ?? raw?.username;
          const xUserId = raw?.data?.id ?? raw?.id;

          try {
            await persistXAccount({
              userId: token.sub,
              accessToken: account.access_token,
              refreshToken: account.refresh_token,
              expiresAt: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
              username,
              xUserId,
            });
          } catch (error) {
            console.error("[v0] Failed to persist X tokens on sign-in", error);
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Access token is kept server-side in the JWT only and is not
      // forwarded to the browser via the session object.
      if (session.user) {
        // token.sub is the stable Twitter OAuth user id. Automation
        // tables key rows off this instead of email, since the Twitter
        // provider frequently doesn't return an email address at all —
        // falling back to a shared placeholder there would let unrelated
        // accounts collide on the same user_id.
        session.user.id = token.sub;
      }
      return session;
    },
  },
};

// Extend NextAuth JWT type to include OAuth tokens
declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }
}

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id?: string;
    };
  }
}
