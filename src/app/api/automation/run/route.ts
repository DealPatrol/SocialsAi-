import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, ensureDb } from "@/lib/db";
import { socialAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  runAutomationForAccount,
  runAllAutomations,
  seedDemoQueue,
} from "@/lib/automation/engine";

export async function POST(req: NextRequest) {
  const session = await auth();
  const cronSecret = req.headers.get("authorization");
  const isCron =
    cronSecret === `Bearer ${process.env.CRON_SECRET}` &&
    !!process.env.CRON_SECRET;

  if (!session?.user?.id && !isCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDb();
  const body = await req.json().catch(() => ({}));
  const { accountId, demo } = body as {
    accountId?: string;
    demo?: boolean;
  };

  if (isCron) {
    const results = await runAllAutomations();
    return NextResponse.json({ results });
  }

  if (demo && accountId) {
    const [account] = await db
      .select()
      .from(socialAccounts)
      .where(eq(socialAccounts.id, accountId));

    if (!account || account.userId !== session!.user!.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await seedDemoQueue(accountId);
    return NextResponse.json({ ok: true, demo: true });
  }

  if (accountId) {
    const [account] = await db
      .select()
      .from(socialAccounts)
      .where(eq(socialAccounts.id, accountId));

    if (!account || account.userId !== session!.user!.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await runAutomationForAccount(accountId);
    return NextResponse.json({ result });
  }

  return NextResponse.json(
    { error: "accountId required" },
    { status: 400 }
  );
}
