"use client";

import PremiumShell from "./PremiumShell";
import AnimatedNav from "./AnimatedNav";
import Logo from "./Logo";
import SignOutButton from "@/components/SignOutButton";
import { motion } from "framer-motion";

export default function DashboardChrome({
  children,
  email,
}: {
  children: React.ReactNode;
  email: string;
}) {
  return (
    <PremiumShell>
      <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8 gap-4"
        >
          <Logo href="/dashboard" />
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-violet-300/50">
              Operator
            </p>
            <p className="text-sm text-zinc-400 truncate max-w-[180px]">{email}</p>
          </div>
        </motion.div>

        <AnimatedNav />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {children}
        </motion.div>

        <div className="mt-10 flex justify-center">
          <SignOutButton />
        </div>
      </div>
    </PremiumShell>
  );
}
