import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/accounts", label: "Accounts" },
  { href: "/dashboard/automation", label: "Automation" },
  { href: "/", label: "Content Studio" },
];

export default function DashboardNav() {
  return (
    <nav className="flex flex-wrap gap-2 mb-8">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:border-blue-500 hover:text-blue-300 transition-colors"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
