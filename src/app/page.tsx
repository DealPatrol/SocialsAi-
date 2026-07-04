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
        </div>

        {/* Strategy quick-ref */}
        <div className="mb-8 p-4 rounded-xl bg-gray-900 border border-gray-800">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Daily Cadence
          </p>
          <div className="space-y-1.5">
            {[
              "30–60 min replying to @levelsio, @dvassallo, @arvidkahl, @shl, @marc_louvion",
              "3–5 posts/day across all 5 content pillars",
              "Post natively with video when possible — algo boost",
              "Engage in first 30 min after posting for velocity",
            ].map((tip, i) => (
              <div key={i} className="flex gap-2 text-xs text-gray-400">
                <span className="text-blue-500 shrink-0">›</span>
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Generator */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
          <PostGenerator />
        </div>

        <p className="text-center text-xs text-gray-600 mt-8">
          Powered by Claude · Built with the RepoFuse growth strategy
        </p>
      </div>
    </main>
  );
}
