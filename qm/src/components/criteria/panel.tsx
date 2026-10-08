import type { ReactNode } from "react";

/**
 * Karte der Kriteriendetailseite: Kopfzeile mit Titel (und optionaler Angabe rechts), darunter der Inhalt.
 * Die Überschrift ist über `headingId` per aria-labelledby mit dem Bereich verbunden; mit `focusable`
 * kann sie nach Aktionen programmatisch den Fokus erhalten.
 */
export function Panel({
  headingId,
  title,
  aside,
  focusable = false,
  children,
}: {
  headingId: string;
  title: string;
  aside?: ReactNode;
  focusable?: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={headingId} className="rounded-xl border border-border bg-surface">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-3 sm:px-5">
        <h2 id={headingId} tabIndex={focusable ? -1 : undefined} className="type-body-emphasis">
          {title}
        </h2>
        {aside}
      </div>
      <div className="flex flex-col gap-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}
