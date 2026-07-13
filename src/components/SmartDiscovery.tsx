"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

interface Keyword {
  id: string;
  keyword: string;
  search_frequency: string;
  last_searched?: string;
}

interface Candidate {
  id: string;
  target_handle: string;
  target_name: string;
  target_bio: string;
  followers_count: number;
  engagement_score: number;
  keyword_matched: string;
  status: string;
  discovered_at: string;
}

export default function SmartDiscovery() {
  const { data: session } = useSession();
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"keywords" | "candidates">("keywords");

  const fetchKeywords = useCallback(async () => {
    if (!session?.user) return;
    try {
      const res = await fetch("/api/automation/keywords");
      const data = await res.json();
      setKeywords(data.keywords || []);
    } catch {
      setError("Failed to load keywords");
    }
  }, [session]);

  const fetchCandidates = useCallback(async () => {
    if (!session?.user) return;
    try {
      const res = await fetch("/api/automation/discover?minScore=70&limit=50");
      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch {
      setError("Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchKeywords();
    fetchCandidates();
  }, [fetchKeywords, fetchCandidates]);

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;

    try {
      setError(null);
      const res = await fetch("/api/automation/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: newKeyword }),
      });

      if (res.status === 409) {
        setError("Keyword already exists");
        return;
      }

      if (!res.ok) throw new Error("Failed to add keyword");

      const data = await res.json();
      setKeywords([data.keyword, ...keywords]);
      setNewKeyword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add keyword");
    }
  };

  const handleDeleteKeyword = async (id: string) => {
    try {
      const res = await fetch(`/api/automation/keywords?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete keyword");
      setKeywords(keywords.filter((k) => k.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete keyword");
    }
  };

  const handleSkipCandidate = async (id: string) => {
    try {
      const res = await fetch("/api/automation/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: id,
          status: "skipped",
          reason_skipped: "User skipped",
        }),
      });

      if (!res.ok) throw new Error("Failed to skip candidate");
      setCandidates(candidates.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to skip candidate");
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-4 border-b border-gray-700">
        <button
          onClick={() => setActiveTab("keywords")}
          className={`pb-3 px-2 font-medium text-sm transition-colors ${
            activeTab === "keywords"
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-gray-400 hover:text-gray-300"
          }`}
        >
          Niche Keywords
        </button>
        <button
          onClick={() => setActiveTab("candidates")}
          className={`pb-3 px-2 font-medium text-sm transition-colors ${
            activeTab === "candidates"
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-gray-400 hover:text-gray-300"
          }`}
        >
          Discovered Users ({candidates.length})
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-900/30 border border-red-700 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Keywords Tab */}
      {activeTab === "keywords" && (
        <div className="space-y-6">
          {/* Add New Keyword */}
          <form onSubmit={handleAddKeyword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Add Niche Keyword
              </label>
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="e.g., founder, saas, startup, indie-hacker"
                className="w-full px-4 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-gray-400 mt-2">
                The app will automatically search for users tweeting about these keywords and auto-engage with them.
              </p>
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Add Keyword
            </button>
          </form>

          {/* Keywords List */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-300">Active Keywords</h3>
            {keywords.length === 0 ? (
              <p className="text-gray-400 text-sm">
                No keywords yet. Add one to start discovering users in your niche.
              </p>
            ) : (
              <div className="space-y-2">
                {keywords.map((kw) => (
                  <div
                    key={kw.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-900 border border-gray-700"
                  >
                    <div>
                      <p className="text-white font-medium">"{kw.keyword}"</p>
                      <p className="text-xs text-gray-400">
                        {kw.last_searched
                          ? `Last searched: ${new Date(kw.last_searched).toLocaleDateString()}`
                          : "Not searched yet"}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteKeyword(kw.id)}
                      className="text-red-400 hover:text-red-300 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Candidates Tab */}
      {activeTab === "candidates" && (
        <div className="space-y-4">
          {loading ? (
            <p className="text-gray-400 text-center py-8">Loading candidates...</p>
          ) : candidates.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              No high-engagement candidates discovered yet. Add keywords to get started.
            </p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {candidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="p-4 rounded-lg bg-gray-900 border border-gray-700 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <a
                        href={`https://twitter.com/${candidate.target_handle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline font-medium"
                      >
                        @{candidate.target_handle}
                      </a>
                      <p className="text-sm text-gray-300">{candidate.target_name}</p>
                    </div>
                    <div className="text-right">
                      <div className="bg-blue-900/30 text-blue-300 px-2 py-1 rounded text-xs font-medium">
                        Score: {candidate.engagement_score}/100
                      </div>
                    </div>
                  </div>

                  {candidate.target_bio && (
                    <p className="text-xs text-gray-400 line-clamp-2">
                      {candidate.target_bio}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <div>
                      <span>👥 {candidate.followers_count.toLocaleString()} followers</span>
                      <span className="mx-2">•</span>
                      <span>Matched: {candidate.keyword_matched}</span>
                    </div>
                    <button
                      onClick={() => handleSkipCandidate(candidate.id)}
                      className="text-gray-400 hover:text-red-400 text-xs font-medium"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info Section */}
      <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-800 space-y-2">
        <p className="text-sm font-medium text-blue-300">How Smart Discovery Works</p>
        <ul className="text-xs text-gray-300 space-y-1">
          <li>• Add keywords related to your niche (e.g., "founder", "saas")</li>
          <li>• Discovery runs at 6 AM and 6 PM UTC - finds users tweeting your keywords</li>
          <li>• Scores users based on followers, verification, bio, and engagement</li>
          <li>• Auto-engages (follows, likes, DMs) with high-scoring users (70+)</li>
          <li>• Only targets users who will likely engage back with you</li>
        </ul>
      </div>
    </div>
  );
}
