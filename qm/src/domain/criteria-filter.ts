import { ASSESSMENT_STATUSES, type AssessmentStatus } from "@/db/schema";
import type { AssessmentRow } from "./assessments";
import type { EvidenceState } from "./evidence";
import { DEFAULT_PROCEDURE } from "./procedure";
import { scopeOf } from "./readiness";

export type StatusFilter = AssessmentStatus | "all";

export function parseStatusFilter(value: string | string[] | undefined): StatusFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return (ASSESSMENT_STATUSES as readonly string[]).includes(v ?? "") ? (v as AssessmentStatus) : "all";
}

export function countByStatus(rows: readonly { status: AssessmentStatus }[]): Record<AssessmentStatus, number> {
  const counts = Object.fromEntries(ASSESSMENT_STATUSES.map((s) => [s, 0])) as Record<AssessmentStatus, number>;
  for (const r of rows) counts[r.status] += 1;
  return counts;
}

export type EvidenceFilter = EvidenceState | "all";

const EVIDENCE_FILTERS: readonly EvidenceState[] = ["none", "stale", "current"];

export function parseEvidenceFilter(value: string | string[] | undefined): EvidenceFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return (EVIDENCE_FILTERS as readonly string[]).includes(v ?? "") ? (v as EvidenceState) : "all";
}

export type ScopeFilter = "all" | "mandatory";

export function parseScopeFilter(value: string | string[] | undefined): ScopeFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "mandatory" ? "mandatory" : "all";
}

/** Link zur Kriterienliste mit allen Filtern; "all" lässt den Parameter weg. */
export function criteriaFilterHref(status: StatusFilter, evidence: EvidenceFilter, scope: ScopeFilter = "all"): string {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (evidence !== "all") params.set("evidence", evidence);
  if (scope !== "all") params.set("scope", scope);
  const query = params.toString();
  return query ? `/criteria?${query}` : "/criteria";
}

/** Nachweiszustand einer Zeile; nicht anwendbare Kriterien haben keinen (null). */
export function evidenceOf(
  row: Pick<AssessmentRow, "number" | "status">,
  states: ReadonlyMap<string, { state: EvidenceState }>,
): EvidenceState | null {
  return row.status === "not_applicable" ? null : (states.get(row.number)?.state ?? "none");
}

export type CriteriaFilters = { status: StatusFilter; evidence: EvidenceFilter; scope: ScopeFilter };

/** Eine Quelle für Liste und Zähler: "all" je Filter heisst ungefiltert. */
export function filterCriteria(
  rows: readonly AssessmentRow[],
  filters: CriteriaFilters,
  states: ReadonlyMap<string, { state: EvidenceState }>,
): AssessmentRow[] {
  return rows.filter(
    (r) =>
      (filters.scope === "all" || (scopeOf(r, DEFAULT_PROCEDURE).mandatory && r.status !== "not_applicable")) &&
      (filters.status === "all" || r.status === filters.status) &&
      (filters.evidence === "all" || evidenceOf(r, states) === filters.evidence),
  );
}
