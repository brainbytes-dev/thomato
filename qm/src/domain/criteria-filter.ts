import { ASSESSMENT_STATUSES, type AssessmentStatus } from "@/db/schema";
import type { EvidenceState } from "./evidence";

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

/** Link zur Kriterienliste mit beiden Filtern; "all" lässt den Parameter weg. */
export function criteriaFilterHref(status: StatusFilter, evidence: EvidenceFilter): string {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (evidence !== "all") params.set("evidence", evidence);
  const query = params.toString();
  return query ? `/criteria?${query}` : "/criteria";
}
