"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export default function PageHeader({
  title,
  subtitle,
  badge,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  badge?: string;
  actions?: ReactNode;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="mb-10"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {badge && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-block mb-3 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest border border-cyan-400/30 bg-cyan-500/10 text-cyan-300"
            >
              {badge}
            </motion.span>
          )}
          <h1 className="font-display text-3xl sm:text-4xl font-bold gradient-text leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-sm sm:text-base text-zinc-400 max-w-xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {actions}
      </div>
    </motion.header>
  );
}
