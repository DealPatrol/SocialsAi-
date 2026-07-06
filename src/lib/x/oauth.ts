import { randomBytes, createHash } from "crypto";

const X_AUTH = "https://twitter.com/i/oauth2";
const X_TOKEN = "https://api.x.com/2/oauth2/token";

export const X_OAUTH_SCOPES = [
  "tweet.read",
  "tweet.write",
  "users.read",
  "follows.read",
  "follows.write",
  "dm.read",
  "dm.write",
  "offline.access",
] as const;

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

export function getXOAuthConfig() {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  const callbackUrl =
    process.env.X_CALLBACK_URL ??
    `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/accounts/x/callback`;

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, callbackUrl };
}

export function buildAuthorizeUrl(
  state: string,
  codeChallenge: string
): string {
  const config = getXOAuthConfig();
  if (!config) throw new Error("X OAuth is not configured");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    scope: X_OAUTH_SCOPES.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${X_AUTH}/authorize?${params}`;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}> {
  const config = getXOAuthConfig();
  if (!config) throw new Error("X OAuth is not configured");

  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    code_verifier: codeVerifier,
  });

  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString("base64");

  const res = await fetch(X_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${await res.text()}`);
  }

  return res.json();
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}> {
  const config = getXOAuthConfig();
  if (!config) throw new Error("X OAuth is not configured");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
  });

  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString("base64");

  const res = await fetch(X_TOKEN, {
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

export async function fetchXUser(accessToken: string): Promise<{
  id: string;
  username: string;
  name: string;
}> {
  const res = await fetch(
    "https://api.x.com/2/users/me?user.fields=username,name",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error("Failed to fetch X user profile");
  const data = (await res.json()) as {
    data: { id: string; username: string; name: string };
  };
  return data.data;
}
