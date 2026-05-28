import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <section className="p-6 rounded-2xl border border-gray-800 bg-gray-900">
        <h2 className="font-semibold text-white mb-2">RepoFuse growth automation</h2>
        <p className="text-sm text-gray-400 leading-relaxed mb-4">
          Connect X (more platforms soon). AI finds high-intent conversations, drafts
          replies tuned for engagement — funny, serious, empathetic, always informative —
          and optionally follows indie hackers likely to need repo intelligence tools.
          Everything runs through approval queues and X-compliant rate limits by default.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/accounts"
            className="text-sm px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white"
          >
            Connect accounts
          </Link>
          <Link
            href="/dashboard/automation"
            className="text-sm px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:border-gray-400"
          >
            Automation & queue
          </Link>
        </div>
      </section>

      <section className="p-4 rounded-xl border border-amber-900/50 bg-amber-950/20">
        <p className="text-xs font-semibold text-amber-400 uppercase mb-2">
          X compliance
        </p>
        <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
          <li>Uses official X API only — no scraping or bots</li>
          <li>Conservative daily/hourly caps on replies and follows</li>
          <li>Spam and engagement-bait patterns blocked before posting</li>
          <li>Approval queue on by default — you stay in control</li>
          <li>Instagram, Facebook, YouTube marked coming soon</li>
        </ul>
      </section>
    </div>
  );
}
