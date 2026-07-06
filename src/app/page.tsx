import Link from "next/link";
import PostGenerator from "@/components/PostGenerator";
import PremiumShell from "@/components/premium/PremiumShell";
import GlassPanel from "@/components/premium/GlassPanel";
import Logo from "@/components/premium/Logo";
import PageHeader from "@/components/premium/PageHeader";

export default function Home() {
  return (
    <PremiumShell>
      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
        <div className="flex items-center justify-between gap-4 mb-2">
          <Logo />
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-xl px-4 py-2 text-xs font-semibold border border-white/15 bg-white/5 text-zinc-200 hover:border-cyan-400/40 transition-all"
          >
            Dashboard →
          </Link>
        </div>

        <PageHeader
          badge="RepoFuse · AI Growth"
          title="Viral-grade content. Policy-safe automation."
          subtitle={
            <>
              Generate tweets, threads, and strategic replies — or{" "}
              <Link
                href="/api/auth/x/login"
                className="text-cyan-400 hover:text-cyan-300 underline-offset-4 hover:underline"
              >
                sign in with X
              </Link>{" "}
              for AI that finds high-intent conversations, smart follows, and
              warm DMs that grow your account safely.
            </>
          }
        />

        <GlassPanel delay={1} className="mb-8">
          <p className="premium-label mb-4">Growth tactics (compliant)</p>
          <div className="space-y-3">
            {[
              "Thread replies where your ICP is already reading",
              "Authority account engagement in your niche",
              "Smart follows scored for follow-back likelihood",
              "Warm DMs only after genuine public interaction",
              "Original posts across proven content pillars",
            ].map((tip, i) => (
              <div
                key={i}
                className="flex gap-3 text-xs text-zinc-400 group"
              >
                <span className="text-cyan-400 font-mono shrink-0 group-hover:scale-125 transition-transform">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="group-hover:text-zinc-200 transition-colors">
                  {tip}
                </span>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel delay={2}>
          <PostGenerator />
        </GlassPanel>

        <p className="text-center text-xs text-zinc-600 mt-10 font-mono tracking-wider">
          POWERED BY CLAUDE · ACCOUNT SAFETY FIRST
        </p>
      </div>
    </PremiumShell>
  );
}
