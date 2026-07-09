import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, ensureDb } from "@/lib/db";
import {
  automationSettings,
  socialAccounts,
  users,
} from "@/lib/db/schema";
import { analyzeWebsiteAndTopics } from "@/lib/onboarding/analyze";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id));

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const accounts = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.userId, user.id));

  return NextResponse.json({
    websiteUrl: user.websiteUrl ?? "",
    onboardingComplete: user.onboardingComplete,
    hasXAccount: accounts.some((a) => a.platform === "x"),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const websiteUrl = String(body.websiteUrl ?? "").trim();
  const topics = String(body.topics ?? "").trim();

  if (!websiteUrl || !topics) {
    return NextResponse.json(
      { error: "Website URL and topics are required" },
      { status: 400 }
    );
  }

  try {
    new URL(websiteUrl);
  } catch {
    return NextResponse.json({ error: "Invalid website URL" }, { status: 400 });
  }

  await ensureDb();

  let analysis;
  try {
    analysis = await analyzeWebsiteAndTopics(websiteUrl, topics);
  } catch {
    analysis = {
      productContext: topics,
      suggestedKeywords: [
        "indie hacker",
        "saas founder",
        "build in public",
        "side project",
        "bootstrap",
      ],
      suggestedTopics: topics,
    };
  }

  await db
    .update(users)
    .set({
      websiteUrl,
      onboardingComplete: true,
    })
    .where(eq(users.id, session.user.id));

  const accounts = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.userId, session.user.id));

  for (const account of accounts) {
    if (account.platform !== "x") continue;

    await db
      .update(automationSettings)
      .set({
        websiteUrl,
        productContext: analysis.productContext,
        targetKeywords: JSON.stringify(analysis.suggestedKeywords),
        updatedAt: new Date(),
      })
      .where(eq(automationSettings.accountId, account.id));
  }

  return NextResponse.json({
    ok: true,
    analysis,
    redirect: "/dashboard/automation",
  });
}
