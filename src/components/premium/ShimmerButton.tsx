"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type ShimmerButtonProps = {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: () => void;
};

export default function ShimmerButton({
  children,
  className = "",
  variant = "primary",
  type = "button",
  disabled,
  onClick,
}: ShimmerButtonProps) {
  const variants = {
    primary:
      "bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 text-white shadow-[0_0_40px_-8px_rgba(34,211,238,0.6)]",
    ghost:
      "bg-white/5 border border-white/15 text-zinc-200 hover:border-cyan-400/40",
    danger:
      "bg-red-500/20 border border-red-500/30 text-red-200 hover:bg-red-500/30",
  };

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? undefined : { scale: 1.02, y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className={`
        relative overflow-hidden rounded-xl px-5 py-3 text-sm font-semibold
        disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none
        ${variants[variant]} ${className}
      `}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
      {variant === "primary" && !disabled && (
        <motion.span
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          initial={{ x: "-100%" }}
          animate={{ x: "200%" }}
          transition={{
            repeat: Infinity,
            duration: 2.5,
            ease: "linear",
            repeatDelay: 1,
          }}
        />
      )}
    </motion.button>
  );
}
