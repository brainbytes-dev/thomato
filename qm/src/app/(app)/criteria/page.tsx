import Link from "next/link";
import { Suspense } from "react";
import { listAssessments } from "@/domain/assessments";
import { requireOrgContextOrRedirect } from "@/domain/request-context";
import { ASSESSMENT_STATUSES } from "@/db/schema";
import {
  countByStatus,
  criteriaFilterHref,
  evidenceOf,
  filterCriteria,
  parseEvidenceFilter,
  parseScopeFilter,
  parseStatusFilter,
  type EvidenceFilter,
  type StatusFilter,
} from "@/domain/criteria-filter";
import { getEvidenceInfo } from "@/domain/documents";
import type { EvidenceState } from "@/domain/evidence";
import { EVIDENCE_LABEL, EVIDENCE_TONE, scopeLabel, STATUS_LABEL, STATUS_TONE } from "@/components/criteria/status-copy";

type SearchParams = Promise<{ status?: string | string[]; evidence?: string | string[]; scope?: string | string[] }>;

const EVIDENCE_VALUES: readonly EvidenceState[] = ["none", "stale", "current"];

type FilterOption<V extends string> = { value: V; label: string; count: number; href: string };

function FilterGroup<V extends string>({
  label,
  options,
  active,
}: {
  label: string;
  options: FilterOption<V>[];
  active: V;
}) {
  return (
    <nav aria-label={label} className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <ul className="flex flex-wrap gap-2">
        {options.map((f) => {
          const isActive = f.value === active;
          return (
            <li key={f.value}>
              <Link
                href={f.href}
                aria-current={isActive ? "true" : undefined}
                className={`inline-block rounded-[var(--radius)] border px-3 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  isActive ? "border-primary bg-surface-subtle font-semibold underline" : "border-border hover:bg-surface-subtle"
                }`}
              >
                {f.label} ({f.count})
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

async function CriteriaTable({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filter = parseStatusFilter(params.status);
  const evidenceFilter = parseEvidenceFilter(params.evidence);
  const ctx = await requireOrgContextOrRedirect();
  const [all, info] = await Promise.all([listAssessments(ctx), getEvidenceInfo(ctx, new Date())]);
  const scope = parseScopeFilter(params.scope);
  const statusBase = filterCriteria(all, { status: "all", evidence: evidenceFilter, scope }, info);
  const evidenceBase = filterCriteria(all, { status: filter, evidence: "all", scope }, info);
  const rows = filterCriteria(all, { status: filter, evidence: evidenceFilter, scope }, info);
  const statusCounts = countByStatus(statusBase);
  const statusOptions: FilterOption<StatusFilter>[] = [
    { value: "all" as StatusFilter, label: "Alle", count: statusBase.length },
    ...ASSESSMENT_STATUSES.map((s): { value: StatusFilter; label: string; count: number } => ({ value: s, label: STATUS_LABEL[s], count: statusCounts[s] })),
  ].map((o) => ({ ...o, href: criteriaFilterHref(o.value, evidenceFilter, scope) }));
  const evidenceOptions: FilterOption<EvidenceFilter>[] = [
    { value: "all" as EvidenceFilter, label: "Alle", count: evidenceBase.length },
    ...EVIDENCE_VALUES.map((v): { value: EvidenceFilter; label: string; count: number } => ({
      value: v,
      label: EVIDENCE_LABEL[v],
      count: evidenceBase.filter((r) => evidenceOf(r, info) === v).length,
    })),
  ].map((o) => ({ ...o, href: criteriaFilterHref(filter, o.value, scope) }));
  return (
    <>
      <div className="flex flex-col gap-3">
        <FilterGroup label="Stand" options={statusOptions} active={filter} />
        <FilterGroup label="Nachweis" options={evidenceOptions} active={evidenceFilter} />
        {scope === "mandatory" && (
          <p className="text-text-muted">
            Nur Pflichtkriterien im Verfahren.{" "}
            <Link
              href={criteriaFilterHref(filter, evidenceFilter)}
              className="text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Alle Kriterien anzeigen
            </Link>
          </p>
        )}
      </div>
      <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Kriterien mit Bewertungsstand und Nachweis</caption>
          <thead className="bg-surface-subtle text-text-muted">
            <tr>
              <th scope="col" className="whitespace-nowrap px-3 py-2">Nr.</th>
              <th scope="col" className="px-3 py-2">Titel</th>
              <th scope="col" className="px-3 py-2">Kapitel</th>
              <th scope="col" className="whitespace-nowrap px-3 py-2">Pflicht</th>
              <th scope="col" className="px-3 py-2">Stand</th>
              <th scope="col" className="whitespace-nowrap px-3 py-2">Nachweis</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t border-border">
                <td colSpan={6} className="px-3 py-4 text-text-muted">Keine Kriterien mit dieser Auswahl. Wählen Sie einen anderen Filter oder setzen Sie ihn auf «Alle».</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.criterionId} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-3 py-2 font-mono">
                    <Link
                      href={`/criteria/${encodeURIComponent(r.number)}`}
                      className="text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {r.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.title}</td>
                  <td className="px-3 py-2">{r.chapter}</td>
                  <td className="whitespace-nowrap px-3 py-2">{scopeLabel(r)}</td>
                  <td className="px-3 py-2">
                    <span className={`whitespace-nowrap font-medium ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    {r.status === "not_applicable" && r.notApplicableReason && (
                      <p className="mt-1 text-text-muted">Begründung: {r.notApplicableReason}</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {(() => {
                      const state = evidenceOf(r, info);
                      return state === null ? (
                        <span className="text-text-muted">-</span>
                      ) : (
                        <span className={`font-medium ${EVIDENCE_TONE[state]}`}>{EVIDENCE_LABEL[state]}</span>
                      );
                    })()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function CriteriaPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Kriterien</h1>
      <Suspense fallback={<p className="text-text-muted">Kriterien werden geladen...</p>}>
        <CriteriaTable searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
