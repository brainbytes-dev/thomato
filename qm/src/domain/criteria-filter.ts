import { ASSESSMENT_STATUSES, type AssessmentStatus } from "@/db/schema";

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
