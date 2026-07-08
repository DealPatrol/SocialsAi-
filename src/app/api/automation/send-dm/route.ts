import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, ensureDb } from "@/lib/db";
import { socialAccounts } from "@/lib/db/schema";
import { sendScheduledDms } from "@/lib/automation";

export async function POST(req: NextRequest) {
  const session = await auth();
  const authHeader = req.headers.get("authorization");
  const isCron =
    !!process.env.CRON_SECRET &&
    authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!session?.user?.id && !isCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const accountId = body.accountId as string | undefined;

  if (session?.user?.id && accountId) {
    await ensureDb();
    const [account] = await db
      .select()
      .from(socialAccounts)
      .where(eq(socialAccounts.id, accountId));
    if (!account || account.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const results = await sendScheduledDms(accountId);
  return NextResponse.json({ ok: true, results });
}
