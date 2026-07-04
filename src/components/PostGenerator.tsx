"use client";

import { useEffect, useState } from "react";
import { CONTENT_PILLARS, POST_FORMATS, TARGET_ACCOUNTS } from "@/lib/strategy";
import type { PillarId, FormatId } from "@/lib/strategy";
import type { GenerateResponse } from "@/app/api/generate/route";

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
  const [posting, setPosting] = useState<number | "thread" | null>(null);
  const [posted, setPosted] = useState<number | "thread" | null>(null);

  useEffect(() => {
    fetch("/api/auth/twitter/status")
      .then((r) => r.json())
      .then((d) => setTwitterConnected(d.connected));
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

  async function postToTwitter(tweets: string[], key: number | "thread") {
    setPosting(key);
    try {
      const res = await fetch("/api/tweet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweets }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Post failed");
      setPosted(key);
      setTimeout(() => setPosted(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setPosting(null);
    }
  }

  const isReply = format === "reply";
  const isThread = format === "thread";

  return (
    <div className="space-y-6">
      {/* Format selector */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">
          Post Format
        </label>
        <div className="grid grid-cols-3 gap-2">
          {POST_FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id as FormatId)}
              className={`p-3 rounded-lg border text-left transition-all ${
                format === f.id
                  ? "border-blue-500 bg-blue-500/10 text-blue-300"
                  : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500"
              }`}
            >
              <div className="font-medium text-sm">{f.label}</div>
              <div className="text-xs mt-1 opacity-70">{f.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Content pillar */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">
          Content Pillar
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CONTENT_PILLARS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPillarId(p.id as PillarId)}
              className={`p-3 rounded-lg border text-left transition-all ${
                pillarId === p.id
                  ? "border-purple-500 bg-purple-500/10 text-purple-300"
                  : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500"
              }`}
            >
              <div className="font-medium text-sm">{p.label}</div>
              <div className="text-xs mt-1 opacity-70">{p.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Reply-to tweet input */}
      {isReply && (
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Tweet to Reply To
          </label>
          <div className="mb-2">
            <p className="text-xs text-gray-500 mb-2">
              Target accounts in your niche:
            </p>
            <div className="flex flex-wrap gap-1">
              {TARGET_ACCOUNTS.map((a) => (
                <span
                  key={a.handle}
                  className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded"
                >
                  {a.handle}
                </span>
              ))}
            </div>
          </div>
          <textarea
            value={replyToTweet}
            onChange={(e) => setReplyToTweet(e.target.value)}
            rows={3}
            placeholder="Paste the tweet text you want to reply to..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>
      )}

      {/* Context */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">
          {isReply ? "Your Angle / What to Draw From" : "What Do You Want to Share?"}
        </label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={4}
          placeholder={
            isReply
              ? "e.g. I just shipped a feature that scans for dead code patterns. RepoFuse found 3 monetizable ideas in my oldest repos."
              : "e.g. Just hit 100 repo scans. Most common finding: devs have e-commerce logic sitting unused that could be a standalone SaaS..."
          }
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>

      {/* Generate button */}
      <button
        onClick={generate}
        disabled={loading || !context.trim()}
        className="w-full py-3 rounded-lg font-semibold text-sm transition-all bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "Generating..." : "Generate Posts"}
      </button>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-red-900/30 border border-red-700 text-red-300 text-sm">
          {error}
        </div>
      )}

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
                onClick={() => postToTwitter(result.posts, "thread")}
                disabled={posting === "thread"}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                  posted === "thread"
                    ? "bg-green-600/20 border border-green-600 text-green-400"
                    : "bg-gray-800 border border-gray-600 text-gray-300 hover:border-blue-500 hover:text-blue-300 disabled:opacity-50"
                }`}
              >
                <XIcon />
                {posting === "thread" ? "Posting..." : posted === "thread" ? "Posted!" : "Post Thread"}
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
                      onClick={() => postToTwitter([post], idx)}
                      disabled={posting === idx}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded transition-all ${
                        posted === idx
                          ? "bg-green-600/20 border border-green-600 text-green-400"
                          : "bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-50"
                      }`}
                    >
                      <XIcon />
                      {posting === idx ? "Posting..." : posted === idx ? "Posted!" : "Post"}
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
              <a href="/api/auth/twitter" className="text-blue-400 hover:underline">
                Connect X
              </a>{" "}
              to post directly from here
            </p>
          )}
        </div>
      )}
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
