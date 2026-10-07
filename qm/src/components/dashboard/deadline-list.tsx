import type { DeadlineView } from "@/domain/deadlines";
import { formatDate } from "@/domain/dates";

function relative(d: DeadlineView): string {
  if (d.days < 0) return `seit ${-d.days} ${-d.days === 1 ? "Tag" : "Tagen"} überfällig`;
  if (d.days === 0) return "heute";
  if (d.days === 1) return "in 1 Tag";
  return `in ${d.days} Tagen`;
}

const TONE = { overdue: "text-critical", soon: "text-warning", upcoming: "text-text-muted" } as const;

export function DeadlineList({ deadlines }: { deadlines: DeadlineView[] }) {
  return (
    <section aria-labelledby="deadlines-heading" className="flex flex-col gap-3">
      <h2 id="deadlines-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">Fristen</h2>
      {deadlines.length === 0 ? (
        <p className="text-text-muted">Keine Fristen erfasst.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Fristen in zeitlicher Reihenfolge</caption>
            <thead className="bg-surface-subtle text-text-muted">
              <tr>
                <th scope="col" className="whitespace-nowrap px-3 py-2">Datum</th>
                <th scope="col" className="px-3 py-2">Frist</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2">Abstand</th>
              </tr>
            </thead>
            <tbody>
              {deadlines.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{formatDate(d.dueDate)}</td>
                  <td className="px-3 py-2">{d.label}</td>
                  <td className={`whitespace-nowrap px-3 py-2 font-medium ${TONE[d.urgency]}`}>{relative(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
