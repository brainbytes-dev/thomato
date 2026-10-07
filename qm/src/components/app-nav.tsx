"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Übersicht" },
  { href: "/criteria", label: "Kriterien" },
] as const;

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Hauptnavigation" className="flex flex-col gap-1">
      {ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : (pathname === item.href || pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-[var(--radius)] px-3 py-2 ${
              active ? "bg-primary-subtle font-medium text-primary" : "text-text-muted hover:text-text"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
