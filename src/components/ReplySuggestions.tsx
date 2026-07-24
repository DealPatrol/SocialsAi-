"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

interface ReplySuggestion {
  id: string;
  target_handle: string;
  target_tweet_id: string;
  target_tweet_text: string;
  suggested_reply: string;
}

export default function ReplySuggestions() {
  const { data: session } = useSession();
  const [suggestions, setSuggestions] = useState<ReplySuggestion[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    if (!session?.user) return;

    try {
      const res = await fetch("/api/automation/suggestions");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load suggestions");
      }
      setSuggestions(data.suggestions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load suggestions");
      setSuggestions([]);
    }
  }, [session]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  async function resolve(id: string, action: "post" | "dismiss") {
    setBusyId(id);
    setError(null);

    try {
      const res = await fetch(`/api/automation/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "post" ? { action, text: drafts[id] } : { action }
        ),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to update suggestion");
      }

      setSuggestions((prev) => prev?.filter((s) => s.id !== id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  if (!session?.user) {
    return (
      <p className="text-sm text-gray-400">
        Log in with Twitter to see reply suggestions.
      </p>
    );
  }

  if (!suggestions) {
    return <p className="text-sm text-gray-500 animate-pulse">Loading suggestions…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Claude drafts these from public tweets of target accounts in your niche. Nothing
        is posted until you review, optionally edit, and click Post.
      </p>

      {error && (
        <div className="p-4 rounded-lg bg-red-900/30 border border-red-700 text-red-300 text-sm">
          {error}
        </div>
      )}

      {suggestions.length === 0 ? (
        <p className="text-sm text-gray-500">
          No pending suggestions. Enable Reply Suggestions in Automation Settings to have
          new ones drafted automatically.
        </p>
      ) : (
        suggestions.map((s) => {
          const draft = drafts[s.id] ?? s.suggested_reply;
          return (
            <div
              key={s.id}
              className="p-4 rounded-lg bg-gray-800 border border-gray-700 space-y-3"
            >
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  {s.target_handle}
                </p>
                <p className="text-sm text-gray-400 italic">&ldquo;{s.target_tweet_text}&rdquo;</p>
              </div>

              <textarea
                value={draft}
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))
                }
                rows={3}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500 resize-none"
              />

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{draft.length} chars</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => resolve(s.id, "dismiss")}
                    disabled={busyId === s.id}
                    className="text-xs text-gray-400 hover:text-white transition-colors px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => resolve(s.id, "post")}
                    disabled={busyId === s.id}
                    className="text-xs text-white transition-colors px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
                  >
                    {busyId === s.id ? "Posting..." : "Post Reply"}
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
