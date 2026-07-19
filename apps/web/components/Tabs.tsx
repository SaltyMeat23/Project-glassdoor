"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "vs. the market" },
  { href: "/compare", label: "Compare two offers" },
];

export function Tabs() {
  const path = usePathname();
  return (
    <nav className="mx-auto max-w-5xl px-5 pt-6">
      <div className="inline-flex rounded-lg border border-line bg-panel p-1 text-sm">
        {TABS.map((t) => {
          const active = path === t.href;
          return (
            <Link key={t.href} href={t.href}
              className={`px-3.5 py-1.5 rounded-md transition-colors ${active ? "bg-accent text-accent-ink font-medium" : "text-muted hover:text-text"}`}>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
