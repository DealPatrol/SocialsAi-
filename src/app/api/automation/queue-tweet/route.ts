import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, ensureDb } from "@/lib/db";
import { socialAccounts } from "@/lib/db/schema";
import { queueGeneratedTweets } from "@/lib/automation";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const tweets = Array.isArray(body.tweets)
    ? body.tweets
    : typeof body.tweet === "string"
      ? [body.tweet]
      : [];

  await ensureDb();
  let accountId = body.accountId as string | undefined;
  if (!accountId) {
    const [account] = await db
      .select()
      .from(socialAccounts)
      .where(eq(socialAccounts.userId, session.user.id))
      .limit(1);
    accountId = account?.id;
  }

  if (!accountId) {
    return NextResponse.json({ error: "Connect X first" }, { status: 400 });
  }

  const [account] = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.id, accountId));

  if (!account || account.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await queueGeneratedTweets({
    accountId,
    tweets,
    source: body.source ?? "generator",
    schedule: body.schedule === "now" ? "now" : "queue",
  });

  return NextResponse.json({ ok: true, ...result });
}
