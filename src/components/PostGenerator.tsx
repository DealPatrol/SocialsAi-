"use client";

import { useState } from "react";
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

  async function generate() {
    if (!context.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

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

  const isReply = format === "reply";

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
