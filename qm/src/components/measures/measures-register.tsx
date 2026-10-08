import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { MEASURE_STATUS_BADGE, MEASURE_STATUS_LABEL } from "@/components/criteria/status-copy";
import { Badge, CARD } from "@/components/ui/badge";
import { FIELD, PRIMARY_BTN, TABLE_WRAP, TD, TH } from "@/components/ui/styles";
import { MEASURE_STATUSES } from "@/db/schema";
import { formatDate, formatDaysDative } from "@/domain/dates";
import {
  countMeasuresByStatus,
  filterMeasures,
  measuresFilterHref,
  QUERY_MAX,
  type MeasureFilters,
  type MeasureStatusFilter,
} from "@/domain/measure-filter";
import type { OpenMeasureView } from "@/domain/measures";

export const REGISTER_ROW_LIMIT = 200;

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

type Member = { userId: string; name: string };

function Stats({ rows }: { rows: readonly OpenMeasureView[] }) {
  const c = countMeasuresByStatus(rows);
  const items: { status: MeasureStatusFilter; label: string; value: number; tone: string }[] = [
    { status: "open", label: "Offen", value: c.open, tone: "" },
    { status: "in_progress", label: "In Bearbeitung", value: c.in_progress, tone: "" },
    { status: "overdue", label: "Überfällig", value: c.overdue, tone: c.overdue > 0 ? "text-critical" : "" },
    { status: "done", label: "Erledigt", value: c.done, tone: "" },
  ];
  return (
    <section aria-label="Kennzahlen" className={`${CARD} p-5 sm:p-6`}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
        {items.map((i) => (
          <div key={i.status}>
            <dt className="type-meta text-text-muted">{i.label}</dt>
            <dd className="mt-1">
              <Link
                href={measuresFilterHref({ status: i.status })}
                className={`type-headline-section tabular-nums hover:underline ${FOCUS} ${i.tone}`}
                aria-label={`${i.label}: ${i.value}, Liste filtern`}
              >
                {i.value}
              </Link>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function StatusSegments({ rows, filters }: { rows: readonly OpenMeasureView[]; filters: MeasureFilters }) {
  // Zähler folgen Suche und Verantwortlichen, damit die Zahlen zur Liste passen.
  const base = filterMeasures(rows, { ...filters, status: "all" });
  const c = countMeasuresByStatus(base);
  const options: { value: MeasureStatusFilter; label: string; count: number }[] = [
    { value: "all", label: "Alle", count: c.all },
    { value: "overdue", label: "Überfällig", count: c.overdue },
    ...MEASURE_STATUSES.map((s) => ({ value: s as MeasureStatusFilter, label: MEASURE_STATUS_LABEL[s], count: c[s] })),
  ];
  return (
    <nav aria-label="Status">
      <ul className="inline-flex flex-wrap gap-0.5 rounded-lg border border-border bg-surface-subtle p-0.5">
        {options.map((o) => {
          const active = o.value === filters.status;
          return (
            <li key={o.value}>
              <Link
                href={measuresFilterHref({ ...filters, status: o.value })}
                aria-current={active ? "true" : undefined}
                className={`type-label inline-flex h-8 items-center gap-2 rounded-md border px-3 ${FOCUS} ${
                  active ? "border-border bg-surface text-text" : "border-transparent text-text-muted hover:text-text"
                }`}
              >
                {o.label}
                <span className="type-meta-mono">{o.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SearchForm({ filters, members }: { filters: MeasureFilters; members: readonly Member[] }) {
  const active = filters.query !== "" || filters.owner !== "all";
  return (
    <form action="/measures" method="get" role="search" aria-label="Massnahmen durchsuchen" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      {filters.status !== "all" && <input type="hidden" name="status" value={filters.status} />}
      <label className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-64">
        <span className="type-meta text-text-muted">Suche</span>
        <input
          type="search"
          name="q"
          defaultValue={filters.query}
          maxLength={QUERY_MAX}
          placeholder="Massnahme, Kriterium oder Person"
          autoComplete="off"
          className={`${FIELD} w-full ${FOCUS}`}
        />
      </label>
      <label className="flex flex-col gap-1 sm:w-56">
        <span className="type-meta text-text-muted">Verantwortliche</span>
        <select name="owner" defaultValue={filters.owner} className={`${FIELD} w-full ${FOCUS}`}>
          <option value="all">Alle</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>{m.name}</option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={`${PRIMARY_BTN} inline-flex items-center gap-2 ${FOCUS}`}>
          <Search aria-hidden="true" className="size-4 shrink-0" />
          Suchen
        </button>
        {active && (
          <Link href={measuresFilterHref({ status: filters.status })} className={`type-label text-primary underline ${FOCUS}`}>
            Zurücksetzen
          </Link>
        )}
      </div>
    </form>
  );
}

function DueCell({ m, inline = false }: { m: OpenMeasureView; inline?: boolean }) {
  return (
    <>
      <span className={`type-meta-mono whitespace-nowrap ${m.overdue ? "font-semibold text-critical" : ""}`}>{formatDate(m.dueDate)}</span>
      {m.overdue &&
        (inline ? (
          <span className="type-meta text-critical">, seit {formatDaysDative(-m.days)} überfällig</span>
        ) : (
          <p className="type-meta mt-1 text-critical">seit {formatDaysDative(-m.days)} überfällig</p>
        ))}
    </>
  );
}

function StatusBadge({ m }: { m: OpenMeasureView }) {
  return (
    <Badge tone={m.overdue ? "critical" : MEASURE_STATUS_BADGE[m.status]} dot>
      {m.overdue ? `${MEASURE_STATUS_LABEL[m.status]}, überfällig` : MEASURE_STATUS_LABEL[m.status]}
    </Badge>
  );
}

function OpenLink({ m, href }: { m: OpenMeasureView; href: string }) {
  return (
    <Link href={`${href}#measures-heading`} className={`type-label inline-flex items-center gap-2 text-primary hover:underline ${FOCUS}`}>
      Öffnen
      <span className="sr-only">: {m.title}</span>
      <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
    </Link>
  );
}

function EmptyOrg() {
  return (
    <div className={`${CARD} flex flex-col items-start gap-3 p-6`}>
      <h2 className="type-headline-sub">Noch keine Massnahmen</h2>
      <p className="max-w-[60ch] text-text-muted">Massnahmen legen Sie auf der Seite eines Kriteriums an. Hier erscheinen sie dann gesammelt.</p>
      <Link href="/criteria" className={`type-label inline-flex items-center gap-2 text-primary underline ${FOCUS}`}>
        Zu den Kriterien
        <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
      </Link>
    </div>
  );
}

export function MeasuresRegister({
  rows,
  members,
  filters,
}: {
  rows: readonly OpenMeasureView[];
  members: readonly Member[];
  filters: MeasureFilters;
}) {
  if (rows.length === 0) return <EmptyOrg />;
  const matches = filterMeasures(rows, filters);
  const shown = matches.slice(0, REGISTER_ROW_LIMIT);
  return (
    <div className="flex flex-col gap-6">
      <Stats rows={rows} />
      <div className={`${CARD} flex flex-col gap-5 p-5 sm:p-6`}>
        <StatusSegments rows={rows} filters={filters} />
        <SearchForm filters={filters} members={members} />
      </div>
      <div className={`${CARD} p-3 sm:p-4`}>
        {filters.status === "active" && (
          <div className="mb-3 flex px-1">
            <p className="type-label inline-flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-subtle py-1 pl-3 pr-1">
              Offen und in Bearbeitung
              <Link
                href={measuresFilterHref({ ...filters, status: "all" })}
                aria-label="Filter «Offen und in Bearbeitung» aufheben"
                className={`type-meta inline-flex h-6 items-center gap-2 rounded px-2 text-primary underline ${FOCUS}`}
              >
                <X aria-hidden="true" className="size-3.5 shrink-0" />
                Filter aufheben
              </Link>
            </p>
          </div>
        )}
        <div className={TABLE_WRAP}>
          <table className="w-full border-collapse md:min-w-[860px] text-left">
            <caption className="sr-only">Massnahmen der Organisation mit Verantwortlichen, Frist und Status</caption>
            <thead className="bg-surface-subtle">
              <tr>
                <th scope="col" className={TH}>Massnahme</th>
                <th scope="col" className={`${TH} hidden md:table-cell`}>Verantwortliche</th>
                <th scope="col" className={`${TH} hidden md:table-cell`}>Frist</th>
                <th scope="col" className={`${TH} hidden md:table-cell`}>Status</th>
                <th scope="col" className={`${TH} hidden md:table-cell`}><span className="sr-only">Aktion</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6">
                    <p className="text-text-muted">Keine Massnahmen mit dieser Auswahl.</p>
                    <Link href="/measures" className={`type-label mt-2 inline-block text-primary underline ${FOCUS}`}>
                      Filter zurücksetzen
                    </Link>
                  </td>
                </tr>
              ) : (
                shown.map((m) => {
                  const href = `/criteria/${encodeURIComponent(m.criterionNumber)}`;
                  const owner = m.ownerName ?? <span className="text-text-muted">unbekannt</span>;
                  return (
                    <tr key={m.id} className="hover:bg-surface-subtle">
                      <td className={`${TD} max-w-[44ch]`}>
                        <p className="type-body-emphasis break-words">{m.title}</p>
                        <p className="type-meta mt-1 break-words text-text-muted">
                          <Link href={href} className={`hover:underline ${FOCUS}`}>
                            <span className="type-meta-mono">{m.criterionNumber}</span> {m.criterionTitle}
                          </Link>
                        </p>
                        <dl className="type-meta mt-3 flex flex-col gap-2 md:hidden">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <dt className="text-text-muted">Verantwortliche</dt>
                            <dd>{owner}</dd>
                          </div>
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <dt className="text-text-muted">Frist</dt>
                            <dd><DueCell m={m} inline /></dd>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <dt className="sr-only">Status</dt>
                            <dd><StatusBadge m={m} /></dd>
                            <dd><OpenLink m={m} href={href} /></dd>
                          </div>
                        </dl>
                      </td>
                      <td className={`${TD} hidden md:table-cell`}>{owner}</td>
                      <td className={`${TD} hidden md:table-cell`}><DueCell m={m} /></td>
                      <td className={`${TD} hidden whitespace-nowrap md:table-cell`}><StatusBadge m={m} /></td>
                      <td className={`${TD} hidden whitespace-nowrap md:table-cell`}><OpenLink m={m} href={href} /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="type-meta mt-3 px-1 text-text-muted">
          {shown.length} von {rows.length} Massnahmen
          {matches.length > REGISTER_ROW_LIMIT &&
            `. Angezeigt werden die ersten ${REGISTER_ROW_LIMIT} von ${matches.length} Treffern, schränken Sie die Auswahl ein.`}
        </p>
      </div>
    </div>
  );
}
