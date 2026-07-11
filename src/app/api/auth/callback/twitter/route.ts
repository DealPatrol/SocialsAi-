import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/twitter";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const baseUrl = process.env.APP_URL ?? req.nextUrl.origin;
  const callbackUrl = `${baseUrl}/api/auth/callback/twitter`;

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("twitter_oauth_state")?.value;
  const codeVerifier = cookieStore.get("twitter_oauth_verifier")?.value;

  if (!code || !state || state !== savedState || !codeVerifier) {
    return NextResponse.redirect(`${baseUrl}?error=oauth_failed`);
  }

  try {
    const client = getOAuthClient();
    const { accessToken, refreshToken, expiresIn } = await client.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: callbackUrl,
    });

    cookieStore.delete("twitter_oauth_state");
    cookieStore.delete("twitter_oauth_verifier");

    cookieStore.set("twitter_access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: expiresIn ?? 7200,
      path: "/",
    });

    if (refreshToken) {
      cookieStore.set("twitter_refresh_token", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }

    return NextResponse.redirect(`${process.env.APP_URL ?? req.nextUrl.origin}?connected=true`);
  } catch {
    return NextResponse.redirect(`${process.env.APP_URL ?? req.nextUrl.origin}?error=oauth_failed`);
  }
}
