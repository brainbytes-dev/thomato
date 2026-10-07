import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION, standardVersion } from "@/db/schema";
import { listAssessments, type AssessmentRow } from "./assessments";
import { daysUntil, monthsUntil, SOON_DAYS } from "./dates";
import { listDeadlines, type DeadlineView } from "./deadlines";
import { getEvidenceInfo } from "./documents";
import { summarizeEvidence, type EvidenceState } from "./evidence";
import { DEFAULT_PROCEDURE } from "./procedure";
import { assertCan, type OrgContext } from "./org-context";
import { computeReadiness, percentOf, scopeOf, type ProcedureMode, type ReadinessResult } from "./readiness";

export { DEFAULT_PROCEDURE } from "./procedure";
export const ACTION_CENTER_LIMIT = 10;

export type ActionPriority = "critical" | "high" | "medium";
export type ActionItem = {
  key: string;
  priority: ActionPriority;
  criterionNumber: string | null;
  topic: string;
  dueDate: string | null;
  dueInDays: number | null;
  statusLabel: string;
  href: string | null;
  source: "criterion" | "deadline" | "evidence";
};

export type StaleEvidence = { number: string; title: string; validUntil: string };
export type EvidenceInput = { stale: StaleEvidence[]; missingMet: number };
export type EvidenceCounts = { current: number; stale: number; missing: number };

const criterionHref = (number: string) => `/criteria/${encodeURIComponent(number)}`;

const RANK: Record<ActionPriority, number> = { critical: 0, high: 1, medium: 2 };
const NO_DATE = "9999-12-31";

function criterionPriority(c: AssessmentRow, mandatory: boolean): { priority: ActionPriority; label: string } | null {
  if (c.status === "met" || c.status === "not_applicable") return null;
  if (mandatory) {
    if (c.status === "critical") return { priority: "critical", label: "Kritisch" };
    if (c.status === "open") return { priority: "high", label: "Offen" };
    return { priority: "medium", label: "Nicht bewertet" };
  }
  if (c.status === "critical") return { priority: "high", label: "Kritisch" };
  if (c.status === "open") return { priority: "medium", label: "Offen" };
  return null;
}

function deadlineLabel(days: number): string {
  if (days < 0) return `Frist überschritten (seit ${-days} ${-days === 1 ? "Tag" : "Tagen"})`;
  if (days === 0) return "Frist heute";
  return `Frist in ${days} ${days === 1 ? "Tag" : "Tagen"}`;
}

export function buildActionItems(
  criteria: readonly AssessmentRow[],
  deadlines: readonly DeadlineView[],
  evidence: EvidenceInput,
  mode: ProcedureMode,
  now: Date,
): ActionItem[] {
  const items: ActionItem[] = [];
  for (const c of criteria) {
    const scope = scopeOf(c, mode);
    if (!scope.mandatory && !scope.should) continue;
    const p = criterionPriority(c, scope.mandatory);
    if (!p) continue;
    items.push({
      key: `criterion:${c.criterionId}`,
      priority: p.priority,
      criterionNumber: c.number,
      topic: `${c.number} ${c.title}`,
      dueDate: c.dueDate,
      dueInDays: c.dueDate ? daysUntil(c.dueDate, now) : null,
      statusLabel: p.label,
      href: criterionHref(c.number),
      source: "criterion",
    });
  }
  for (const d of deadlines) {
    if (d.days > SOON_DAYS) continue;
    items.push({
      key: `deadline:${d.id}`,
      priority: d.days < 0 ? "critical" : "high",
      criterionNumber: null,
      topic: d.label,
      dueDate: d.dueDate,
      dueInDays: d.days,
      statusLabel: deadlineLabel(d.days),
      href: null,
      source: "deadline",
    });
  }
  for (const e of evidence.stale) {
    items.push({
      key: `evidence:stale:${e.number}`,
      priority: "high",
      criterionNumber: e.number,
      topic: `${e.number} ${e.title}`,
      dueDate: e.validUntil,
      dueInDays: daysUntil(e.validUntil, now),
      statusLabel: "Nachweis veraltet",
      href: criterionHref(e.number),
      source: "evidence",
    });
  }
  if (evidence.missingMet > 0) {
    items.push({
      key: "evidence:missing",
      priority: "medium",
      criterionNumber: null,
      topic:
        evidence.missingMet === 1
          ? "1 erfülltes Pflichtkriterium ohne Nachweis"
          : `${evidence.missingMet} erfüllte Pflichtkriterien ohne Nachweis`,
      dueDate: null,
      dueInDays: null,
      statusLabel: "Nachweis fehlt",
      href: "/criteria?status=met&evidence=none",
      source: "evidence",
    });
  }
  // Array.prototype.sort ist stabil: gleiche Priorität und gleiches Datum behalten die Katalogreihenfolge.
  return items.sort(
    (a, b) => RANK[a.priority] - RANK[b.priority] || (a.dueDate ?? NO_DATE).localeCompare(b.dueDate ?? NO_DATE),
  );
}

