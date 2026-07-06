import type { NextAuthOptions } from "next-auth";
import Twitter from "next-auth/providers/twitter";

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
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
      }
      return token;
    },
    async session({ session }) {
      // Access token is kept server-side in the JWT only and is not
      // forwarded to the browser via the session object.
      return session;
    },
  },
};

// Extend NextAuth JWT type to include OAuth tokens
declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
  }
}
