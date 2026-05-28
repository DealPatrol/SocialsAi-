"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useReducedMotion } from "framer-motion";

const Scene3D = dynamic(() => import("./Scene3D"), { ssr: false });

export default function PremiumShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <div className={`relative min-h-screen text-zinc-100 ${className}`}>
      <div className="premium-aurora" aria-hidden />
      <div className="premium-grid" aria-hidden />
      {!reduced && <Scene3D />}
      <div className="premium-noise" aria-hidden />
      {!reduced && <div className="scan-overlay" aria-hidden />}

      <motion.div
        className="relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}
