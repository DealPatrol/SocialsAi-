import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildAuthorizeUrl, generatePkce, getXOAuthConfig } from "@/lib/x/oauth";

export async function GET() {
  const config = getXOAuthConfig();
  if (!config) {
    return NextResponse.json(
      {
        error: "X OAuth not configured",
        hint: "Set X_CLIENT_ID, X_CLIENT_SECRET, and X_CALLBACK_URL",
      },
      { status: 503 }
    );
  }

  const { verifier, challenge } = generatePkce();
  const state = Buffer.from(
    JSON.stringify({ intent: "signin", nonce: randomUUID() })
  ).toString("base64url");

  const cookieStore = await cookies();
  cookieStore.set("x_oauth_verifier", verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  cookieStore.set("x_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(buildAuthorizeUrl(state, challenge));
}
