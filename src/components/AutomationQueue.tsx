"use client";

import { useCallback, useEffect, useState } from "react";

interface QueueItem {
  id: string;
  type: string;
  status: string;
  engagementScore: number | null;
  payload: Record<string, string | number>;
  createdAt: string;
}

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

  async function act(id: string, action: "approve" | "reject") {
    await fetch("/api/automation/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queueId: id, action }),
    });
    load();
  }

  if (loading) return <p className="text-sm text-gray-500">Loading queue…</p>;

  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No queued actions. Connect X, enable automation, and run a cycle — or use Demo queue.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="p-4 rounded-lg border border-gray-800 bg-gray-900"
        >
          <div className="flex justify-between items-start gap-2 mb-2">
            <span className="text-xs font-semibold uppercase text-gray-500">
              {item.type} · {item.status}
            </span>
            {item.engagementScore != null && (
              <span className="text-xs text-emerald-400">
                score {item.engagementScore}
              </span>
            )}
          </div>
          {item.type === "reply" && (
            <div className="text-sm space-y-2">
              <p className="text-gray-500">
                Replying to @{String(item.payload.authorUsername)}
              </p>
              <p className="text-gray-400 italic">
                &ldquo;{String(item.payload.tweetText)}&rdquo;
              </p>
              <p className="text-white">{String(item.payload.replyText)}</p>
            </div>
          )}
          {item.type === "post" && (
            <div className="text-sm space-y-2">
              <p className="text-gray-500">
                Original post · {String(item.payload.pillarLabel ?? "content")}
              </p>
              <p className="text-white">{String(item.payload.postText)}</p>
            </div>
          )}
          {item.type === "follow" && (
            <p className="text-sm text-gray-200">
              Follow @{String(item.payload.username)} —{" "}
              {String(item.payload.reason)} (prospect{" "}
              {String(item.payload.prospectScore)})
            </p>
          )}
          {item.status === "pending" && (
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => act(item.id, "approve")}
                className="text-xs px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white"
              >
                Approve & post
              </button>
              <button
                type="button"
                onClick={() => act(item.id, "reject")}
                className="text-xs px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
