"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface QueueItem {
  id: string;
  tweet_content: string;
  scheduled_for: string;
  posted_at: string | null;
  status: "pending" | "posted" | "failed";
  error_message: string | null;
  posted_tweet_id: string | null;
  created_at: string;
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function AutomationQueue() {
  const { data: session } = useSession();
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    if (!session?.user) return;
    try {
      const res = await fetch("/api/automation/queue");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details ?? data.error ?? "Failed to load queue");
      }
      setQueue(data.queue ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load queue");
      setQueue([]);
    }
  }, [session]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  async function retry(action: "retry" | "retry-failed", id?: string) {
    setBusy(id ?? "all");
    setError(null);
    try {
      const res = await fetch("/api/automation/queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details ?? data.error ?? "Failed to retry");
      }
      await fetchQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to retry");
    } finally {
      setBusy(null);
    }
  }

  if (!session?.user) {
    return (
      <p className="text-sm text-gray-400">
        Log in with Twitter to see queued posts.
      </p>
    );
  }

  if (!queue) {
    return <p className="text-sm text-gray-500 animate-pulse">Loading queue…</p>;
  }

  const failedCount = queue.filter((item) => item.status === "failed").length;

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Auto Post publishes these when it is enabled. Sign in with Twitter at
        least once after deploy so your posting token is stored for cron.
      </p>

      {error && (
        <div className="p-4 rounded-lg bg-red-900/30 border border-red-700 text-red-300 text-sm">
          {error}
        </div>
      )}

      {failedCount > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-amber-300">
            {failedCount} failed. If you see credits depleted, add X API credits
            in the Developer Portal, then retry.
          </p>
          <button
            onClick={() => retry("retry-failed")}
            disabled={busy !== null}
            className="text-xs text-white px-3 py-1 rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-50"
          >
            {busy === "all" ? "Retrying..." : "Retry failed"}
          </button>
        </div>
      )}

      {queue.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nothing queued yet. Generate a post and click Queue.
        </p>
      ) : (
        queue.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-lg bg-gray-800 border border-gray-700 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-xs font-semibold uppercase tracking-wider ${
                  item.status === "posted"
                    ? "text-green-400"
                    : item.status === "failed"
                      ? "text-red-400"
                      : "text-blue-300"
                }`}
              >
                {item.status}
              </span>
              <span className="text-xs text-gray-500">
                {item.status === "posted" && item.posted_at
                  ? `Posted ${formatWhen(item.posted_at)}`
                  : `Scheduled ${formatWhen(item.scheduled_for)}`}
              </span>
            </div>
            <p className="text-sm text-gray-100 whitespace-pre-wrap">
              {item.tweet_content}
            </p>
            {item.error_message && (
              <p className="text-xs text-red-300">{item.error_message}</p>
            )}
            {item.status === "failed" && (
              <button
                onClick={() => retry("retry", item.id)}
                disabled={busy !== null}
                className="text-xs text-white px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
              >
                {busy === item.id ? "Retrying..." : "Retry"}
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
