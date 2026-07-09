import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { v4 as uuid } from "uuid";
import { and, eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { socialAccounts, automationSettings } from "@/lib/db/schema";
import { encrypt } from "@/lib/encryption";
import { exchangeCodeForTokens, fetchXUser } from "@/lib/x/oauth";
import { PRODUCT_CONTEXT } from "@/lib/strategy";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/accounts?error=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/accounts?error=missing_code", req.url)
    );
  }

  const cookieStore = await cookies();
  const verifier = cookieStore.get("x_oauth_verifier")?.value;
  const savedState = cookieStore.get("x_oauth_state")?.value;

  if (!verifier || state !== savedState) {
    return NextResponse.redirect(
      new URL("/dashboard/accounts?error=invalid_state", req.url)
    );
  }

  let userId: string;
  try {
    const parsed = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8")
    ) as { userId: string };
    userId = parsed.userId;
  } catch {
    return NextResponse.redirect(
      new URL("/dashboard/accounts?error=invalid_state", req.url)
    );
  }

  try {
    await ensureDb();
    const tokens = await exchangeCodeForTokens(code, verifier);
    const xUser = await fetchXUser(tokens.access_token);

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    const [existing] = await db
      .select()
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.userId, userId),
          eq(socialAccounts.platform, "x"),
          eq(socialAccounts.platformUserId, xUser.id)
        )
      );

    let accountId: string;

    if (existing) {
      accountId = existing.id;
      await db
        .update(socialAccounts)
        .set({
          accessTokenEnc: encrypt(tokens.access_token),
          refreshTokenEnc: tokens.refresh_token
            ? encrypt(tokens.refresh_token)
            : existing.refreshTokenEnc,
          tokenExpiresAt: expiresAt,
          username: xUser.username,
          displayName: xUser.name,
        })
        .where(eq(socialAccounts.id, existing.id));
    } else {
      accountId = uuid();
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
        followsEnabled: true,
        repliesEnabled: true,
        maxPostsPerDay: 5,
        maxRepliesPerDay: 25,
        maxFollowsPerDay: 15,
        minMinutesBetweenActions: 8,
        productContext: `${PRODUCT_CONTEXT.name}: ${PRODUCT_CONTEXT.description}`,
      });
    }

    cookieStore.delete("x_oauth_verifier");
    cookieStore.delete("x_oauth_state");

    return NextResponse.redirect(
      new URL("/dashboard/accounts?connected=x", req.url)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(
      new URL(`/dashboard/accounts?error=${encodeURIComponent(msg)}`, req.url)
    );
  }
}
