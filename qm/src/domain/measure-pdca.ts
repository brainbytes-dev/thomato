import { aliasedTable, and, asc, desc, eq, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  criterion, measure, measureReview, measureStep, REVIEW_RESULTS, user,
  type MeasurePhase, type MeasureRow, type MeasureStatus, type ReviewResult,
} from "@/db/schema";
import { withAudit } from "./audit";
import {
  lockMeasure, MEASURE_NOT_FOUND, toView, viewColumns, withOptionalAudit, type MeasureView,
} from "./measures";
import { assertCan, ValidationError, type OrgContext } from "./org-context";
import { can, type Role } from "./rights";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STEP_NOT_FOUND = "Der Schritt wurde nicht gefunden.";
const CRITERION_MIN = 3;
const CRITERION_MAX = 500;
const STEP_MIN = 3;
const STEP_MAX = 200;
const NOTE_MIN = 3;
const NOTE_MAX = 1000;
const REASON_MIN = 10;
const REASON_MAX = 1000;

const PHASE_LABEL: Record<MeasurePhase, string> = { plan: "Plan", do: "Do", check: "Check", act: "Act" };

const length = (s: string) => [...s].length;

/** Verhindert jeden Übergang ausserhalb der definierten Phasen; die Meldung nennt Aktion und aktuelle Phase. */
function requirePhase(row: MeasureRow, allowed: readonly MeasurePhase[], what: string): void {
  if (allowed.includes(row.phase)) return;
  const names = allowed.map((p) => PHASE_LABEL[p]).join(" oder ");
  throw new ValidationError(`${what} ist nur in der Phase ${names} möglich. Die Massnahme ist in der Phase ${PHASE_LABEL[row.phase]}.`);
}

function requireNotClosed(row: MeasureRow): void {
  if (row.status === "done") {
    throw new ValidationError("Die Massnahme ist bereits abgeschlossen. Sie kann nur wiedereröffnet werden.");
  }
}

/** Gemeinsamer Zustand in jedem Audit-Payload; criterionNumbers hängt das Event an die Kriterienhistorie. */
function stateOf(row: MeasureRow) {
  return {
    title: row.title,
    phase: row.phase,
    status: row.status,
    cycle: row.cycle,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    criterionNumbers: [row.criterionNumber],
  };
}

type Patch = Partial<Pick<MeasureRow, "phase" | "status" | "cycle" | "completedAt" | "effectivenessCriterion">>;

async function patchMeasure(tx: Tx, ctx: OrgContext, row: MeasureRow, patch: Patch): Promise<MeasureRow> {
  const next: MeasureRow = { ...row, ...patch };
  await tx
    .update(measure)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(measure.id, row.id), eq(measure.organizationId, ctx.organizationId)));
  return next;
}

async function latestReview(tx: Tx, ctx: OrgContext, measureId: string) {
  const [r] = await tx
    .select()
    .from(measureReview)
    .where(and(eq(measureReview.measureId, measureId), eq(measureReview.organizationId, ctx.organizationId)))
    .orderBy(desc(measureReview.checkedAt), desc(measureReview.id))
    .limit(1);
  return r ?? null;
}

type Done = { criterionNumber: string };

// ---------------------------------------------------------------- Plan

export async function setEffectivenessCriterion(ctx: OrgContext, id: string, text: string | null): Promise<Done> {
  assertCan(ctx, "measure", "write");
  const value = text === null || text.trim() === "" ? null : text.trim();
  if (value !== null && (length(value) < CRITERION_MIN || length(value) > CRITERION_MAX)) {
    throw new ValidationError(`Das Wirksamkeitskriterium muss zwischen ${CRITERION_MIN} und ${CRITERION_MAX} Zeichen lang sein.`);
  }
  return withOptionalAudit(ctx, async (tx) => {
    const row = await lockMeasure(tx, ctx, id);
    requirePhase(row, ["plan", "do"], "Das Wirksamkeitskriterium festzulegen");
    if (row.effectivenessCriterion === value) return { result: { criterionNumber: row.criterionNumber }, event: null };
    await patchMeasure(tx, ctx, row, { effectivenessCriterion: value });
    return {
      result: { criterionNumber: row.criterionNumber },
      event: {
        eventType: "measure.updated",
        entityType: "measure",
        entityId: row.id,
        before: { title: row.title, effectivenessCriterion: row.effectivenessCriterion, criterionNumbers: [row.criterionNumber] },
        after: { title: row.title, effectivenessCriterion: value, criterionNumbers: [row.criterionNumber] },
      },
    };
  });
}

