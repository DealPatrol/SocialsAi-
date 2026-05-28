import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, ensureDb } from "@/lib/db";
import { socialAccounts } from "@/lib/db/schema";
import { PLATFORM_CAPABILITIES } from "@/lib/platforms/types";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDb();
  const accounts = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.userId, session.user.id));

  return NextResponse.json({
    accounts: accounts.map((a) => ({
      id: a.id,
      platform: a.platform,
      username: a.username,
      displayName: a.displayName,
      automationEnabled: a.automationEnabled,
      capabilities: PLATFORM_CAPABILITIES[a.platform],
    })),
    platforms: PLATFORM_CAPABILITIES,
  });
}
