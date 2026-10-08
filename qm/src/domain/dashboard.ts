import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION, standardVersion } from "@/db/schema";
import { listAssessments, type AssessmentRow } from "./assessments";
import { daysUntil, formatDaysDative, monthsUntil, SOON_DAYS } from "./dates";
import { listDeadlines, type DeadlineView } from "./deadlines";
import { getEvidenceInfo } from "./documents";
import { listOpenMeasures, type OpenMeasureView } from "./measures";
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
  /** Kurztitel für die Tabellenzeile; `topic` bleibt der vollständige Text. */
  title: string;
  /** Sekundärzeile (Kriteriumsnummer, Kapitel oder Massnahmenbezug), null wenn es keinen Bezug gibt. */
  reference: string | null;
  /** Verantwortliche Person einer Massnahme, sonst null. */
  ownerName: string | null;
  dueDate: string | null;
  dueInDays: number | null;
  statusLabel: string;
  href: string | null;
  source: "criterion" | "deadline" | "evidence" | "measure";
};

export const BUNDLED_EVIDENCE_KEY = "evidence:missing";

/** Erste `limit` Einträge; der gebündelte Hinweis «ohne Nachweis» ersetzt bei Bedarf den letzten Platz, statt abgeschnitten zu werden. */
export function selectActionItems(actions: ActionItem[], limit: number): ActionItem[] {
  const n = Math.max(0, Math.floor(limit));
  if (n === 0) return [];
  const head = actions.slice(0, n);
  const bundled = actions.find((a) => a.key === BUNDLED_EVIDENCE_KEY);
  if (!bundled || head.includes(bundled)) return head;
  return [...head.slice(0, n - 1), bundled];
}

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
  if (days < 0) return `Frist überfällig (seit ${-days} ${-days === 1 ? "Tag" : "Tagen"})`;
  if (days === 0) return "Frist fällig heute";
  return `Frist fällig in ${days} ${days === 1 ? "Tag" : "Tagen"}`;
}

function measureLabel(days: number): string {
  if (days < 0) return `Massnahme überfällig (seit ${formatDaysDative(-days)})`;
  if (days === 0) return "Massnahme fällig heute";
  return `Massnahme fällig in ${formatDaysDative(days)}`;
}

export function buildActionItems(
  criteria: readonly AssessmentRow[],
  deadlines: readonly DeadlineView[],
  evidence: EvidenceInput,
  measures: readonly OpenMeasureView[],
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
      title: c.title,
      reference: `${c.number} · ${c.chapter}`,
      ownerName: null,
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
      title: d.label,
      reference: "Frist",
      ownerName: null,
      dueDate: d.dueDate,
      dueInDays: d.days,
      statusLabel: deadlineLabel(d.days),
      href: null,
      source: "deadline",
    });
  }
  for (const m of measures) {
    if (m.status === "done" || m.days > SOON_DAYS) continue;
    items.push({
      key: `measure:${m.id}`,
      priority: m.days < 0 ? "high" : "medium",
      criterionNumber: m.criterionNumber,
      topic: `${m.title} (${m.criterionNumber} ${m.criterionTitle})`,
      title: m.title,
      reference: `Massnahme zu ${m.criterionNumber} ${m.criterionTitle}`,
      ownerName: m.ownerName,
      dueDate: m.dueDate,
      dueInDays: m.days,
      statusLabel: measureLabel(m.days),
      href: criterionHref(m.criterionNumber),
      source: "measure",
    });
  }
  for (const e of evidence.stale) {
    items.push({
      key: `evidence:stale:${e.number}`,
      priority: "high",
      criterionNumber: e.number,
      topic: `${e.number} ${e.title}`,
      title: e.title,
      reference: `${e.number} · Nachweis`,
      ownerName: null,
      dueDate: e.validUntil,
      dueInDays: daysUntil(e.validUntil, now),
      statusLabel: "Nachweis veraltet",
      href: criterionHref(e.number),
      source: "evidence",
    });
  }
  if (evidence.missingMet > 0) {
    const missingTopic =
      evidence.missingMet === 1
        ? "1 erfülltes Pflichtkriterium ohne Nachweis"
        : `${evidence.missingMet} erfüllte Pflichtkriterien ohne Nachweis`;
    items.push({
      key: "evidence:missing",
      priority: "medium",
      criterionNumber: null,
      topic: missingTopic,
      title: missingTopic,
      reference: "Nachweise",
      ownerName: null,
      dueDate: null,
      dueInDays: null,
      statusLabel: "Nachweis fehlt",
      href: "/criteria?status=met&evidence=none&scope=mandatory",
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
  /** Nicht erledigte Massnahmen (offen oder in Bearbeitung) und davon überfällige; ändert die Readiness nie. */
  measures: { open: number; overdue: number };
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
  const [criteria, deadlines, evidenceInfo, openMeasures, versions] = await Promise.all([
    listAssessments(ctx),
    listDeadlines(ctx, now),
    getEvidenceInfo(ctx, now),
    listOpenMeasures(ctx, now),
    db
      .select({ status: standardVersion.validationStatus })
      .from(standardVersion)
      .where(eq(standardVersion.id, ACTIVE_STANDARD_VERSION)),
  ]);
  const basisValidated = versions[0]?.status === "validated";
  const overview = evidenceOverview(criteria, evidenceInfo, mode);
  const actions = buildActionItems(criteria, deadlines, overview.input, openMeasures, mode, now);
  return {
    readiness: computeReadiness(criteria, mode, basisValidated),
    actions,
    deadlines,
    chapters: chapterProgress(criteria, mode),
    evidence: overview.counts,
    measures: { open: openMeasures.length, overdue: openMeasures.filter((m) => m.days < 0).length },
    expiry: expiryOf(deadlines, now),
    overdueCount: deadlines.filter((d) => d.days < 0).length,
    soonCount: actions.filter((a) => a.source !== "evidence" && a.dueInDays !== null && a.dueInDays <= SOON_DAYS).length,
  };
}
