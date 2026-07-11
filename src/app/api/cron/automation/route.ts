import { NextRequest, NextResponse } from "next/server";
import { runAllAutomations } from "@/lib/automation/engine";
import {
  postNextQueuedTweet,
  runEngagementAutomation,
  sendScheduledDms,
} from "@/lib/automation";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [queuedPost, generatedContent, engagement, dms] = await Promise.all([
    postNextQueuedTweet(),
    runAllAutomations(),
    runEngagementAutomation(),
    sendScheduledDms(),
  ]);
  return NextResponse.json({
    ok: true,
    queuedPost,
    generatedContent,
    engagement,
    dms,
    ranAt: new Date().toISOString(),
  });
}
