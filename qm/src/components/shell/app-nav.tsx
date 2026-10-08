"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, FileText, LayoutDashboard, ListChecks, type LucideIcon } from "lucide-react";

const ITEMS: ReadonlyArray<{ href: string; label: string; Icon: LucideIcon }> = [
  { href: "/", label: "Übersicht", Icon: LayoutDashboard },
  { href: "/criteria", label: "Kriterien", Icon: ClipboardCheck },
  { href: "/measures", label: "Massnahmen", Icon: ListChecks },
  { href: "/documents", label: "Dokumente", Icon: FileText },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Hauptnavigation" className="flex flex-col gap-1 p-3">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`type-label flex h-10 items-center gap-2 rounded px-3 ${
              active ? "bg-primary text-on-primary" : "text-text-muted hover:bg-surface-subtle hover:text-text"
            }`}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
