"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const links = [
  { href: "/dashboard", label: "Overview", match: (p: string) => p === "/dashboard" },
  {
    href: "/dashboard/accounts",
    label: "Accounts",
    match: (p: string) => p.startsWith("/dashboard/accounts"),
  },
  {
    href: "/dashboard/automation",
    label: "Automation",
    match: (p: string) => p.startsWith("/dashboard/automation"),
  },
  { href: "/", label: "Studio", match: (p: string) => p === "/" },
];

export default function AnimatedNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 mb-8 p-1.5 rounded-2xl glass-panel !p-2">
      {links.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            className="relative px-4 py-2 text-sm font-medium rounded-xl z-10"
          >
            {active && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/25 via-violet-500/25 to-fuchsia-500/20 border border-cyan-400/30"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span
              className={`relative z-10 ${
                active ? "text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {l.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
