import { decrypt, encrypt } from "@/lib/encryption";
import {
  createAdminClient,
  isSupabaseAdminConfigured,
} from "@/utils/supabase/admin";

const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const REFRESH_SKEW_MS = 60_000;

export type XAccountRow = {
  user_id: string;
  x_user_id: string | null;
  username: string | null;
  access_token_enc: string;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
};

export async function persistXAccount(input: {
  userId: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  username?: string | null;
  xUserId?: string | null;
}): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;

  const supabase = createAdminClient();
  const { error } = await supabase.from("x_accounts").upsert(
    {
      user_id: input.userId,
      x_user_id: input.xUserId ?? input.userId,
      username: input.username ?? null,
      access_token_enc: encrypt(input.accessToken),
      refresh_token_enc: input.refreshToken
        ? encrypt(input.refreshToken)
        : null,
      token_expires_at: input.expiresAt?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new Error(`Failed to persist X tokens: ${error.message}`);
  }
}

export async function persistTokensFromJwt(token: {
  sub?: string | null;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
} | null): Promise<void> {
  if (!token?.sub || !token.accessToken) return;
  try {
    await persistXAccount({
      userId: token.sub,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt
        ? new Date(token.expiresAt * 1000)
        : null,
    });
  } catch (error) {
    console.error("[v0] Failed to persist X tokens from JWT", error);
  }
}

async function refreshTwitterToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}> {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Twitter OAuth client is not configured");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const res = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${await res.text()}`);
  }

  return res.json();
}

export async function getValidAccessToken(
  userId: string
): Promise<string | null> {
  if (!isSupabaseAdminConfigured()) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("x_accounts")
    .select(
      "user_id, x_user_id, username, access_token_enc, refresh_token_enc, token_expires_at"
    )
    .eq("user_id", userId)
    .maybeSingle<XAccountRow>();

  if (error || !data) return null;

  const expiresAt = data.token_expires_at
    ? new Date(data.token_expires_at).getTime()
    : null;
  const needsRefresh =
    expiresAt !== null && expiresAt < Date.now() + REFRESH_SKEW_MS;

  if (!needsRefresh) {
    return decrypt(data.access_token_enc);
  }

  if (!data.refresh_token_enc) {
    return decrypt(data.access_token_enc);
  }

  const refreshed = await refreshTwitterToken(decrypt(data.refresh_token_enc));
  await persistXAccount({
    userId,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? decrypt(data.refresh_token_enc),
    expiresAt: refreshed.expires_in
      ? new Date(Date.now() + refreshed.expires_in * 1000)
      : null,
    username: data.username,
    xUserId: data.x_user_id,
  });
  return refreshed.access_token;
}

export async function refreshStoredAccessToken(
  userId: string
): Promise<string | null> {
  if (!isSupabaseAdminConfigured()) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("x_accounts")
    .select("refresh_token_enc, username, x_user_id")
    .eq("user_id", userId)
    .maybeSingle<{
      refresh_token_enc: string | null;
      username: string | null;
      x_user_id: string | null;
    }>();

  if (error || !data?.refresh_token_enc) return null;

  const refreshed = await refreshTwitterToken(decrypt(data.refresh_token_enc));
  await persistXAccount({
    userId,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? decrypt(data.refresh_token_enc),
    expiresAt: refreshed.expires_in
      ? new Date(Date.now() + refreshed.expires_in * 1000)
      : null,
    username: data.username,
    xUserId: data.x_user_id,
  });
  return refreshed.access_token;
}
