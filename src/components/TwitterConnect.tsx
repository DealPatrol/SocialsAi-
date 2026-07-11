"use client";

import { useEffect, useState } from "react";

export default function TwitterConnect() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/twitter/status")
      .then((r) => r.json())
      .then((d) => setConnected(d.connected));

    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      setConnected(true);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  async function disconnect() {
    const res = await fetch("/api/auth/twitter/status", { method: "DELETE" });
    if (res.ok) {
      setConnected(false);
    }
  }

  if (connected === null) return null;

  if (connected) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs text-green-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
          X connected
        </span>
        <button
          onClick={disconnect}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        window.location.href = "/api/auth/x/login";
      }}
      className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white transition-all"
    >
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.741l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
      </svg>
      Connect X
    </button>
  );
}
