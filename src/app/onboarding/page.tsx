"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import PremiumShell from "@/components/premium/PremiumShell";
import GlassPanel from "@/components/premium/GlassPanel";
import Logo from "@/components/premium/Logo";
import ShimmerButton from "@/components/premium/ShimmerButton";

export default function OnboardingPage() {
  const router = useRouter();
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [topics, setTopics] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasXAccount, setHasXAccount] = useState(true);

  useEffect(() => {
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((data) => {
        if (data.onboardingComplete) {
          router.replace("/dashboard");
          return;
        }
        if (data.websiteUrl) setWebsiteUrl(data.websiteUrl);
        setHasXAccount(!!data.hasXAccount);
      });
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ websiteUrl, topics }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Setup failed");
      return;
    }

    router.push(data.redirect ?? "/dashboard/automation");
  }

  return (
    <PremiumShell>
      <div className="min-h-screen flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg">
          <div className="mb-8 flex justify-center">
            <Logo />
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-2xl font-bold text-center gradient-text mb-2"
          >
            Configure your growth engine
          </motion.h1>
          <p className="text-sm text-zinc-400 text-center mb-8">
            Tell us about your product and niche. We&apos;ll target the right
            threads, accounts, and prospects — safely.
          </p>

          {!hasXAccount && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
            >
              Connect your X account from the dashboard after setup to enable
              automation.
            </motion.div>
          )}

          <GlassPanel hover={false}>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="premium-label">Website URL</label>
                <input
                  type="url"
                  required
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://repofuse.com"
                  className="premium-input"
                />
              </div>
              <div>
                <label className="premium-label">
                  Topics / niche on X
                </label>
                <textarea
                  required
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  placeholder="e.g. indie hackers, SaaS founders, repo analysis, build in public"
                  rows={3}
                  className="premium-input resize-none"
                />
              </div>
              <p className="text-xs text-zinc-500">
                Account safety is priority #1 — defaults use conservative rate
                limits and approval queue.
              </p>
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-red-400"
                >
                  {error}
                </motion.p>
              )}
              <ShimmerButton type="submit" disabled={loading} className="w-full">
                {loading ? "Analyzing…" : "Start growing"}
              </ShimmerButton>
            </form>
          </GlassPanel>
        </div>
      </div>
    </PremiumShell>
  );
}
