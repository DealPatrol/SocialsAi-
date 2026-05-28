"use client";

import { useEffect, useState } from "react";

interface Settings {
  accountId: string;
  mode: "draft" | "auto";
  repliesEnabled: boolean;
  followsEnabled: boolean;
  postsEnabled: boolean;
  maxRepliesPerDay: number;
  maxFollowsPerDay: number;
  maxPostsPerDay: number;
  requireApproval: boolean;
  discloseAutomation: boolean;
  automationEnabled: boolean;
  toneMix: string[];
  targetKeywords: string[];
  productContext: string;
}

export default function AutomationSettingsForm({
  accountId,
  username,
}: {
  accountId: string;
  username: string;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/automation/settings?accountId=${accountId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          setSettings({
            accountId,
            mode: data.settings.mode,
            repliesEnabled: data.settings.repliesEnabled,
            followsEnabled: data.settings.followsEnabled,
            postsEnabled: data.settings.postsEnabled,
            maxRepliesPerDay: data.settings.maxRepliesPerDay,
            maxFollowsPerDay: data.settings.maxFollowsPerDay,
            maxPostsPerDay: data.settings.maxPostsPerDay,
            requireApproval: data.settings.requireApproval,
            discloseAutomation: data.settings.discloseAutomation,
            automationEnabled: data.automationEnabled,
            toneMix: JSON.parse(data.settings.toneMix),
            targetKeywords: JSON.parse(data.settings.targetKeywords),
            productContext: data.settings.productContext ?? "",
          });
        }
      });
  }, [accountId]);

  async function save(patch: Partial<Settings>) {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/automation/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, ...patch }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error ?? "Save failed");
      return;
    }
    setMessage("Saved");
    setSettings((s) => (s ? { ...s, ...patch } : s));
  }

  async function runNow(demo = false) {
    const res = await fetch("/api/automation/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, demo }),
    });
    const data = await res.json();
    setMessage(
      demo
        ? "Demo items added to queue — review on Automation page"
        : `Run complete: ${data.result?.postsQueued ?? 0} posts, ${data.result?.repliesQueued ?? 0} replies, ${data.result?.followsQueued ?? 0} follows queued`
    );
  }

  if (!settings) {
    return <p className="text-sm text-gray-500">Loading settings for @{username}…</p>;
  }

  return (
    <div className="space-y-4 p-4 rounded-xl border border-gray-800 bg-gray-900/50">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">@{username}</h3>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={settings.automationEnabled}
            onChange={(e) => {
              const v = e.target.checked;
              save({ automationEnabled: v });
            }}
          />
          Automation on
        </label>
      </div>

      <p className="text-xs text-gray-500">
        Compliant with X automation policies: rate limits, no spam, approval queue by default.
      </p>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="flex items-center gap-2 text-gray-300">
          <input
            type="checkbox"
            checked={settings.postsEnabled}
            onChange={(e) => save({ postsEnabled: e.target.checked })}
          />
          AI original posts
        </label>
        <label className="flex items-center gap-2 text-gray-300">
          <input
            type="checkbox"
            checked={settings.repliesEnabled}
            onChange={(e) => save({ repliesEnabled: e.target.checked })}
          />
          AI replies
        </label>
        <label className="flex items-center gap-2 text-gray-300">
          <input
            type="checkbox"
            checked={settings.followsEnabled}
            onChange={(e) => save({ followsEnabled: e.target.checked })}
          />
          Smart follows
        </label>
        <label className="flex items-center gap-2 text-gray-300">
          <input
            type="checkbox"
            checked={settings.requireApproval}
            onChange={(e) => save({ requireApproval: e.target.checked })}
          />
          Require approval
        </label>
        <label className="flex items-center gap-2 text-gray-300">
          <input
            type="checkbox"
            checked={settings.discloseAutomation}
            onChange={(e) => save({ discloseAutomation: e.target.checked })}
          />
          Disclose automation
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <label className="text-xs text-gray-500">
          Max posts/day
          <input
            type="number"
            min={1}
            max={10}
            value={settings.maxPostsPerDay}
            onChange={(e) => save({ maxPostsPerDay: Number(e.target.value) })}
            className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
          />
        </label>
        <label className="text-xs text-gray-500">
          Max replies/day
          <input
            type="number"
            min={1}
            max={50}
            value={settings.maxRepliesPerDay}
            onChange={(e) =>
              save({ maxRepliesPerDay: Number(e.target.value) })
            }
            className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
          />
        </label>
        <label className="text-xs text-gray-500">
          Max follows/day
          <input
            type="number"
            min={1}
            max={25}
            value={settings.maxFollowsPerDay}
            onChange={(e) =>
              save({ maxFollowsPerDay: Number(e.target.value) })
            }
            className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
          />
        </label>
      </div>

      <label className="block text-xs text-gray-500">
        Product context (for AI — your product or RepoFuse)
        <textarea
          value={settings.productContext}
          onChange={(e) =>
            setSettings({ ...settings, productContext: e.target.value })
          }
          onBlur={() => save({ productContext: settings.productContext })}
          rows={2}
          className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white resize-none"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => runNow(true)}
          className="text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white"
        >
          Demo queue
        </button>
        <button
          type="button"
          disabled={saving || !settings.automationEnabled}
          onClick={() => runNow(false)}
          className="text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40"
        >
          Run now
        </button>
      </div>

      {message && <p className="text-xs text-blue-400">{message}</p>}
    </div>
  );
}