export async function completePlan(ctx: OrgContext, id: string): Promise<Done> {
  assertCan(ctx, "measure", "write");
  return withAudit(ctx, async (tx) => {
    const row = await lockMeasure(tx, ctx, id);
    requirePhase(row, ["plan"], "Plan abschliessen");
    const next = await patchMeasure(tx, ctx, row, { phase: "do", status: "in_progress" });
    return {
      result: { criterionNumber: row.criterionNumber },
      event: { eventType: "measure.phase_changed", entityType: "measure", entityId: row.id, before: stateOf(row), after: stateOf(next) },
    };
  });
}

// ---------------------------------------------------------------- Do: Checkliste

function stepTitleOf(input: string): string {
  const title = input.trim();
  if (length(title) < STEP_MIN || length(title) > STEP_MAX) {
    throw new ValidationError(`Der Titel des Schritts muss zwischen ${STEP_MIN} und ${STEP_MAX} Zeichen lang sein.`);
  }
  return title;
}

async function loadStep(tx: Tx, ctx: OrgContext, measureId: string, stepId: string) {
  if (!UUID.test(stepId)) throw new ValidationError(STEP_NOT_FOUND);
  const [step] = await tx
    .select()
    .from(measureStep)
    .where(and(eq(measureStep.id, stepId), eq(measureStep.measureId, measureId), eq(measureStep.organizationId, ctx.organizationId)));
  if (!step) throw new ValidationError(STEP_NOT_FOUND);
  return step;
}

type StepRow = typeof measureStep.$inferSelect;

function stepPayload(row: MeasureRow, step: StepRow, over: Partial<{ stepTitle: string; position: number; done: boolean }> = {}) {
  return {
    title: row.title,
    stepId: step.id,
    stepTitle: over.stepTitle ?? step.title,
    position: over.position ?? step.position,
    done: over.done ?? step.doneAt !== null,
    criterionNumbers: [row.criterionNumber],
  };
}

const STEPS_ONLY_IN_DO = "Die Checkliste zu bearbeiten";

export async function addStep(ctx: OrgContext, id: string, title: string): Promise<Done & { stepId: string }> {
  assertCan(ctx, "measure", "write");
  const clean = stepTitleOf(title);
  return withAudit(ctx, async (tx) => {
    const row = await lockMeasure(tx, ctx, id);
    requirePhase(row, ["do"], STEPS_ONLY_IN_DO);
    const [last] = await tx
      .select({ position: sql<number>`coalesce(max(${measureStep.position}), 0)` })
      .from(measureStep)
      .where(and(eq(measureStep.measureId, row.id), eq(measureStep.organizationId, ctx.organizationId)));
    const [step] = await tx
      .insert(measureStep)
      .values({ organizationId: ctx.organizationId, measureId: row.id, phase: "do", position: Number(last.position) + 1, title: clean })
      .returning();
    return {
      result: { criterionNumber: row.criterionNumber, stepId: step.id },
      event: { eventType: "measure.step_added", entityType: "measure", entityId: row.id, before: null, after: stepPayload(row, step) },
    };
  });
}

export async function renameStep(ctx: OrgContext, id: string, stepId: string, title: string): Promise<Done> {
  assertCan(ctx, "measure", "write");
  const clean = stepTitleOf(title);
  return withOptionalAudit(ctx, async (tx) => {
    const row = await lockMeasure(tx, ctx, id);
    requirePhase(row, ["do"], STEPS_ONLY_IN_DO);
    const step = await loadStep(tx, ctx, row.id, stepId);
    if (step.title === clean) return { result: { criterionNumber: row.criterionNumber }, event: null };
    await tx.update(measureStep).set({ title: clean }).where(and(eq(measureStep.id, step.id), eq(measureStep.organizationId, ctx.organizationId)));
    return {
      result: { criterionNumber: row.criterionNumber },
      event: {
        eventType: "measure.step_updated",
        entityType: "measure",
        entityId: row.id,
        before: stepPayload(row, step),
        after: { ...stepPayload(row, step, { stepTitle: clean }), change: "renamed" },
      },
    };
  });
}

