import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, ensureDb } from "@/lib/db";
import { automationQueue, socialAccounts } from "@/lib/db/schema";
import { executeQueueItem } from "@/lib/automation/engine";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = req.nextUrl.searchParams.get("accountId");
  await ensureDb();

  const userAccounts = await db
    .select({ id: socialAccounts.id })
    .from(socialAccounts)
    .where(eq(socialAccounts.userId, session.user.id));

  const ids = userAccounts.map((a) => a.id);
  if (accountId && !ids.includes(accountId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const items = await db
    .select()
    .from(automationQueue)
    .orderBy(desc(automationQueue.createdAt))
    .limit(50);

  const filtered = items.filter((i) =>
    accountId ? i.accountId === accountId : ids.includes(i.accountId)
  );

  return NextResponse.json({
    items: filtered.map((i) => ({
      ...i,
      payload: JSON.parse(i.payload),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { queueId, action } = await req.json();
  if (!queueId || !["approve", "reject", "execute"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await ensureDb();

  const [item] = await db
    .select()
    .from(automationQueue)
    .where(eq(automationQueue.id, queueId));

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [account] = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.id, item.accountId));

  if (!account || account.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (action === "reject") {
    await db
      .update(automationQueue)
      .set({ status: "rejected" })
      .where(eq(automationQueue.id, queueId));
    return NextResponse.json({ ok: true });
  }

  if (action === "approve" || action === "execute") {
    await db
      .update(automationQueue)
      .set({ status: "approved", errorMessage: null })
      .where(eq(automationQueue.id, queueId));

    const ok = await executeQueueItem(queueId);
    return NextResponse.json({ ok, executed: ok });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
