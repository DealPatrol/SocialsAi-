import { NextRequest, NextResponse } from "next/server";
import { runAllAutomations } from "@/lib/automation/engine";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runAllAutomations();
  return NextResponse.json({ ok: true, results, ranAt: new Date().toISOString() });
}
