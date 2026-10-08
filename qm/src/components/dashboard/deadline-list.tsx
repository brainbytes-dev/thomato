import { CARD } from "@/components/ui/badge";
import type { DeadlineView } from "@/domain/deadlines";
import { formatDate } from "@/domain/dates";

function relative(d: DeadlineView): string {
  if (d.days < 0) return `seit ${-d.days} ${-d.days === 1 ? "Tag" : "Tagen"} überfällig`;
  if (d.days === 0) return "heute";
  if (d.days === 1) return "in 1 Tag";
  return `in ${d.days} Tagen`;
}

const TONE = { overdue: "text-critical", soon: "text-warning", upcoming: "text-text-muted" } as const;
const TH = "type-eyebrow px-3 py-3 sm:px-4 text-left text-text-muted whitespace-nowrap";

export function DeadlineList({ deadlines }: { deadlines: DeadlineView[] }) {
  return (
    <section aria-labelledby="deadlines-heading" className={`${CARD} p-5 sm:p-6`}>
      <h2 id="deadlines-heading" className="type-headline-sub">Fristen</h2>
      {deadlines.length === 0 ? (
        <p className="mt-4 text-text-muted">Keine Fristen erfasst.</p>
      ) : (
        <div className="relative mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Fristen in zeitlicher Reihenfolge</caption>
            <thead className="bg-surface-subtle">
              <tr>
                <th scope="col" className={TH}>Datum</th>
                <th scope="col" className={TH}>Frist</th>
                <th scope="col" className={TH}>Fällig</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {deadlines.map((d) => (
                <tr key={d.id} className="hover:bg-surface-subtle">
                  <td className="type-meta-mono whitespace-nowrap px-3 py-3 sm:px-4">{formatDate(d.dueDate)}</td>
                  <td className="px-3 py-3 sm:px-4">{d.label}</td>
                  <td className={`type-label px-3 py-3 sm:whitespace-nowrap sm:px-4 ${TONE[d.urgency]}`}>{relative(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
