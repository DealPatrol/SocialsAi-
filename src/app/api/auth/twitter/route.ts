import { NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/twitter";
import { cookies } from "next/headers";

const CALLBACK_URL = `${process.env.APP_URL}/api/auth/callback/twitter`;

export async function GET() {
  const client = getOAuthClient();

  const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
    CALLBACK_URL,
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
