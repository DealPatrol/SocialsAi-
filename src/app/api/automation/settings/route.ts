import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, ensureDb } from "@/lib/db";
import { automationSettings, socialAccounts } from "@/lib/db/schema";

async function assertAccountOwnership(accountId: string, userId: string) {
  const [account] = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.id, accountId));
  if (!account || account.userId !== userId) {
    return null;
  }
  return account;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = req.nextUrl.searchParams.get("accountId");
  if (!accountId) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 });
  }

  await ensureDb();
  const account = await assertAccountOwnership(accountId, session.user.id);
  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [settings] = await db
    .select()
    .from(automationSettings)
    .where(eq(automationSettings.accountId, accountId));

  return NextResponse.json({
    settings,
    automationEnabled: account.automationEnabled,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { accountId, ...updates } = body;

  if (!accountId) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 });
  }

  await ensureDb();
  const account = await assertAccountOwnership(accountId, session.user.id);
  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = [
    "mode",
    "growthPreset",
    "repliesEnabled",
    "threadRepliesEnabled",
    "followsEnabled",
    "postsEnabled",
    "dmsEnabled",
    "maxRepliesPerDay",
    "maxFollowsPerDay",
    "maxPostsPerDay",
    "maxDmsPerDay",
    "minMinutesBetweenActions",
    "toneMix",
    "productContext",
    "targetKeywords",
    "targetAccounts",
    "websiteUrl",
    "requireApproval",
    "discloseAutomation",
  ] as const;

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      if (
        key === "toneMix" ||
        key === "targetKeywords" ||
        key === "targetAccounts"
      ) {
        patch[key] =
          typeof updates[key] === "string"
            ? updates[key]
            : JSON.stringify(updates[key]);
      } else {
        patch[key] = updates[key];
      }
    }
  }

  if (updates.automationEnabled !== undefined) {
    await db
      .update(socialAccounts)
      .set({ automationEnabled: !!updates.automationEnabled })
      .where(eq(socialAccounts.id, accountId));
  }

  await db
    .update(automationSettings)
    .set(patch)
    .where(eq(automationSettings.accountId, accountId));

  const [settings] = await db
    .select()
    .from(automationSettings)
    .where(eq(automationSettings.accountId, accountId));

  return NextResponse.json({ settings });
}