/** Setzt den Erledigt-Zustand ausdrücklich (nicht blind umschalten): ein doppelter Klick bleibt ohne Wirkung. */
export async function toggleStep(
  ctx: OrgContext,
  id: string,
  stepId: string,
  done: boolean,
  now: Date = new Date(),
): Promise<Done> {
  assertCan(ctx, "measure", "write");
  return withOptionalAudit(ctx, async (tx) => {
    const row = await lockMeasure(tx, ctx, id);
    requirePhase(row, ["do"], STEPS_ONLY_IN_DO);
    const step = await loadStep(tx, ctx, row.id, stepId);
    if ((step.doneAt !== null) === done) return { result: { criterionNumber: row.criterionNumber }, event: null };
    await tx
      .update(measureStep)
      .set(done ? { doneAt: now, doneBy: ctx.userId } : { doneAt: null, doneBy: null })
      .where(and(eq(measureStep.id, step.id), eq(measureStep.organizationId, ctx.organizationId)));
    return {
      result: { criterionNumber: row.criterionNumber },
      event: {
        eventType: "measure.step_updated",
        entityType: "measure",
        entityId: row.id,
        before: stepPayload(row, step),
        after: { ...stepPayload(row, step, { done }), change: done ? "done" : "undone" },
      },
    };
  });
}

export async function removeStep(ctx: OrgContext, id: string, stepId: string): Promise<Done> {
  assertCan(ctx, "measure", "write");
  return withAudit(ctx, async (tx) => {
    const row = await lockMeasure(tx, ctx, id);
    requirePhase(row, ["do"], STEPS_ONLY_IN_DO);
    const step = await loadStep(tx, ctx, row.id, stepId);
    await tx.delete(measureStep).where(and(eq(measureStep.id, step.id), eq(measureStep.organizationId, ctx.organizationId)));
    // Lücke schliessen: die Positionen bleiben lückenlos 1..n.
    await tx
      .update(measureStep)
      .set({ position: sql`${measureStep.position} - 1` })
      .where(
        and(
          eq(measureStep.measureId, row.id),
          eq(measureStep.organizationId, ctx.organizationId),
          sql`${measureStep.position} > ${step.position}`,
        ),
      );
    return {
      result: { criterionNumber: row.criterionNumber },
      event: { eventType: "measure.step_removed", entityType: "measure", entityId: row.id, before: stepPayload(row, step), after: null },
    };
  });
}

export async function moveStep(ctx: OrgContext, id: string, stepId: string, direction: "up" | "down"): Promise<Done> {
  assertCan(ctx, "measure", "write");
  if (direction !== "up" && direction !== "down") throw new ValidationError("Die Richtung ist ungültig.");
  return withOptionalAudit(ctx, async (tx) => {
    const row = await lockMeasure(tx, ctx, id);
    requirePhase(row, ["do"], STEPS_ONLY_IN_DO);
    const step = await loadStep(tx, ctx, row.id, stepId);
    const targetPosition = direction === "up" ? step.position - 1 : step.position + 1;
    const [neighbour] = await tx
      .select()
      .from(measureStep)
      .where(and(eq(measureStep.measureId, row.id), eq(measureStep.organizationId, ctx.organizationId), eq(measureStep.position, targetPosition)));
    // Am Rand der Liste gibt es nichts zu tauschen.
    if (!neighbour) return { result: { criterionNumber: row.criterionNumber }, event: null };
    await tx.update(measureStep).set({ position: targetPosition }).where(and(eq(measureStep.id, step.id), eq(measureStep.organizationId, ctx.organizationId)));
    await tx.update(measureStep).set({ position: step.position }).where(and(eq(measureStep.id, neighbour.id), eq(measureStep.organizationId, ctx.organizationId)));
    return {
      result: { criterionNumber: row.criterionNumber },
      event: {
        eventType: "measure.step_updated",
        entityType: "measure",
        entityId: row.id,
        before: stepPayload(row, step),
        after: { ...stepPayload(row, step, { position: targetPosition }), change: "moved" },
      },
    };
  });
}

