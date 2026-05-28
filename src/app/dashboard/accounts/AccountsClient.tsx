"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  PLATFORM_CAPABILITIES,
  type SocialPlatform,
} from "@/lib/platforms/types";
import AutomationSettingsForm from "@/components/AutomationSettingsForm";
import GlassPanel from "@/components/premium/GlassPanel";
import PageHeader from "@/components/premium/PageHeader";

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
      <PageHeader
        badge="Integrations"
        title="Connected accounts"
        subtitle="Link your social profiles. X is live — more platforms arriving soon."
      />

      {notice && (
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-cyan-300 p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10"
        >
          {notice}
        </motion.p>
      )}

      <GlassPanel delay={0}>
        <div className="grid gap-3">
          {(Object.keys(PLATFORM_CAPABILITIES) as SocialPlatform[]).map(
            (platform, i) => {
              const cap = PLATFORM_CAPABILITIES[platform];
              const connected = accounts.find((a) => a.platform === platform);
              return (
                <motion.div
                  key={platform}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-black/20 glass-panel-hover"
                >
                  <div>
                    <p className="font-display font-semibold text-white capitalize">
                      {platform === "x" ? "X (Twitter)" : platform}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {cap.status === "live"
                        ? "OAuth available"
                        : "Coming soon"}
                      {connected && (
                        <span className="text-cyan-400">
                          {" "}
                          · @{connected.username}
                        </span>
                      )}
                    </p>
                  </div>
                  {platform === "x" ? (
                    <a
                      href="/api/accounts/x/connect"
                      className="text-sm px-4 py-2 rounded-xl font-semibold bg-gradient-to-r from-cyan-500/90 to-violet-500/90 text-white hover:shadow-[0_0_24px_-4px_rgba(34,211,238,0.5)] transition-shadow"
                    >
                      {connected ? "Reconnect" : "Connect X"}
                    </a>
                  ) : (
                    <span className="text-[10px] uppercase tracking-widest text-zinc-600 px-3 py-1.5 rounded-lg border border-white/5">
                      Soon
                    </span>
                  )}
                </motion.div>
              );
            }
          )}
        </div>
      </GlassPanel>

      {xAccount && (
        <section>
          <h2 className="premium-label mb-4">Automation settings</h2>
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
    <Suspense
      fallback={
        <p className="text-sm text-zinc-500 animate-pulse">Loading…</p>
      }
    >
      <AccountsContent />
    </Suspense>
  );
}
