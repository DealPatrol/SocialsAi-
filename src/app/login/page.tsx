"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { motion } from "framer-motion";
import PremiumShell from "@/components/premium/PremiumShell";
import GlassPanel from "@/components/premium/GlassPanel";
import Logo from "@/components/premium/Logo";
import ShimmerButton from "@/components/premium/ShimmerButton";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
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
            Compliant AI engagement for RepoFuse or your product.
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
          </p>
        </div>
      </div>
    </PremiumShell>
  );
}
