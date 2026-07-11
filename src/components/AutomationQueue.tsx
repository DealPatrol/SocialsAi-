"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ShimmerButton from "@/components/premium/ShimmerButton";

interface QueueItem {
  id: string;
  type: string;
  status: string;
  engagementScore: number | null;
  payload: Record<string, string | number>;
  errorMessage?: string | null;
  scheduledAt?: string | null;
  createdAt: string;
}

const typeColors: Record<string, string> = {
  post: "text-fuchsia-300 border-fuchsia-500/30 bg-fuchsia-500/10",
  reply: "text-cyan-300 border-cyan-500/30 bg-cyan-500/10",
  follow: "text-violet-300 border-violet-500/30 bg-violet-500/10",
  dm: "text-amber-300 border-amber-500/30 bg-amber-500/10",
};

export default function AutomationQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/automation/queue");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: "approve" | "reject" | "execute") {
    await fetch("/api/automation/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queueId: id, action }),
    });
    load();
  }

  if (loading) {
    return (
      <div className="flex gap-2 items-center text-sm text-zinc-500">
        <motion.span
          className="h-4 w-4 rounded-full border-2 border-cyan-500/30 border-t-cyan-400"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
        />
        Loading queue…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No queued actions. Connect X, enable automation, and run — or use Demo queue.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <AnimatePresence mode="popLayout">
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: i * 0.04 }}
            className="glass-panel !p-4"
          >
            <div className="flex justify-between items-start gap-2 mb-3">
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full border ${
                  typeColors[item.type] ?? typeColors.reply
                }`}
              >
                {item.type} · {item.status}
              </span>
              {item.scheduledAt && (
                <span className="text-xs text-zinc-500">
                  due {new Date(item.scheduledAt).toLocaleString()}
                </span>
              )}
              {item.engagementScore != null && (
                <span className="text-xs font-mono text-emerald-400">
                  {item.engagementScore}
                </span>
              )}
            </div>
            {item.type === "reply" && (
              <div className="text-sm space-y-2">
                <p className="text-zinc-500">
                  → @{String(item.payload.authorUsername)}
                </p>
                <p className="text-zinc-400 italic text-xs">
                  &ldquo;{String(item.payload.tweetText)}&rdquo;
                </p>
                <p className="text-zinc-100">{String(item.payload.replyText)}</p>
              </div>
            )}
            {item.type === "post" && (
              <div className="text-sm space-y-2">
                <p className="text-zinc-500 text-xs">
                  {String(item.payload.pillarLabel ?? "Original post")}
                </p>
                <p className="text-zinc-100">{String(item.payload.postText)}</p>
              </div>
            )}
            {item.type === "follow" && (
              <p className="text-sm text-zinc-200">
                Follow @{String(item.payload.username)} —{" "}
                {String(item.payload.reason)}
              </p>
            )}
            {item.type === "dm" && (
              <div className="text-sm space-y-2">
                <p className="text-zinc-500">DM → @{String(item.payload.username)}</p>
                <p className="text-zinc-100">{String(item.payload.dmText)}</p>
                {item.payload.warmReason && (
                  <p className="text-xs text-zinc-500">
                    {String(item.payload.warmReason)}
                  </p>
                )}
              </div>
            )}
            {item.errorMessage && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-300">
                  X API error
                </p>
                <p className="mt-1 break-words text-xs text-red-200">
                  {item.errorMessage}
                </p>
              </div>
            )}
            {(item.status === "pending" || item.status === "failed") && (
              <div className="flex gap-2 mt-4">
                <ShimmerButton
                  type="button"
                  className="!py-1.5 !px-3 !text-xs"
                  onClick={() =>
                    act(item.id, item.status === "failed" ? "execute" : "approve")
                  }
                >
                  {item.status === "failed" ? "Retry post" : "Post now"}
                </ShimmerButton>
                {item.status === "pending" && (
                  <ShimmerButton
                    type="button"
                    variant="ghost"
                    className="!py-1.5 !px-3 !text-xs"
                    onClick={() => act(item.id, "reject")}
                  >
                    Reject
                  </ShimmerButton>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
