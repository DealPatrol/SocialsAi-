"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CONTENT_PILLARS, POST_FORMATS, TARGET_ACCOUNTS } from "@/lib/strategy";
import type { PillarId, FormatId } from "@/lib/strategy";
import type { GenerateResponse } from "@/app/api/generate/route";
import ShimmerButton from "@/components/premium/ShimmerButton";

export default function PostGenerator() {
  const [format, setFormat] = useState<FormatId>("single-tweet");
  const [pillarId, setPillarId] = useState<PillarId>("build-in-public");
  const [context, setContext] = useState("");
  const [replyToTweet, setReplyToTweet] = useState("");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [twitterConnected, setTwitterConnected] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<"queue" | "now">("queue");
  const [posting, setPosting] = useState<number | "thread" | null>(null);
  const [posted, setPosted] = useState<number | "thread" | null>(null);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((d) => {
        const account = d.accounts?.find(
          (a: { platform: string }) => a.platform === "x"
        );
        setTwitterConnected(!!account);
        setAccountId(account?.id ?? null);
      })
      .catch(() => setTwitterConnected(false));
  }, []);

  async function generate() {
    if (!context.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setPosted(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, pillarId, context, replyToTweet }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function copyPost(text: string, idx: number) {
    await navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 1500);
  }

  async function queueTweets(tweets: string[], key: number | "thread") {
    setPosting(key);
    try {
      const res = await fetch("/api/automation/queue-tweet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweets, accountId, schedule }),
      });
      const data = await res.json();
      if (res.status === 401) setTwitterConnected(false);
      if (!res.ok) throw new Error(data.error ?? "Queue failed");
      setPosted(key);
      setTimeout(() => setPosted(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to queue");
    } finally {
      setPosting(null);
    }
  }

  const isReply = format === "reply";
  const isThread = format === "thread";

  return (
    <div className="space-y-6">
      <div>
        <label className="premium-label">Post format</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {POST_FORMATS.map((f) => (
            <motion.button
              key={f.id}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => setFormat(f.id as FormatId)}
              className={`premium-chip ${
                format === f.id ? "premium-chip-active" : ""
              }`}
            >
              <div className="font-medium text-sm text-zinc-100">{f.label}</div>
              <div className="text-xs mt-1 text-zinc-500">{f.description}</div>
            </motion.button>
          ))}
        </div>
      </div>

      <div>
        <label className="premium-label">Content pillar</label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CONTENT_PILLARS.map((p) => (
            <motion.button
              key={p.id}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => setPillarId(p.id as PillarId)}
              className={`premium-chip ${
                pillarId === p.id ? "premium-chip-active-purple" : ""
              }`}
            >
              <div className="font-medium text-sm text-zinc-100">{p.label}</div>
              <div className="text-xs mt-1 text-zinc-500">{p.description}</div>
            </motion.button>
          ))}
        </div>
      </div>

      {isReply && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          <label className="premium-label">Tweet to reply to</label>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {TARGET_ACCOUNTS.map((a) => (
              <span
                key={a.handle}
                className="text-[10px] px-2 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-200 font-mono"
              >
                {a.handle}
              </span>
            ))}
          </div>
          <textarea
            value={replyToTweet}
            onChange={(e) => setReplyToTweet(e.target.value)}
            rows={3}
            placeholder="Paste the tweet you want to reply to..."
            className="premium-input resize-none"
          />
        </motion.div>
      )}

      <div>
        <label className="premium-label">
          {isReply ? "Your angle" : "What to share"}
        </label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={4}
          placeholder={
            isReply
              ? "e.g. RepoFuse found 3 monetizable ideas in my oldest repos..."
              : "e.g. Just hit 100 repo scans. Most common finding..."
          }
          className="premium-input resize-none"
        />
      </div>

      <ShimmerButton
        type="button"
        onClick={generate}
        disabled={loading || !context.trim()}
        className="w-full"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <motion.span
              className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
            />
            Generating…
          </span>
        ) : (
          "Generate posts"
        )}
      </ShimmerButton>

      <div className="grid grid-cols-2 gap-2">
        {[
          ["queue", "Queue for auto-posting"],
          ["now", "Post immediately"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setSchedule(value as "queue" | "now")}
            className={`premium-chip text-sm ${
              schedule === value ? "premium-chip-active" : ""
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Generated — {result.pillar}
              </span>
              <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                {isThread ? `${result.posts.length} tweets` : `${result.posts.length} options`}
              </span>
            </div>
            {/* Post thread as one action */}
            {isThread && twitterConnected && (
              <button
                onClick={() => queueTweets(result.posts, "thread")}
                disabled={posting === "thread"}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                  posted === "thread"
                    ? "bg-green-600/20 border border-green-600 text-green-400"
                    : "bg-gray-800 border border-gray-600 text-gray-300 hover:border-blue-500 hover:text-blue-300 disabled:opacity-50"
                }`}
              >
                <XIcon />
                {posting === "thread"
                  ? "Queueing..."
                  : posted === "thread"
                    ? schedule === "now"
                      ? "Posted!"
                      : "Queued!"
                    : schedule === "now"
                      ? "Post now"
                      : "Queue thread"}
              </button>
            )}
          </div>

          {result.posts.map((post, idx) => (
            <div
              key={idx}
              className="relative p-4 rounded-lg bg-gray-800 border border-gray-700"
            >
              {isThread ? (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-xs text-gray-300 shrink-0">
                      {idx + 1}
                    </div>
                    {idx < result.posts.length - 1 && (
                      <div className="w-px flex-1 bg-gray-600 mt-1" />
                    )}
                  </div>
                  <p className="text-sm text-gray-100 leading-relaxed whitespace-pre-wrap pt-0.5">
                    {post}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-100 leading-relaxed whitespace-pre-wrap">
                  {post}
                </p>
              )}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700">
                <span className="text-xs text-gray-500">{post.length} chars</span>
                <div className="flex items-center gap-2">
                  {twitterConnected && !isThread && (
                    <button
                      onClick={() => queueTweets([post], idx)}
                      disabled={posting === idx}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded transition-all ${
                        posted === idx
                          ? "bg-green-600/20 border border-green-600 text-green-400"
                          : "bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-50"
                      }`}
                    >
                      <XIcon />
                      {posting === idx
                        ? "Queueing..."
                        : posted === idx
                          ? schedule === "now"
                            ? "Posted!"
                            : "Queued!"
                          : schedule === "now"
                            ? "Post now"
                            : "Queue"}
                    </button>
                  )}
                  <button
                    onClick={() => copyPost(post, idx)}
                    className="text-xs text-gray-400 hover:text-white transition-colors px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
                  >
                    {copied === idx ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {!twitterConnected && (
            <p className="text-xs text-gray-500 text-center">
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/api/auth/x/login";
                }}
                className="text-blue-400 hover:underline"
              >
                Sign in with X
              </button>{" "}
              to queue automated posts
            </p>
          )}
        </div>
      )}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2">
              <span className="premium-label !mb-0">
                Generated — {result.pillar}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                {result.posts.length}{" "}
                {result.posts.length === 1 ? "option" : "options"}
              </span>
            </div>
            {result.posts.map((post, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.08 }}
                className="glass-panel !p-4 group"
              >
                {format === "thread" ? (
                  <div className="space-y-3">
                    {post.split("\n").filter(Boolean).map((line, li) => (
                      <p
                        key={li}
                        className="text-sm text-zinc-100 leading-relaxed"
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-100 leading-relaxed whitespace-pre-wrap">
                    {post}
                  </p>
                )}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                  <span className="text-xs text-zinc-500 font-mono">
                    {post.length} chars
                  </span>
                  <ShimmerButton
                    type="button"
                    variant="ghost"
                    className="!py-1.5 !px-3 !text-xs"
                    onClick={() => copyPost(post, idx)}
                  >
                    {copied === idx ? "Copied!" : "Copy"}
                  </ShimmerButton>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current shrink-0" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.741l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}
