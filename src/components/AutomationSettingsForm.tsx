"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import ShimmerButton from "@/components/premium/ShimmerButton";

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

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 text-sm text-zinc-300 cursor-pointer group">
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? "bg-cyan-500/60" : "bg-white/10"
        }`}
      >
        <motion.span
          className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow"
          animate={{ x: checked ? 16 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
      </span>
      {label}
    </label>
  );
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
        ? "Demo items added to queue"
        : `Run: ${data.result?.postsQueued ?? 0} posts, ${data.result?.repliesQueued ?? 0} replies, ${data.result?.followsQueued ?? 0} follows`
    );
  }

  if (!settings) {
    return (
      <p className="text-sm text-zinc-500 animate-pulse">
        Loading @{username}…
      </p>
    );
  }

  return (
    <div className="glass-panel space-y-5 !p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold gradient-text-subtle">
          @{username}
        </h3>
        <Toggle
          checked={settings.automationEnabled}
          onChange={(v) => save({ automationEnabled: v })}
          label="Automation on"
        />
      </div>

      <p className="text-xs text-zinc-500">
        X-compliant rate limits · approval queue by default
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Toggle
          checked={settings.postsEnabled}
          onChange={(v) => save({ postsEnabled: v })}
          label="AI original posts"
        />
        <Toggle
          checked={settings.repliesEnabled}
          onChange={(v) => save({ repliesEnabled: v })}
          label="AI replies"
        />
        <Toggle
          checked={settings.followsEnabled}
          onChange={(v) => save({ followsEnabled: v })}
          label="Smart follows"
        />
        <Toggle
          checked={settings.requireApproval}
          onChange={(v) => save({ requireApproval: v })}
          label="Require approval"
        />
        <Toggle
          checked={settings.discloseAutomation}
          onChange={(v) => save({ discloseAutomation: v })}
          label="Disclose automation"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ["Max posts/day", "maxPostsPerDay", 10],
            ["Max replies/day", "maxRepliesPerDay", 50],
            ["Max follows/day", "maxFollowsPerDay", 25],
          ] as const
        ).map(([label, key, max]) => (
          <label key={key} className="premium-label !text-[10px]">
            {label}
            <input
              type="number"
              min={1}
              max={max}
              value={settings[key]}
              onChange={(e) =>
                save({ [key]: Number(e.target.value) } as Partial<Settings>)
              }
              className="premium-input mt-1 !py-1.5"
            />
          </label>
        ))}
      </div>

      <label className="premium-label">
        Product context
        <textarea
          value={settings.productContext}
          onChange={(e) =>
            setSettings({ ...settings, productContext: e.target.value })
          }
          onBlur={() => save({ productContext: settings.productContext })}
          rows={2}
          className="premium-input mt-1 resize-none"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <ShimmerButton
          type="button"
          variant="ghost"
          disabled={saving}
          onClick={() => runNow(true)}
          className="!text-xs"
        >
          Demo queue
        </ShimmerButton>
        <ShimmerButton
          type="button"
          disabled={saving || !settings.automationEnabled}
          onClick={() => runNow(false)}
          className="!text-xs"
        >
          Run now
        </ShimmerButton>
      </div>

      {message && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-cyan-400"
        >
          {message}
        </motion.p>
      )}
    </div>
  );
}
