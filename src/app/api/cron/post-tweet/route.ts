import { NextRequest, NextResponse } from "next/server";
import { postNextQueuedTweet } from "@/lib/automation";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await postNextQueuedTweet();
  return NextResponse.json({ ok: true, result, ranAt: new Date().toISOString() });
}
