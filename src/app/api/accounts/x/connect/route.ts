import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { buildAuthorizeUrl, generatePkce, getXOAuthConfig } from "@/lib/x/oauth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = getXOAuthConfig();
  if (!config) {
    return NextResponse.json(
      {
        error: "X OAuth not configured",
        hint: "Set X_CLIENT_ID, X_CLIENT_SECRET, and X_CALLBACK_URL in environment variables",
      },
      { status: 503 }
    );
  }

  const { verifier, challenge } = generatePkce();
  const state = Buffer.from(
    JSON.stringify({ userId: session.user.id, nonce: randomUUID() })
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

  const url = buildAuthorizeUrl(state, challenge);
  return NextResponse.redirect(url);
}