/** Nachweis-Zähler und Action-Center-Eingaben über anwendbare Pflichtkriterien des Verfahrens (R26/R27). */
export function evidenceOverview(
  criteria: readonly AssessmentRow[],
  info: ReadonlyMap<string, { state: EvidenceState; latestValidUntil: string | null }>,
  mode: ProcedureMode,
): { counts: EvidenceCounts; input: EvidenceInput } {
  const states: EvidenceState[] = [];
  const stale: StaleEvidence[] = [];
  let missingMet = 0;
  for (const c of criteria) {
    if (!scopeOf(c, mode).mandatory || c.status === "not_applicable") continue;
    const entry = info.get(c.number);
    const state = entry?.state ?? "none";
    states.push(state);
    if (state === "stale" && entry?.latestValidUntil) {
      stale.push({ number: c.number, title: c.title, validUntil: entry.latestValidUntil });
    }
    if (state === "none" && c.status === "met") missingMet += 1;
  }
  return { counts: summarizeEvidence(states), input: { stale, missingMet } };
}

export type ChapterProgress = { chapter: string; met: number; applicable: number; percent: number | null };

export function chapterProgress(criteria: readonly AssessmentRow[], mode: ProcedureMode): ChapterProgress[] {
  const byChapter = new Map<string, { met: number; applicable: number }>();
  for (const c of criteria) {
    const scope = scopeOf(c, mode);
    if (!scope.mandatory && !scope.should) continue;
    if (c.status === "not_applicable") continue;
    const entry = byChapter.get(c.chapter) ?? { met: 0, applicable: 0 };
    entry.applicable += 1;
    if (c.status === "met") entry.met += 1;
    byChapter.set(c.chapter, entry);
  }
  return [...byChapter].map(([chapter, e]) => ({
    chapter,
    met: e.met,
    applicable: e.applicable,
    percent: percentOf(e.met, e.applicable),
  }));
}

export type ExpiryInfo = { kind: "months"; months: number } | { kind: "expired"; days: number };

/** Nächster künftiger Ablauftermin, sonst der jüngste abgelaufene, sonst null. */
export function expiryOf(deadlines: readonly DeadlineView[], now: Date): ExpiryInfo | null {
  const expiries = deadlines.filter((d) => d.kind === "expiry");
  const upcoming = expiries.filter((d) => d.days >= 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  if (upcoming) return { kind: "months", months: monthsUntil(upcoming.dueDate, now) };
  const past = expiries.filter((d) => d.days < 0).sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];
  return past ? { kind: "expired", days: -past.days } : null;
}

export type DashboardData = {
  readiness: ReadinessResult;
  actions: ActionItem[];
  deadlines: DeadlineView[];
  chapters: ChapterProgress[];
  evidence: EvidenceCounts;
  expiry: ExpiryInfo | null;
  /** Fristen mit days < 0. */
  overdueCount: number;
  /** Punkte im Action Center, die innerhalb von SOON_DAYS fällig oder bereits überfällig sind. */
  soonCount: number;
};

export async function getDashboard(
  ctx: OrgContext,
  now: Date,
  mode: ProcedureMode = DEFAULT_PROCEDURE,
): Promise<DashboardData> {
  assertCan(ctx, "assessment", "read");
  const [criteria, deadlines, evidenceInfo, versions] = await Promise.all([
    listAssessments(ctx),
    listDeadlines(ctx, now),
    getEvidenceInfo(ctx, now),
    db
      .select({ status: standardVersion.validationStatus })
      .from(standardVersion)
      .where(eq(standardVersion.id, ACTIVE_STANDARD_VERSION)),
  ]);
  const basisValidated = versions[0]?.status === "validated";
  const overview = evidenceOverview(criteria, evidenceInfo, mode);
  const actions = buildActionItems(criteria, deadlines, overview.input, mode, now);
  return {
    readiness: computeReadiness(criteria, mode, basisValidated),
    actions,
    deadlines,
    chapters: chapterProgress(criteria, mode),
    evidence: overview.counts,
    expiry: expiryOf(deadlines, now),
    overdueCount: deadlines.filter((d) => d.days < 0).length,
    soonCount: actions.filter((a) => a.dueInDays !== null && a.dueInDays <= SOON_DAYS).length,
  };
}
