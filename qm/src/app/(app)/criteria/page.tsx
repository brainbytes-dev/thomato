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
import { EVIDENCE_BADGE, EVIDENCE_LABEL, scopeLabel, STATUS_BADGE, STATUS_LABEL } from "@/components/criteria/status-copy";
import { Badge, CARD } from "@/components/ui/badge";
import { CriteriaLegend } from "@/components/criteria/criteria-legend";
import { chapterDisplayName, criteriaGroupOf } from "@/domain/source-reference";
import { TABLE_WRAP, TD, TH } from "@/components/ui/styles";

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
    <nav aria-label={label} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <p className="type-eyebrow w-20 shrink-0 text-text-muted">{label}</p>
      <ul className="inline-flex flex-wrap gap-0.5 rounded-lg border border-border bg-surface-subtle p-0.5">
        {options.map((f) => {
          const isActive = f.value === active;
          return (
            <li key={f.value}>
              <Link
                href={f.href}
                aria-current={isActive ? "true" : undefined}
                className={`type-label inline-flex h-8 items-center gap-2 rounded-md border px-3 ${
                  isActive ? "border-border bg-surface text-text" : "border-transparent text-text-muted hover:text-text"
                }`}
              >
                {f.label}
                <span className="type-meta-mono">{f.count}</span>
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
    <div className="flex flex-col gap-6">
      <div className={`${CARD} flex flex-col gap-4 p-5 sm:p-6`}>
        <FilterGroup label="Stand" options={statusOptions} active={filter} />
        <FilterGroup label="Nachweis" options={evidenceOptions} active={evidenceFilter} />
        {scope === "mandatory" && (
          <p className="type-meta text-text-muted">
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
      <div className={`${CARD} flex flex-col gap-4 p-3 sm:p-4`}>
      <CriteriaLegend />
      <div className={TABLE_WRAP}>
        <table className="w-full min-w-[820px] border-collapse text-left">
          <caption className="sr-only">Kriterien mit Bewertungsstand und Nachweis</caption>
          <thead className="bg-surface-subtle">
            <tr>
              <th scope="col" className={TH}>Nr.</th>
              <th scope="col" className={TH}>Titel</th>
              <th scope="col" className={TH}>Kapitel</th>
              <th scope="col" className={TH}>Pflicht</th>
              <th scope="col" className={TH}>Stand</th>
              <th scope="col" className={TH}>Nachweis</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-text-muted">Keine Kriterien mit dieser Auswahl. Wählen Sie einen anderen Filter oder setzen Sie ihn auf «Alle».</td>
              </tr>
            ) : (
              rows.flatMap((r, i) => {
                const group = criteriaGroupOf(r.number);
                const heading = i === 0 || criteriaGroupOf(rows[i - 1].number).key !== group.key ? (
                  <tr key={`group-${group.key}`} className="bg-surface-subtle">
                    <th scope="colgroup" colSpan={6} className="type-label px-4 py-3 text-left">{group.heading}</th>
                  </tr>
                ) : null;
                return [heading, (
                <tr key={r.criterionId} className="align-top hover:bg-surface-subtle">
                  <td className={`${TD} type-meta-mono whitespace-nowrap`}>
                    <Link
                      href={`/criteria/${encodeURIComponent(r.number)}`}
                      className="text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {r.number}
                    </Link>
                  </td>
                  <td className={TD}>{r.title}</td>
                  <td className={TD}>{chapterDisplayName(r.chapter)}</td>
                  <td className={`${TD} whitespace-nowrap`}>{scopeLabel(r)}</td>
                  <td className={TD}>
                    <Badge tone={STATUS_BADGE[r.status]} dot>{STATUS_LABEL[r.status]}</Badge>
                    {r.status === "not_applicable" && r.notApplicableReason && (
                      <p className="type-meta mt-1 max-w-[48ch] text-text-muted">Begründung: {r.notApplicableReason}</p>
                    )}
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>
                    {(() => {
                      const state = evidenceOf(r, info);
                      return state === null ? (
                        <span className="text-text-muted">-</span>
                      ) : (
                        <Badge tone={EVIDENCE_BADGE[state]}>{EVIDENCE_LABEL[state]}</Badge>
                      );
                    })()}
                  </td>
                </tr>
                )];
              })
            )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}

export default function CriteriaPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="flex flex-col gap-6">
      <h1 className="type-headline-section">Kriterien</h1>
      <Suspense fallback={<p className="text-text-muted">Kriterien werden geladen...</p>}>
        <CriteriaTable searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
