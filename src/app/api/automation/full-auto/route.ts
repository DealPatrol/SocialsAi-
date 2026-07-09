import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, ensureDb } from "@/lib/db";
import { automationSettings, socialAccounts } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { accountId?: string };
  const { accountId } = body;

  if (!accountId) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 });
  }

  await ensureDb();

  const [account] = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.id, accountId));

  if (!account || account.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .update(socialAccounts)
    .set({ automationEnabled: true })
    .where(eq(socialAccounts.id, accountId));

  await db
    .update(automationSettings)
    .set({
      mode: "auto",
      requireApproval: false,
      postsEnabled: true,
      repliesEnabled: true,
      followsEnabled: true,
      maxPostsPerDay: 5,
      maxRepliesPerDay: 25,
      maxFollowsPerDay: 15,
      minMinutesBetweenActions: 8,
      updatedAt: new Date(),
    })
    .where(eq(automationSettings.accountId, accountId));

  return NextResponse.json({ ok: true });
}
