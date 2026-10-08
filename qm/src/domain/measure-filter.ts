import { MEASURE_PHASES, MEASURE_STATUSES, type MeasurePhase, type MeasureStatus } from "@/db/schema";

export type MeasureStatusFilter = MeasureStatus | "overdue" | "active" | "all";
export type MeasurePhaseFilter = MeasurePhase | "all";
export type OwnerFilter = string;

export const QUERY_MAX = 80;

type RawParam = string | string[] | undefined;

type FilterRow = {
  title: string;
  criterionNumber: string;
  criterionTitle: string;
  ownerUserId: string;
  ownerName: string | null;
  status: MeasureStatus;
  phase: MeasurePhase;
  overdue: boolean;
};

export type MeasureFilters = { status: MeasureStatusFilter; phase: MeasurePhaseFilter; owner: OwnerFilter; query: string };

const first = (value: RawParam): string | undefined => (Array.isArray(value) ? value[0] : value);

export function parseMeasureStatusFilter(value: RawParam): MeasureStatusFilter {
  const v = first(value) ?? "";
  if (v === "overdue" || v === "active") return v;
  return (MEASURE_STATUSES as readonly string[]).includes(v) ? (v as MeasureStatus) : "all";
}

export function parsePhaseFilter(value: RawParam): MeasurePhaseFilter {
  const v = first(value) ?? "";
  return (MEASURE_PHASES as readonly string[]).includes(v) ? (v as MeasurePhase) : "all";
}

/** Nur Mitglieder der eigenen Organisation sind gültig; alles andere heisst «all». */
export function parseOwnerFilter(value: RawParam, members: readonly { userId: string }[]): OwnerFilter {
  const v = first(value);
  return v !== undefined && v !== "all" && members.some((m) => m.userId === v) ? v : "all";
}

/** Getrimmt und auf QUERY_MAX Zeichen (Codepoints) begrenzt, danach erneut getrimmt. */
export function parseQuery(value: RawParam): string {
  return [...(first(value) ?? "").trim()].slice(0, QUERY_MAX).join("").trim();
}

/** Nur für den Vergleich: klein, NFKD, Combining Marks entfernt («BÜRO» findet «büro» und «buro»). */
function fold(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

export function matchesQuery(row: FilterRow, query: string): boolean {
  const needle = fold(query);
  if (needle === "") return true;
  return [row.title, row.criterionNumber, row.criterionTitle, row.ownerName ?? ""].some((f) => fold(f).includes(needle));
}

export function matchesStatus(row: Pick<FilterRow, "status" | "overdue">, status: MeasureStatusFilter): boolean {
  if (status === "all") return true;
  if (status === "overdue") return row.overdue;
  // «active» = offen und in Bearbeitung, dieselbe Menge wie die Dashboard-Zahl «Offen».
  if (status === "active") return row.status !== "done";
  return row.status === status;
}

export function matchesPhase(row: Pick<FilterRow, "phase">, phase: MeasurePhaseFilter): boolean {
  return phase === "all" || row.phase === phase;
}

export function filterMeasures<T extends FilterRow>(rows: readonly T[], filters: MeasureFilters): T[] {
  return rows.filter(
    (r) =>
      matchesStatus(r, filters.status) &&
      matchesPhase(r, filters.phase) &&
      (filters.owner === "all" || r.ownerUserId === filters.owner) &&
      matchesQuery(r, filters.query),
  );
}

export type MeasureCounts = Record<MeasureStatus, number> & { overdue: number; all: number };

export function countMeasuresByStatus(rows: readonly Pick<FilterRow, "status" | "overdue">[]): MeasureCounts {
  const counts: MeasureCounts = { open: 0, in_progress: 0, done: 0, overdue: 0, all: rows.length };
  for (const r of rows) {
    counts[r.status] += 1;
    if (r.overdue) counts.overdue += 1;
  }
  return counts;
}

export type PhaseCounts = Record<MeasurePhase, number> & { actDone: number; all: number };

/** Abgeschlossene Massnahmen liegen per DB-Regel in Act und zählen dort mit; `actDone` weist sie zusätzlich aus. */
export function countMeasuresByPhase(rows: readonly Pick<FilterRow, "phase" | "status">[]): PhaseCounts {
  const counts: PhaseCounts = { plan: 0, do: 0, check: 0, act: 0, actDone: 0, all: rows.length };
  for (const r of rows) {
    counts[r.phase] += 1;
    if (r.status === "done") counts.actDone += 1;
  }
  return counts;
}

/** Link zum Register; Parameter mit dem Wert «all» oder ohne Inhalt entfallen. */
export function measuresFilterHref(filters: Partial<MeasureFilters>): string {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.phase && filters.phase !== "all") params.set("phase", filters.phase);
  if (filters.owner && filters.owner !== "all") params.set("owner", filters.owner);
  if (filters.query) params.set("q", filters.query);
  const query = params.toString();
  return query ? `/measures?${query}` : "/measures";
}
