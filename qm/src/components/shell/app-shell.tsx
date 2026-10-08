"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Plus, X } from "lucide-react";
import { BRAND } from "@/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppNav } from "./app-nav";
import { breadcrumbsFor, initialsOf } from "./breadcrumbs";
import { SignOutButton } from "./sign-out-button";

type ShellProps = { organizationName: string; roleLabel: string; userName: string; children: ReactNode };

export function AppShell({ organizationName, roleLabel, userName, children }: ShellProps) {
  const pathname = usePathname();
  // Das Menü gilt nur für den Pfad, auf dem es geöffnet wurde; ein Seitenwechsel schliesst es ohne Effekt.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const menuOpen = openFor === pathname;
  const crumbs = breadcrumbsFor(pathname, organizationName);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenFor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="type-label fixed left-4 top-2 z-50 -translate-y-16 rounded bg-primary px-3 py-2 text-on-primary focus:translate-y-0"
      >
        Zum Inhalt springen
      </a>

      {menuOpen && (
        <button
          type="button"
          aria-label="Menü schliessen"
          tabIndex={-1}
          onClick={() => setOpenFor(null)}
          className="fixed inset-0 z-30 bg-background/80 lg:hidden"
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col justify-between border-r border-border bg-sidebar transition-transform duration-200 ease-out lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "max-lg:invisible max-lg:-translate-x-full"
        }`}
      >
        <div className="min-h-0 overflow-y-auto">
          <div className="border-b border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-primary text-on-primary">
                <Plus className="size-3.5" strokeWidth={3} />
              </span>
              <span className="type-label flex-1 font-semibold uppercase leading-tight tracking-wider">{BRAND.name}</span>
              <button
                type="button"
                aria-label="Menü schliessen"
                onClick={() => setOpenFor(null)}
                className="inline-flex size-9 items-center justify-center rounded text-text-muted hover:bg-surface-subtle hover:text-text lg:hidden"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
            <p className="mt-1 text-[10px] font-semibold uppercase leading-4 tracking-widest text-text-muted">
              Qualitätsmanagement
            </p>
            <div className="mt-4 rounded border border-border bg-surface-subtle p-2">
              <p className="type-label truncate" title={organizationName}>{organizationName}</p>
              <p className="type-meta mt-0.5 flex items-center gap-2 text-text-muted">
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-success" />
                {roleLabel}
              </p>
            </div>
          </div>
          <AppNav />
        </div>
        <div className="flex items-center gap-2 border-t border-border bg-surface p-4">
          <span
            aria-hidden="true"
            className="type-meta-mono flex size-9 shrink-0 items-center justify-center rounded border border-border bg-surface-subtle"
          >
            {initialsOf(userName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="type-label truncate" title={userName}>{userName}</p>
            <p className="type-meta truncate text-text-muted">{roleLabel}</p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface px-4 sm:px-8 lg:left-64">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-label="Menü öffnen"
            aria-expanded={menuOpen}
            aria-controls="app-sidebar"
            onClick={() => setOpenFor(pathname)}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded border border-border text-text-muted hover:bg-surface-subtle hover:text-text lg:hidden"
          >
            <Menu aria-hidden="true" className="size-4" />
          </button>
          <nav aria-label="Navigationspfad" className="min-w-0">
            <ol className="type-label flex min-w-0 items-center gap-2">
              {crumbs.map((c, i) => {
                const last = i === crumbs.length - 1;
                return (
                  <li key={`${i}-${c.label}`} className={`flex min-w-0 items-center gap-2 ${i === 0 && !last ? "max-sm:hidden" : ""}`}>
                    {i > 0 && <span aria-hidden="true" className="text-text-muted">/</span>}
                    {c.href && !last ? (
                      <Link href={c.href} className="truncate text-text-muted hover:text-text">{c.label}</Link>
                    ) : (
                      <span
                        aria-current={last ? "page" : undefined}
                        className={`truncate ${last ? "font-semibold" : "text-text-muted"}`}
                      >
                        {c.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>
        <ThemeToggle className="shrink-0" />
      </header>

      <div id="main-content" tabIndex={-1} className="pt-14 outline-none lg:pl-64">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-6 p-4 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
