import Link from "next/link";
import type { ActionItem, ActionPriority } from "@/domain/dashboard";
import { formatDate } from "@/domain/dates";

const PRIORITY_LABEL: Record<ActionPriority, string> = { critical: "Kritisch", high: "Hoch", medium: "Mittel" };
const PRIORITY_TONE: Record<ActionPriority, string> = {
  critical: "text-critical",
  high: "text-warning",
  medium: "text-text-muted",
};

export function ActionCenter({ items, total }: { items: ActionItem[]; total: number }) {
  return (
    <section aria-labelledby="actions-heading" className="flex flex-col gap-3">
      <h2 id="actions-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        Braucht Aufmerksamkeit
      </h2>
      {items.length === 0 ? (
        <p className="text-text-muted">Aktuell gibt es nichts, das Aufmerksamkeit braucht.</p>
      ) : (
        <div tabIndex={0} role="region" aria-labelledby="actions-heading" className="overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Offene Punkte nach Priorität</caption>
            <thead className="bg-surface-subtle text-text-muted">
              <tr>
                <th scope="col" className="whitespace-nowrap px-3 py-2">Priorität</th>
                <th scope="col" className="px-3 py-2">Thema</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2">Fällig</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2">Stand</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.key} className="border-t border-border">
                  <td className={`whitespace-nowrap px-3 py-2 font-medium ${PRIORITY_TONE[i.priority]}`}>
                    {PRIORITY_LABEL[i.priority]}
                  </td>
                  <td className="px-3 py-2">{i.topic}</td>
                  <td className="whitespace-nowrap px-3 py-2">{i.dueDate ? formatDate(i.dueDate) : "ohne Frist"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{i.statusLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > items.length && (
        <p className="text-text-muted">
          {items.length} von {total} Punkten.{" "}
          <Link href="/criteria" className="text-primary underline">Weitere Punkte: Kriterien und Fristen</Link>
        </p>
      )}
    </section>
  );
}
