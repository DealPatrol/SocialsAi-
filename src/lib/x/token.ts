import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { socialAccounts } from "@/lib/db/schema";
import { decrypt, encrypt } from "@/lib/encryption";
import { XApiClient } from "@/lib/x/client";
import { refreshAccessToken } from "@/lib/x/oauth";

export async function getAuthenticatedXClient(
  accountId: string
): Promise<XApiClient> {
  const [account] = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.id, accountId));

  if (!account) throw new Error("Account not found");

  const expiresAt = account.tokenExpiresAt;
  const needsRefresh =
    expiresAt && expiresAt.getTime() < Date.now() + 60_000;

  if (needsRefresh && account.refreshTokenEnc) {
    try {
      const refreshToken = decrypt(account.refreshTokenEnc);
      const tokens = await refreshAccessToken(refreshToken);
      const newExpires = tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null;

      await db
        .update(socialAccounts)
        .set({
          accessTokenEnc: encrypt(tokens.access_token),
          refreshTokenEnc: tokens.refresh_token
            ? encrypt(tokens.refresh_token)
            : account.refreshTokenEnc,
          tokenExpiresAt: newExpires,
        })
        .where(eq(socialAccounts.id, accountId));

      return new XApiClient(tokens.access_token);
    } catch {
      return XApiClient.fromEncrypted(account.accessTokenEnc);
    }
  }

  return XApiClient.fromEncrypted(account.accessTokenEnc);
}
