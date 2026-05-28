"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PLATFORM_CAPABILITIES, type SocialPlatform } from "@/lib/platforms/types";
import AutomationSettingsForm from "@/components/AutomationSettingsForm";

interface Account {
  id: string;
  platform: SocialPlatform;
  username: string;
  automationEnabled: boolean;
}

function AccountsContent() {
  const params = useSearchParams();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected === "x") setNotice("X account connected successfully.");
    if (error) setNotice(`Error: ${error}`);
  }, [params]);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts ?? []));
  }, []);

  const xAccount = accounts.find((a) => a.platform === "x");

  return (
    <div className="space-y-8">
      {notice && (
        <p className="text-sm text-blue-400 p-3 rounded-lg bg-blue-950/30 border border-blue-900">
          {notice}
        </p>
      )}

      <section>
        <h2 className="font-semibold text-white mb-4">Connected accounts</h2>
        <div className="grid gap-3">
          {(Object.keys(PLATFORM_CAPABILITIES) as SocialPlatform[]).map(
            (platform) => {
              const cap = PLATFORM_CAPABILITIES[platform];
              const connected = accounts.find((a) => a.platform === platform);
              return (
                <div
                  key={platform}
                  className="flex items-center justify-between p-4 rounded-xl border border-gray-800 bg-gray-900"
                >
                  <div>
                    <p className="font-medium text-white capitalize">
                      {platform === "x" ? "X (Twitter)" : platform}
                    </p>
                    <p className="text-xs text-gray-500">
                      {cap.status === "live"
                        ? "OAuth available"
                        : "Coming soon"}
                      {connected && ` · @${connected.username}`}
                    </p>
                  </div>
                  {platform === "x" ? (
                    <a
                      href="/api/accounts/x/connect"
                      className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      {connected ? "Reconnect" : "Connect X"}
                    </a>
                  ) : (
                    <span className="text-xs text-gray-600 px-3 py-1.5 rounded-lg border border-gray-800">
                      Soon
                    </span>
                  )}
                </div>
              );
            }
          )}
        </div>
      </section>

      {xAccount && (
        <section>
          <h2 className="font-semibold text-white mb-4">Automation settings</h2>
          <AutomationSettingsForm
            accountId={xAccount.id}
            username={xAccount.username}
          />
        </section>
      )}
    </div>
  );
}

export default function AccountsClient() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
      <AccountsContent />
    </Suspense>
  );
}
