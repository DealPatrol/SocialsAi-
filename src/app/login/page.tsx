"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect } from "react";
import { motion } from "framer-motion";
import PremiumShell from "@/components/premium/PremiumShell";
import GlassPanel from "@/components/premium/GlassPanel";
import Logo from "@/components/premium/Logo";
import ShimmerButton from "@/components/premium/ShimmerButton";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";
  const xCode = params.get("x_code");
  const oauthError = params.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    oauthError ? `X sign-in failed: ${oauthError}` : null
  );
  const [loading, setLoading] = useState(false);
  const [xLoading, setXLoading] = useState(!!xCode);

  useEffect(() => {
    if (!xCode) return;

    async function completeXLogin() {
      const res = await signIn("credentials", {
        xCode,
        redirect: false,
      });
      setXLoading(false);
      if (res?.error) {
        setError("X sign-in session expired — try again");
        return;
      }
      router.push("/onboarding");
    }

    completeXLogin();
  }, [xCode, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password");
      return;
    }
    router.push(callbackUrl);
  }

  if (xLoading) {
    return (
      <p className="text-sm text-zinc-400 text-center animate-pulse">
        Completing X sign-in…
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          window.location.href = "/api/auth/x/login";
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-white/10 mb-4"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        Sign in with X
      </button>

      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-transparent px-2 text-zinc-500">or email</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="premium-label">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="premium-input"
          />
        </div>
        <div>
          <label className="premium-label">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="premium-input"
          />
        </div>
        {error && (
          <motion.p
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-sm text-red-400"
          >
            {error}
          </motion.p>
        )}
        <ShimmerButton type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in…" : "Enter the engine"}
        </ShimmerButton>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <PremiumShell>
      <div className="min-h-screen flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <Logo />
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-2xl font-bold text-center gradient-text mb-2"
          >
            Welcome back
          </motion.h1>
          <p className="text-sm text-zinc-400 text-center mb-8">
            Compliant AI growth for RepoFuse or your product — replies, follows,
            posts, and warm DMs.
          </p>
          <GlassPanel hover={false}>
            <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
              <LoginForm />
            </Suspense>
          </GlassPanel>
          <p className="text-center text-sm text-zinc-500 mt-6">
            No account?{" "}
            <Link
              href="/register"
              className="text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Create one
            </Link>
            {" · "}
            <button
              type="button"
              onClick={() => {
                window.location.href = "/api/auth/x/login";
              }}
              className="text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Sign up with X
            </button>
          </p>
        </div>
      </div>
    </PremiumShell>
  );
}
