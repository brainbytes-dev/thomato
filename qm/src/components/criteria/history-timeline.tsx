import { describeAuditEvent } from "@/domain/audit-copy";
import { formatDateTime } from "@/domain/dates";
import { Panel } from "./panel";

export type HistoryItem = {
  id: string;
  createdAt: Date;
  eventType: string;
  actorName: string | null;
  before: unknown;
  after: unknown;
};

type Kind = { label: string; dot: string };

/** Typfarbe und Wort: die Farbe verstärkt nur, das Wort trägt die Information. */
function kindOf(eventType: string): Kind {
  if (eventType.startsWith("measure.")) return { label: "Massnahme", dot: "bg-warning" };
  if (eventType.startsWith("document.") || eventType.startsWith("evidence.")) return { label: "Nachweis", dot: "bg-success" };
  if (eventType.startsWith("criterion.")) return { label: "Bewertung", dot: "bg-primary" };
  return { label: "Ereignis", dot: "bg-text-muted" };
}

export function HistoryTimeline({ entries }: { entries: HistoryItem[] }) {
  return (
    <Panel headingId="history-heading" title="Verlauf">
      {entries.length === 0 ? (
        <p className="text-text-muted">Noch keine Änderungen.</p>
      ) : (
        <ol aria-label="Änderungsverlauf dieses Kriteriums, neueste zuerst" className="flex flex-col">
          {entries.map((h) => {
            const kind = kindOf(h.eventType);
            return (
              <li
                key={h.id}
                className="relative pb-5 pl-6 last:pb-0 before:absolute before:bottom-0 before:left-[5px] before:top-3 before:w-px before:bg-border last:before:hidden"
              >
                <span aria-hidden="true" className={`absolute left-0 top-1.5 size-[11px] rounded-full ring-4 ring-surface ${kind.dot}`} />
                <p className="type-meta flex flex-wrap items-center gap-x-2 text-text-muted">
                  <time dateTime={h.createdAt.toISOString()} className="type-meta-mono">{formatDateTime(h.createdAt)}</time>
                  <span aria-hidden="true">·</span>
                  <span>{kind.label}</span>
                </p>
                <p className="type-body mt-0.5 break-words">{describeAuditEvent(h)}</p>
                <p className="type-meta mt-0.5 text-text-muted">{h.actorName ?? "unbekannt"}</p>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
