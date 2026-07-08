"use client";

import { useEffect, useState } from "react";

interface StatusResponse {
  postedTweets: Array<{
    id: string;
    text: string;
    tweetId: string;
    postedAt: string;
  }>;
  engagement: Array<{
    id: string;
    action: string;
    status: string;
    targetUsername?: string | null;
    targetTweetId?: string | null;
    reason?: string | null;
    scheduledAt?: string | null;
    executedAt?: string | null;
    createdAt: string;
  }>;
}

export default function AutomationStatus() {
  const [status, setStatus] = useState<StatusResponse | null>(null);

  useEffect(() => {
    fetch("/api/automation/status")
      .then((res) => res.json())
      .then((data) => setStatus(data));
  }, []);

  if (!status) {
    return <p className="text-sm text-zinc-500 animate-pulse">Loading activity…</p>;
  }

  const recentEngagement = status.engagement.slice(0, 12);
  const recentPosts = status.postedTweets.slice(0, 5);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="glass-panel !p-4">
        <p className="premium-label mb-3">Posted tweets</p>
        {recentPosts.length === 0 ? (
          <p className="text-sm text-zinc-500">No automated posts yet.</p>
        ) : (
          <div className="space-y-3">
            {recentPosts.map((post) => (
              <div key={post.id} className="rounded-xl border border-white/10 p-3">
                <p className="text-sm text-zinc-100">{post.text}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  {new Date(post.postedAt).toLocaleString()} · #{post.tweetId}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel !p-4">
        <p className="premium-label mb-3">Engagement history</p>
        {recentEngagement.length === 0 ? (
          <p className="text-sm text-zinc-500">No likes, follows, or DMs yet.</p>
        ) : (
          <div className="space-y-2">
            {recentEngagement.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-zinc-100">
                    {item.action} · {item.status}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {item.targetUsername ? `@${item.targetUsername}` : item.targetTweetId ?? ""}
                    {item.reason ? ` — ${item.reason}` : ""}
                  </p>
                </div>
                <span className="text-xs text-zinc-500">
                  {new Date(item.executedAt ?? item.scheduledAt ?? item.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
