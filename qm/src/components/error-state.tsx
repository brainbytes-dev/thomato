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
  "type-label inline-flex h-10 items-center justify-center rounded px-4";
export const PRIMARY_ACTION = `${ACTION_BASE} bg-primary text-on-primary`;
export const SECONDARY_ACTION = `${ACTION_BASE} border border-border bg-surface text-text hover:bg-surface-subtle`;

/** Ruhige, gemeinsame Fläche für Fehler- und 404-Seiten. Keine Technikdetails, kein Stacktrace. */
export function ErrorState({ title, body, children, alert = false }: { title: string; body: string; children: ReactNode; alert?: boolean }) {
  return (
    <main className="mx-auto my-8 flex w-full max-w-xl flex-col gap-6 rounded-xl border border-border bg-surface p-6 sm:p-8">
      <div className="flex flex-col gap-2" role={alert ? "alert" : undefined}>
        <h1 className="type-headline-section">{title}</h1>
        <p className="max-w-[70ch] text-text-muted">{body}</p>
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