export async function completeDo(ctx: OrgContext, id: string, input: { confirmNoSteps?: boolean }): Promise<Done> {
  assertCan(ctx, "measure", "write");
  return withAudit(ctx, async (tx) => {
    const row = await lockMeasure(tx, ctx, id);
    requirePhase(row, ["do"], "Do abschliessen");
    const steps = await tx
      .select({ doneAt: measureStep.doneAt })
      .from(measureStep)
      .where(and(eq(measureStep.measureId, row.id), eq(measureStep.organizationId, ctx.organizationId)));
    const open = steps.filter((s) => s.doneAt === null).length;
    if (open > 0) {
      throw new ValidationError(
        open === 1 ? "Es ist noch 1 Schritt offen. Bitte erledigen Sie ihn, bevor Sie Do abschliessen." : `Es sind noch ${open} Schritte offen. Bitte erledigen Sie diese, bevor Sie Do abschliessen.`,
      );
    }
    const confirmedNoSteps = steps.length === 0;
    if (confirmedNoSteps && input.confirmNoSteps !== true) {
      throw new ValidationError("Es gibt keine Schritte. Bestätigen Sie ausdrücklich, dass Do ohne Checkliste abgeschlossen wird.");
    }
    const next = await patchMeasure(tx, ctx, row, { phase: "check" });
    return {
      result: { criterionNumber: row.criterionNumber },
      event: {
        eventType: "measure.phase_changed",
        entityType: "measure",
        entityId: row.id,
        before: stateOf(row),
        after: { ...stateOf(next), confirmedNoSteps },
      },
    };
  });
}

// ---------------------------------------------------------------- Check

export async function recordEffectiveness(
  ctx: OrgContext,
  id: string,
  input: { result: ReviewResult; note: string },
  /** Nur für Seed und Tests mit festem Zeitpunkt; im Betrieb setzt die Datenbank die Zeit selbst (monoton unter der Zeilensperre). */
  checkedAt?: Date,
): Promise<Done & { reviewId: string }> {
  assertCan(ctx, "measure", "approve");
  if (!REVIEW_RESULTS.includes(input.result)) throw new ValidationError("Das Ergebnis der Wirksamkeitsprüfung ist ungültig.");
  const note = input.note.trim();
  if (length(note) < NOTE_MIN || length(note) > NOTE_MAX) {
    throw new ValidationError(`Die Notiz muss zwischen ${NOTE_MIN} und ${NOTE_MAX} Zeichen lang sein.`);
  }
  return withAudit(ctx, async (tx) => {
    const row = await lockMeasure(tx, ctx, id);
    requirePhase(row, ["check"], "Die Wirksamkeit zu bewerten");
    const [review] = await tx
      .insert(measureReview)
      .values({ organizationId: ctx.organizationId, measureId: row.id, cycle: row.cycle, result: input.result, note, checkedBy: ctx.userId, ...(checkedAt ? { checkedAt } : {}) })
      .returning({ id: measureReview.id });
    // Auch bei «wirksam» geht es nur nach Act; abgeschlossen wird nie automatisch.
    const next = await patchMeasure(tx, ctx, row, { phase: "act" });
    return {
      result: { criterionNumber: row.criterionNumber, reviewId: review.id },
      event: {
        eventType: "measure.effectiveness_recorded",
        entityType: "measure",
        entityId: row.id,
        before: stateOf(row),
        after: { ...stateOf(next), reviewId: review.id, result: input.result, note },
      },
    };
  });
}

// ---------------------------------------------------------------- Act

export async function closeMeasure(
  ctx: OrgContext,
  id: string,
  input: { reason?: string },
  now: Date = new Date(),
): Promise<Done> {
  assertCan(ctx, "measure", "approve");
  const reason = input.reason === undefined || input.reason.trim() === "" ? null : input.reason.trim();
  return withAudit(ctx, async (tx) => {
    const row = await lockMeasure(tx, ctx, id);
    requireNotClosed(row);
    requirePhase(row, ["act"], "Abschliessen");
    const last = await latestReview(tx, ctx, row.id);
    const needsReason = last !== null && last.result !== "effective";
    if (needsReason && reason === null) {
      throw new ValidationError(
        `Die letzte Bewertung lautet «${last.result === "partly" ? "teilweise wirksam" : "nicht wirksam"}». Für den Abschluss ist eine Begründung nötig (mindestens ${REASON_MIN} Zeichen).`,
      );
    }
    if (reason !== null && (length(reason) < REASON_MIN || length(reason) > REASON_MAX)) {
      throw new ValidationError(`Die Begründung muss zwischen ${REASON_MIN} und ${REASON_MAX} Zeichen lang sein.`);
    }
    const next = await patchMeasure(tx, ctx, row, { status: "done", completedAt: now });
    return {
      result: { criterionNumber: row.criterionNumber },
      event: {
        eventType: "measure.closed",
        entityType: "measure",
        entityId: row.id,
        before: stateOf(row),
        after: { ...stateOf(next), result: last?.result ?? null, reason },
      },
    };
  });
}

