"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import ShimmerButton from "@/components/premium/ShimmerButton";

type GrowthPreset = "safe" | "balanced" | "aggressive";

interface Settings {
  accountId: string;
  mode: "draft" | "auto";
  growthPreset: GrowthPreset;
  repliesEnabled: boolean;
  threadRepliesEnabled: boolean;
  followsEnabled: boolean;
  postsEnabled: boolean;
  dmsEnabled: boolean;
  maxRepliesPerDay: number;
  maxFollowsPerDay: number;
  maxPostsPerDay: number;
  maxDmsPerDay: number;
  minMinutesBetweenActions: number;
  requireApproval: boolean;
  discloseAutomation: boolean;
  automationEnabled: boolean;
  toneMix: string[];
  targetKeywords: string[];
  targetAccounts: string[];
  productContext: string;
  websiteUrl: string;
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
            growthPreset: data.settings.growthPreset ?? "safe",
            repliesEnabled: data.settings.repliesEnabled,
            threadRepliesEnabled: data.settings.threadRepliesEnabled ?? true,
            followsEnabled: data.settings.followsEnabled,
            postsEnabled: data.settings.postsEnabled,
            dmsEnabled: data.settings.dmsEnabled ?? false,
            maxRepliesPerDay: data.settings.maxRepliesPerDay,
            maxFollowsPerDay: data.settings.maxFollowsPerDay,
            maxPostsPerDay: data.settings.maxPostsPerDay,
            maxDmsPerDay: data.settings.maxDmsPerDay ?? 3,
            minMinutesBetweenActions:
              data.settings.minMinutesBetweenActions ?? 10,
            requireApproval: data.settings.requireApproval,
            discloseAutomation: data.settings.discloseAutomation,
            automationEnabled: data.automationEnabled,
            toneMix: JSON.parse(data.settings.toneMix),
            targetKeywords: JSON.parse(data.settings.targetKeywords),
            targetAccounts: JSON.parse(
              data.settings.targetAccounts ?? "[]"
            ),
            productContext: data.settings.productContext ?? "",
            websiteUrl: data.settings.websiteUrl ?? "",
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
        : `Run: ${data.result?.postsQueued ?? 0} posts, ${data.result?.repliesQueued ?? 0} replies, ${data.result?.followsQueued ?? 0} follows, ${data.result?.dmsQueued ?? 0} DMs`
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
        Account safety first — presets cap rates below X abuse thresholds.
        Approval queue on by default.
      </p>

      <label className="premium-label">
        Growth preset
        <select
          value={settings.growthPreset}
          onChange={(e) =>
            save({ growthPreset: e.target.value as GrowthPreset })
          }
          className="premium-input mt-1"
        >
          <option value="safe">Safe — slowest, lowest ban risk</option>
          <option value="balanced">Balanced — steady growth</option>
          <option value="aggressive">Aggressive — max compliant volume</option>
        </select>
      </label>

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
          checked={settings.threadRepliesEnabled}
          onChange={(v) => save({ threadRepliesEnabled: v })}
          label="Thread targeting"
        />
        <Toggle
          checked={settings.followsEnabled}
          onChange={(v) => save({ followsEnabled: v })}
          label="Smart follows"
        />
        <Toggle
          checked={settings.dmsEnabled}
          onChange={(v) => save({ dmsEnabled: v })}
          label="Warm DMs (after reply)"
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            ["Posts/day", "maxPostsPerDay", 10],
            ["Replies/day", "maxRepliesPerDay", 50],
            ["Follows/day", "maxFollowsPerDay", 25],
            ["DMs/day", "maxDmsPerDay", 5],
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
        Min minutes between actions
        <input
          type="number"
          min={5}
          max={60}
          value={settings.minMinutesBetweenActions}
          onChange={(e) =>
            setSettings({
              ...settings,
              minMinutesBetweenActions: Number(e.target.value),
            })
          }
          onBlur={() =>
            save({
              minMinutesBetweenActions: settings.minMinutesBetweenActions,
            })
          }
          className="premium-input mt-1"
        />
      </label>

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

      <label className="premium-label">
        Target keywords (comma-separated)
        <input
          value={settings.targetKeywords.join(", ")}
          onChange={(e) =>
            setSettings({
              ...settings,
              targetKeywords: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          onBlur={() => save({ targetKeywords: settings.targetKeywords })}
          className="premium-input mt-1"
        />
      </label>

      <label className="premium-label">
        Authority accounts to engage (comma-separated, no @)
        <input
          value={settings.targetAccounts.join(", ")}
          onChange={(e) =>
            setSettings({
              ...settings,
              targetAccounts: e.target.value
                .split(",")
                .map((s) => s.trim().replace(/^@/, ""))
                .filter(Boolean),
            })
          }
          onBlur={() => save({ targetAccounts: settings.targetAccounts })}
          className="premium-input mt-1"
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
