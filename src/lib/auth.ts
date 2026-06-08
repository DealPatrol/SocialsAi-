import NextAuth from "next-auth";
import Twitter from "next-auth/providers/twitter";

if (!process.env.TWITTER_CLIENT_ID) {
  throw new Error("Missing TWITTER_CLIENT_ID environment variable");
}
if (!process.env.TWITTER_CLIENT_SECRET) {
  throw new Error("Missing TWITTER_CLIENT_SECRET environment variable");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Twitter({
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
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
      session.user = {
        ...session.user,
        id: token.sub,
        accessToken: token.accessToken as string,
      };
      return session;
    },
  },
});