export async function refineMeasure(ctx: OrgContext, id: string): Promise<Done> {
  assertCan(ctx, "measure", "approve");
  return withAudit(ctx, async (tx) => {
    const row = await lockMeasure(tx, ctx, id);
    requireNotClosed(row);
    requirePhase(row, ["act"], "Nachschärfen");
    const last = await latestReview(tx, ctx, row.id);
    const next = await patchMeasure(tx, ctx, row, { phase: "do", status: "in_progress" });
    return {
      result: { criterionNumber: row.criterionNumber },
      event: {
        eventType: "measure.refined",
        entityType: "measure",
        entityId: row.id,
        before: stateOf(row),
        after: { ...stateOf(next), previousResult: last?.result ?? null },
      },
    };
  });
}

/** Neuer Zyklus: Phase Plan, Zyklus plus 1. Das Wirksamkeitskriterium bleibt als Vorschlag stehen, Bewertungen werden nie angefasst. */
export async function startNewCycle(ctx: OrgContext, id: string): Promise<Done> {
  assertCan(ctx, "measure", "approve");
  return withAudit(ctx, async (tx) => {
    const row = await lockMeasure(tx, ctx, id);
    requireNotClosed(row);
    requirePhase(row, ["act"], "Ein neuer Zyklus");
    const last = await latestReview(tx, ctx, row.id);
    const next = await patchMeasure(tx, ctx, row, { phase: "plan", status: "in_progress", cycle: row.cycle + 1 });
    return {
      result: { criterionNumber: row.criterionNumber },
      event: {
        eventType: "measure.cycle_started",
        entityType: "measure",
        entityId: row.id,
        before: stateOf(row),
        after: { ...stateOf(next), previousResult: last?.result ?? null },
      },
    };
  });
}

export async function reopenMeasure(ctx: OrgContext, id: string): Promise<Done> {
  assertCan(ctx, "measure", "approve");
  return withAudit(ctx, async (tx) => {
    const row = await lockMeasure(tx, ctx, id);
    if (row.status !== "done") {
      throw new ValidationError("Nur eine abgeschlossene Massnahme kann wiedereröffnet werden.");
    }
    const next = await patchMeasure(tx, ctx, row, { phase: "do", status: "in_progress", completedAt: null });
    return {
      result: { criterionNumber: row.criterionNumber },
      event: { eventType: "measure.reopened", entityType: "measure", entityId: row.id, before: stateOf(row), after: stateOf(next) },
    };
  });
}

// ---------------------------------------------------------------- Lesen

export type MeasureAction =
  | "set_criterion" | "complete_plan" | "edit_steps" | "complete_do" | "record_effectiveness"
  | "close" | "refine" | "start_cycle" | "reopen";

/** Welche Aktionen die Rolle in Phase und Status der Massnahme ausführen darf (Rechte und Übergänge, eine Quelle für die Oberfläche). */
export function allowedMeasureActions(role: Role, m: { phase: MeasurePhase; status: MeasureStatus }): MeasureAction[] {
  const write = can(role, "measure", "write");
  const approve = can(role, "measure", "approve");
  if (m.status === "done") return approve ? ["reopen"] : [];
  switch (m.phase) {
    case "plan":
      return write ? ["set_criterion", "complete_plan"] : [];
    case "do":
      return write ? ["set_criterion", "edit_steps", "complete_do"] : [];
    case "check":
      return approve ? ["record_effectiveness"] : [];
    case "act":
      return approve ? ["close", "refine", "start_cycle"] : [];
  }
}

export type MeasureDetail = {
  measure: MeasureView & { criterionTitle: string; effectivenessCriterion: string | null };
  steps: { id: string; position: number; title: string; done: boolean; doneAt: Date | null; doneByName: string | null }[];
  reviewsByCycle: { cycle: number; reviews: ReviewView[] }[];
  lastReview: ReviewView | null;
  allowedActions: MeasureAction[];
};

export type ReviewView = {
  id: string;
  cycle: number;
  result: ReviewResult;
  note: string;
  checkedAt: Date;
  checkedByName: string | null;
};

