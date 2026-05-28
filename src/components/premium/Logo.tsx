"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3">
      <motion.div
        className="relative h-10 w-10"
        whileHover={{ rotateY: 180, scale: 1.08 }}
        transition={{ duration: 0.6, type: "spring" }}
        style={{ transformStyle: "preserve-3d" }}
      >
        <div
          className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500 opacity-90"
          style={{ boxShadow: "0 0 32px rgba(34, 211, 238, 0.45)" }}
        />
        <div className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold text-white">
          S
        </div>
        <motion.div
          className="absolute -inset-1 rounded-xl bg-gradient-to-br from-cyan-400/50 to-fuchsia-500/50 blur-md -z-10"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
      </motion.div>
      <div>
        <span className="font-display text-sm font-bold tracking-wide text-white group-hover:gradient-text transition-all">
          SocialsAI
        </span>
        <span className="block text-[10px] uppercase tracking-[0.2em] text-violet-300/60">
          Growth Engine
        </span>
      </div>
    </Link>
  );
}
