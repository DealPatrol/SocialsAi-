import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAutomationStatus } from "@/lib/automation";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getAutomationStatus(session.user.id);
  return NextResponse.json(status);
}