export async function getMeasureDetail(ctx: OrgContext, id: string, now: Date): Promise<MeasureDetail> {
  assertCan(ctx, "measure", "read");
  if (!UUID.test(id)) throw new ValidationError(MEASURE_NOT_FOUND);
  const [m] = await db
    .select({ ...viewColumns, criterionTitle: criterion.title, effectivenessCriterion: measure.effectivenessCriterion })
    .from(measure)
    .innerJoin(criterion, and(eq(criterion.standardVersionId, measure.standardVersionId), eq(criterion.number, measure.criterionNumber)))
    .leftJoin(user, eq(user.id, measure.ownerUserId))
    .where(and(eq(measure.id, id), eq(measure.organizationId, ctx.organizationId)));
  if (!m) throw new ValidationError(MEASURE_NOT_FOUND);

  const doer = aliasedTable(user, "doer");
  const stepRows = await db
    .select({ id: measureStep.id, position: measureStep.position, title: measureStep.title, doneAt: measureStep.doneAt, doneByName: doer.name })
    .from(measureStep)
    .leftJoin(doer, eq(doer.id, measureStep.doneBy))
    .where(and(eq(measureStep.measureId, m.id), eq(measureStep.organizationId, ctx.organizationId)))
    .orderBy(asc(measureStep.position), asc(measureStep.id));

  const checker = aliasedTable(user, "checker");
  const reviews: ReviewView[] = await db
    .select({
      id: measureReview.id, cycle: measureReview.cycle, result: measureReview.result, note: measureReview.note,
      checkedAt: measureReview.checkedAt, checkedByName: checker.name,
    })
    .from(measureReview)
    .leftJoin(checker, eq(checker.id, measureReview.checkedBy))
    .where(and(eq(measureReview.measureId, m.id), eq(measureReview.organizationId, ctx.organizationId)))
    .orderBy(asc(measureReview.checkedAt), asc(measureReview.id));

  const byCycle = new Map<number, ReviewView[]>();
  for (const r of reviews) byCycle.set(r.cycle, [...(byCycle.get(r.cycle) ?? []), r]);
  const { criterionTitle, effectivenessCriterion, ...viewRow } = m;
  return {
    measure: { ...toView(viewRow, now), criterionTitle, effectivenessCriterion },
    steps: stepRows.map((s) => ({ ...s, done: s.doneAt !== null })),
    reviewsByCycle: [...byCycle.entries()].sort(([x], [y]) => x - y).map(([cycle, list]) => ({ cycle, reviews: list })),
    lastReview: reviews.at(-1) ?? null,
    allowedActions: allowedMeasureActions(ctx.role, m),
  };
}

export type PdcaFigures = {
  total: number;
  phases: Record<MeasurePhase, number>;
  /** Anteil der Massnahmen mit letzter Bewertung «wirksam» unter allen bewerteten Massnahmen; null ohne Bewertung. */
  effective: { percent: number | null; n: number };
  /** Durchschnitt von Anlage bis Abschluss in Tagen (eine Nachkommastelle) über abgeschlossene Massnahmen; null ohne. */
  averageDaysToClose: { days: number | null; n: number };
};

const DAY_MS = 86_400_000;

export async function getPdcaFigures(ctx: OrgContext): Promise<PdcaFigures> {
  assertCan(ctx, "measure", "read");
  const rows = await db
    .select({ id: measure.id, phase: measure.phase, status: measure.status, createdAt: measure.createdAt, completedAt: measure.completedAt })
    .from(measure)
    .where(eq(measure.organizationId, ctx.organizationId));
  const reviews = await db
    .select({ measureId: measureReview.measureId, result: measureReview.result })
    .from(measureReview)
    .where(eq(measureReview.organizationId, ctx.organizationId))
    .orderBy(asc(measureReview.checkedAt), asc(measureReview.id));

  const phases: Record<MeasurePhase, number> = { plan: 0, do: 0, check: 0, act: 0 };
  for (const r of rows) phases[r.phase] += 1;

  const latest = new Map<string, ReviewResult>();
  for (const r of reviews) latest.set(r.measureId, r.result);
  const reviewed = [...latest.values()];
  const effectiveCount = reviewed.filter((r) => r === "effective").length;

  const closed = rows.filter((r) => r.status === "done" && r.completedAt !== null);
  const totalDays = closed.reduce((sum, r) => sum + Math.max(0, ((r.completedAt as Date).getTime() - r.createdAt.getTime()) / DAY_MS), 0);

  return {
    total: rows.length,
    phases,
    effective: { percent: reviewed.length === 0 ? null : Math.round((effectiveCount / reviewed.length) * 100), n: reviewed.length },
    averageDaysToClose: { days: closed.length === 0 ? null : Math.round((totalDays / closed.length) * 10) / 10, n: closed.length },
  };
}
