import { randomBytes } from "crypto";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import {
  authCodes,
  automationSettings,
  socialAccounts,
  users,
} from "@/lib/db/schema";
import { encrypt } from "@/lib/encryption";
import { PRODUCT_CONTEXT, TARGET_ACCOUNTS } from "@/lib/strategy";

export interface XProfile {
  id: string;
  username: string;
  name: string;
}

export interface XTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

export async function upsertUserAndAccountFromX(
  xUser: XProfile,
  tokens: XTokens,
  existingUserId?: string
): Promise<{ userId: string; accountId: string }> {
  await ensureDb();

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null;

  let userId = existingUserId;

  if (!userId) {
    const [byX] = await db
      .select()
      .from(users)
      .where(eq(users.xUserId, xUser.id));

    if (byX) {
      userId = byX.id;
    } else {
      userId = uuid();
      await db.insert(users).values({
        id: userId,
        email: `x_${xUser.id}@users.socialsai.app`,
        name: xUser.name,
        xUserId: xUser.id,
        onboardingComplete: false,
      });
    }
  }

  const [existingAccount] = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.platformUserId, xUser.id));

  let accountId: string;

  if (existingAccount) {
    accountId = existingAccount.id;
    await db
      .update(socialAccounts)
      .set({
        userId,
        accessTokenEnc: encrypt(tokens.access_token),
        refreshTokenEnc: tokens.refresh_token
          ? encrypt(tokens.refresh_token)
          : existingAccount.refreshTokenEnc,
        tokenExpiresAt: expiresAt,
        username: xUser.username,
        displayName: xUser.name,
      })
      .where(eq(socialAccounts.id, existingAccount.id));
  } else {
    accountId = uuid();
    const defaultAccounts = TARGET_ACCOUNTS.map((a) =>
      a.handle.replace(/^@/, "")
    );

    await db.insert(socialAccounts).values({
      id: accountId,
      userId,
      platform: "x",
      platformUserId: xUser.id,
      username: xUser.username,
      displayName: xUser.name,
      accessTokenEnc: encrypt(tokens.access_token),
      refreshTokenEnc: tokens.refresh_token
        ? encrypt(tokens.refresh_token)
        : null,
      tokenExpiresAt: expiresAt,
      automationEnabled: true,
    });

    await db.insert(automationSettings).values({
      id: uuid(),
      accountId,
      mode: "auto",
      requireApproval: false,
      postsEnabled: true,
      repliesEnabled: true,
      followsEnabled: true,
      maxPostsPerDay: 5,
      maxRepliesPerDay: 25,
      maxFollowsPerDay: 15,
      minMinutesBetweenActions: 8,
      productContext: `${PRODUCT_CONTEXT.name}: ${PRODUCT_CONTEXT.description}`,
      targetAccounts: JSON.stringify(defaultAccounts),
    });
  }

  return { userId, accountId };
}

export async function createLoginCode(userId: string): Promise<string> {
  await ensureDb();
  const code = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await db.insert(authCodes).values({ code, userId, expiresAt });
  return code;
}

export async function consumeLoginCode(code: string): Promise<string | null> {
  await ensureDb();
  const [row] = await db
    .select()
    .from(authCodes)
    .where(eq(authCodes.code, code));

  if (!row || row.expiresAt < new Date()) return null;

  await db.delete(authCodes).where(eq(authCodes.code, code));
  return row.userId;
}
