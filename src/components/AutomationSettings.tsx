"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

interface AutomationSettings {
  id: string;
  auto_post_enabled: boolean;
  suggestions_enabled: boolean;
  post_interval_hours: number;
  max_suggestions_per_day: number;
}

export default function AutomationSettings() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!session?.user) return;

    try {
      const res = await fetch("/api/automation/settings");
      const data = await res.json();
      setSettings(data.settings);
    } catch {
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);



  async function saveSettings() {
    if (!settings) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/automation/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error("Failed to save");

      const data = await res.json();
      setSettings(data.settings);
      setSuccess("Settings saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 rounded-lg bg-gray-900 border border-gray-800 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-1/3 mb-4"></div>
      </div>
    );
  }

  if (!settings) {
    return <div className="text-red-400">Failed to load automation settings</div>;
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-lg bg-red-900/30 border border-red-700 text-red-300 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 rounded-lg bg-green-900/30 border border-green-700 text-green-300 text-sm">
          ✓ {success}
        </div>
      )}

      {/* Main Settings Card */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-xl font-bold text-white mb-6">Automation Settings</h2>

        {/* Automation Toggles */}
        <div className="space-y-4 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Auto Post</h3>
              <p className="text-sm text-gray-400">Automatically post queued tweets</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.auto_post_enabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    auto_post_enabled: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Reply Suggestions</h3>
              <p className="text-sm text-gray-400">
                Draft AI reply suggestions from target accounts&apos; recent public tweets for you to review and post — nothing is ever posted, followed, or DMed automatically
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.suggestions_enabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    suggestions_enabled: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Rate Limiting Settings */}
        <div className="border-t border-gray-700 pt-6">
          <h3 className="font-semibold text-white mb-4">Rate Limits (Conservative)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Post Interval (hours)
              </label>
              <input
                type="number"
                min="2"
                max="24"
                value={settings.post_interval_hours}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    post_interval_hours: parseInt(e.target.value),
                  })
                }
                className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">Post every N hours (min 2)</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Max Suggestions/Day
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={settings.max_suggestions_per_day}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    max_suggestions_per_day: parseInt(e.target.value),
                  })
                }
                className="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">Default: 5</p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded font-medium transition-colors"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
          <p className="text-xs text-gray-500 flex items-center">
            Every reply suggestion is reviewed and posted by you — nothing is automated without your approval
          </p>
        </div>
      </div>
    </div>
  );
}
