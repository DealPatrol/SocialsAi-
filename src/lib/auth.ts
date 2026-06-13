import NextAuth from "next-auth";
import Twitter from "next-auth/providers/twitter";

// Use actual env vars if available, otherwise use dummy values for build time
const clientId = process.env.TWITTER_CLIENT_ID || "placeholder-id";
const clientSecret = process.env.TWITTER_CLIENT_SECRET || "placeholder-secret";

export const { handlers, auth, signIn, signOut } = NextAuth({
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
    async session({ session, token }) {
      if (session.user) {
        session.user.accessToken = token.accessToken as string;
      }
      return session;
    },
  },
});

// Extend NextAuth types to include accessToken
declare module "next-auth" {
  interface User {
    accessToken?: string;
  }
  interface Session {
    user: User & {
      accessToken?: string;
    };
  }
}
