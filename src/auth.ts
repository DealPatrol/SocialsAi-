import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { authConfig } from "./auth.config";
import { db, ensureDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { consumeLoginCode } from "@/lib/auth/x-account";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    Credentials({
      id: "credentials",
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        xCode: { label: "X Code", type: "text" },
      },
      async authorize(credentials) {
        await ensureDb();

        const xCode = credentials?.xCode as string | undefined;
        if (xCode) {
          const userId = await consumeLoginCode(xCode);
          if (!userId) return null;

          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId));

          if (!user) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name ?? user.email,
          };
        }

        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()));

        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
        };
      },
    }),
  ],
});
