"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { applyTheme, readTheme, writeTheme, type ThemeChoice } from "@/lib/theme";

const OPTIONS: ReadonlyArray<{ value: ThemeChoice; label: string; Icon: LucideIcon }> = [
  { value: "light", label: "Hell", Icon: Sun },
  { value: "dark", label: "Dunkel", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

const safeStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const getSnapshot = (): ThemeChoice => readTheme(safeStorage());
const getServerSnapshot = (): ThemeChoice => "system";

/** Hell / Dunkel / System. Die Wahl liegt in localStorage; das Inline-Skript im Root-Layout setzt sie vor dem ersten Paint. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const choice = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // React setzt <html> im Dev-Strict-Mode beim Remount zurück; hier wird das Attribut wieder gesetzt (in Produktion ohne Wirkung).
  useLayoutEffect(() => {
    applyTheme(document.documentElement, readTheme(safeStorage()));
  }, []);

  function select(next: ThemeChoice) {
    writeTheme(safeStorage(), next);
    applyTheme(document.documentElement, next);
    listeners.forEach((l) => l());
  }

  return (
    <div
      role="group"
      aria-label="Darstellung"
      className={`inline-flex gap-0.5 rounded-lg border border-border bg-surface-subtle p-0.5 ${className}`}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const pressed = choice === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={pressed}
            aria-label={label}
            title={label}
            onClick={() => select(value)}
            className={`inline-flex size-8 items-center justify-center rounded-md border ${
              pressed
                ? "border-border bg-surface text-text"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            <Icon aria-hidden="true" className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
