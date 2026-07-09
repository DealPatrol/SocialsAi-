import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { exchangeCodeForTokens, fetchXUser } from "@/lib/x/oauth";
import {
  createLoginCode,
  upsertUserAndAccountFromX,
} from "@/lib/auth/x-account";

interface OAuthState {
  intent?: "signin" | "connect";
  userId?: string;
  nonce?: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    let intent: OAuthState["intent"];
    if (state) {
      try {
        intent = (
          JSON.parse(
            Buffer.from(state, "base64url").toString("utf8")
          ) as OAuthState
        ).intent;
      } catch {
        intent = undefined;
      }
    }
    const dest =
      intent === "connect"
        ? `/dashboard/accounts?error=${encodeURIComponent(error)}`
        : `/login?error=${encodeURIComponent(error)}`;
    return NextResponse.redirect(new URL(dest, req.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", req.url)
    );
  }

  const cookieStore = await cookies();
  const verifier = cookieStore.get("x_oauth_verifier")?.value;
  const savedState = cookieStore.get("x_oauth_state")?.value;

  if (!verifier || state !== savedState) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_state", req.url)
    );
  }

  let parsed: OAuthState;
  try {
    parsed = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8")
    ) as OAuthState;
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=invalid_state", req.url)
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code, verifier);
    const xUser = await fetchXUser(tokens.access_token);

    cookieStore.delete("x_oauth_verifier");
    cookieStore.delete("x_oauth_state");

    if (parsed.intent === "signin" || !parsed.userId) {
      const { userId } = await upsertUserAndAccountFromX(xUser, tokens);
      const loginCode = await createLoginCode(userId);
      return NextResponse.redirect(
        new URL(`/login?x_code=${encodeURIComponent(loginCode)}`, req.url)
      );
    }

    const session = await auth();
    if (!session?.user?.id || session.user.id !== parsed.userId) {
      return NextResponse.redirect(
        new URL("/dashboard/accounts?error=session_mismatch", req.url)
      );
    }

    await upsertUserAndAccountFromX(xUser, tokens, parsed.userId);

    return NextResponse.redirect(
      new URL("/dashboard/accounts?connected=x", req.url)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(msg)}`, req.url)
    );
  }
}
