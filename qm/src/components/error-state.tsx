import Link from "next/link";
import type { ReactNode } from "react";

export const ERROR_COPY = {
  title: "Das hat leider nicht geklappt",
  body: "Beim Laden dieser Seite ist ein Fehler aufgetreten. Bitte versuchen Sie es noch einmal. Besteht das Problem weiter, melden Sie es Ihrer QM-Verantwortlichen.",
  retry: "Erneut versuchen",
  home: "Zur Übersicht",
} as const;

export const NOT_FOUND_COPY = {
  title: "Seite nicht gefunden",
  body: "Diese Seite oder dieser Eintrag existiert nicht, oder Sie haben keinen Zugriff darauf.",
  home: ERROR_COPY.home,
} as const;

export const ACTION_BASE =
  "inline-flex h-10 items-center justify-center rounded-[var(--radius)] px-4 font-medium";
export const PRIMARY_ACTION = `${ACTION_BASE} bg-primary text-on-primary`;
export const SECONDARY_ACTION = `${ACTION_BASE} border border-border bg-surface`;

/** Ruhige, gemeinsame Fläche für Fehler- und 404-Seiten. Keine Technikdetails, kein Stacktrace. */
export function ErrorState({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-xl flex-col justify-center gap-6 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-text-muted">{body}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </main>
  );
}

export function HomeLink({ primary }: { primary: boolean }) {
  return (
    <Link href="/" className={primary ? PRIMARY_ACTION : SECONDARY_ACTION}>
      {ERROR_COPY.home}
    </Link>
  );
}
