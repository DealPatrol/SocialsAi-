import Link from "next/link";
import PostGenerator from "@/components/PostGenerator";
import TwitterConnect from "@/components/TwitterConnect";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                S
              </div>
              <span className="text-sm font-medium text-gray-400">SocialsAI</span>
            </div>
            <TwitterConnect />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            RepoFuse Growth Engine
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Generate tweets, threads, and strategic replies using the{" "}
            <span className="text-blue-400">Reply + Build in Public</span> playbook.
            Baked-in voice, content pillars, and target account strategy.
          </p>
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
                href="/register"
                className="text-cyan-400 hover:text-cyan-300 underline-offset-4 hover:underline"
              >
                connect your X account
              </Link>{" "}
              for AI that finds high-intent conversations and drafts replies your
              audience actually engages with.
            </>
          }
        />

        <GlassPanel delay={1} className="mb-8">
          <p className="premium-label mb-4">Daily cadence</p>
          <div className="space-y-3">
            {[
              "30–60 min replying to @levelsio, @dvassallo, @arvidkahl, @shl, @marc_louvion",
              "3–5 posts/day across all 5 content pillars",
              "Post natively with video when possible — algo boost",
              "Engage in first 30 min after posting for velocity",
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
          POWERED BY CLAUDE · REPOFUSE GROWTH STRATEGY
        </p>
      </div>
    </PremiumShell>
  );
}
