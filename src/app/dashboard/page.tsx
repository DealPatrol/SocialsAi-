import Link from "next/link";
import GlassPanel from "@/components/premium/GlassPanel";
import PageHeader from "@/components/premium/PageHeader";

const linkPrimary =
  "inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 text-white shadow-[0_0_40px_-8px_rgba(34,211,238,0.5)] hover:scale-[1.02] transition-transform";

const linkGhost =
  "inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold border border-white/15 bg-white/5 text-zinc-200 hover:border-cyan-400/40 hover:scale-[1.02] transition-all";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        badge="Command center"
        title="Growth automation"
        subtitle="AI drafts original posts and strategic replies tuned for engagement — with approval queues and X-compliant rate limits by default."
      />

      <GlassPanel delay={0}>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/accounts" className={linkPrimary}>
            Connect accounts
          </Link>
          <Link href="/dashboard/automation" className={linkGhost}>
            Automation queue
          </Link>
        </div>
      </GlassPanel>

      <GlassPanel delay={1} className="!border-amber-500/20">
        <p className="premium-label text-amber-300/90">X compliance</p>
        <ul className="text-xs text-zinc-400 space-y-2 mt-3">
          {[
            "Official X API only — no scraping",
            "Conservative daily/hourly caps",
            "Spam & engagement-bait blocked",
            "Approval queue on by default",
            "Instagram, Facebook, YouTube coming soon",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-cyan-400">◆</span>
              {item}
            </li>
          ))}
        </ul>
      </GlassPanel>
    </div>
  );
}
