import { CARD } from "@/components/ui/badge";
import type { ChapterProgress } from "@/domain/dashboard";
import { chapterDisplayName } from "@/domain/source-reference";

/** ≥90 Prozent erfüllt, <70 Prozent Warnung, dazwischen Primärfarbe. */
export function chapterBarTone(percent: number | null): "success" | "warning" | "primary" {
  if (percent === null) return "primary";
  if (percent >= 90) return "success";
  if (percent < 70) return "warning";
  return "primary";
}

const BAR = { success: "bg-success", warning: "bg-warning", primary: "bg-primary" } as const;

export function chapterNote(c: ChapterProgress): string {
  if (c.applicable === 0) return "Keine anwendbaren Kriterien";
  const rest = c.applicable - c.met;
  if (rest === 0) return "Alle erfüllt";
  return rest === 1 ? "1 noch nicht erfüllt" : `${rest} noch nicht erfüllt`;
}

export function ChapterProgressTable({ chapters }: { chapters: ChapterProgress[] }) {
  return (
    <section aria-labelledby="progress-heading" className={`${CARD} p-5 sm:p-6`}>
      <h2 id="progress-heading" className="type-headline-sub">Fortschritt nach Kapitel</h2>
      <p className="type-meta mt-1 text-text-muted">Erfüllte Kriterien je Kapitel</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {chapters.map((c) => (
          <li key={c.chapter} className="rounded-lg border border-border bg-surface-subtle p-4">
            <p className="type-body-emphasis">{chapterDisplayName(c.chapter)}</p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="type-headline-section tabular-nums">{c.percent === null ? "k. A." : `${c.percent} %`}</span>
              <span className="type-meta text-text-muted">{c.met} / {c.applicable} Kriterien</span>
            </p>
            <div aria-hidden="true" className="mt-3 h-1 w-full rounded-full bg-background">
              <div className={`h-full rounded-full ${BAR[chapterBarTone(c.percent)]}`} style={{ width: `${c.percent ?? 0}%` }} />
            </div>
            <p className="type-meta mt-2 text-text-muted">{chapterNote(c)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
