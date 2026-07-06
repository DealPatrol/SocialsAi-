import { NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/twitter";
import { cookies } from "next/headers";

export async function GET() {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: "APP_URL is not set" }, { status: 500 });
  }

  const callbackUrl = `${appUrl}/api/auth/callback/twitter`;
  const client = getOAuthClient();

  const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
    callbackUrl,
    { scope: ["tweet.read", "tweet.write", "users.read", "offline.access"] }
  );

  const cookieStore = await cookies();
  cookieStore.set("twitter_oauth_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  cookieStore.set("twitter_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(url);
}
