import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("twitter_access_token")?.value;
  return NextResponse.json({ connected: Boolean(token) });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("twitter_access_token");
  cookieStore.delete("twitter_refresh_token");
  return NextResponse.json({ connected: false });
}
