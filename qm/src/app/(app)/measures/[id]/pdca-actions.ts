"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import {
  addStep, closeMeasure, completeDo, completePlan, moveStep, recordEffectiveness, refineMeasure, removeStep,
  renameStep, reopenMeasure, setEffectivenessCriterion, startNewCycle, toggleStep,
} from "@/domain/measure-pdca";
import { ForbiddenError, ValidationError, type OrgContext } from "@/domain/org-context";
import { requireOrgContextOrRedirect } from "@/domain/request-context";
import {
  addStepInput, closeInput, completeDoInput, criterionInput, idInput, moveStepInput, PDCA_FIELD_MESSAGES,
  recordInput, removeStepInput, renameStepInput, toggleStepInput,
} from "./pdca-input";

export type PdcaFormState = { ok: boolean; message: string } | null;

const INVALID = "Die Eingabe ist unvollständig oder ungültig.";
const FORBIDDEN = "Sie haben keine Berechtigung für diese Änderung.";

type Done = { criterionNumber: string };

function revalidateMeasure(measureId: string, criterionNumber: string) {
  revalidatePath("/");
  revalidatePath("/measures");
  revalidatePath(`/measures/${measureId}`);
  revalidatePath(`/criteria/${encodeURIComponent(criterionNumber)}`);
}

/**
 * Gemeinsamer Ablauf: Eingabe prüfen, Kontext, dann der Service. Rechte und Phasenregeln entscheiden allein die Services;
 * die Oberfläche zeigt nur deren Meldungen. Es werden nie Zeitpunkte aus der Eingabe oder der Action in den Service gereicht
 * (kein checkedAt, kein now): die Datenbank bzw. der Service setzt die Zeit selbst.
 */
async function run<S extends z.ZodType<{ measureId: string }>>(
  schema: S,
  formData: FormData,
  success: string,
  work: (ctx: OrgContext, data: z.output<S>) => Promise<Done>,
): Promise<PdcaFormState> {
  const ctx = await requireOrgContextOrRedirect();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues.find((i) => PDCA_FIELD_MESSAGES.has(String(i.path[0])));
    return { ok: false, message: issue?.message ?? INVALID };
  }
  let done: Done;
  try {
    done = await work(ctx, parsed.data);
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, message: e.message };
    if (e instanceof ForbiddenError) return { ok: false, message: FORBIDDEN };
    throw e;
  }
  revalidateMeasure(parsed.data.measureId, done.criterionNumber);
  return { ok: true, message: success };
}

type Action = (prev: PdcaFormState, formData: FormData) => Promise<PdcaFormState>;

export const setCriterionAction: Action = async (_p, f) =>
  run(criterionInput, f, "Wirksamkeitskriterium gespeichert.", (ctx, d) => setEffectivenessCriterion(ctx, d.measureId, d.effectivenessCriterion));
export const completePlanAction: Action = async (_p, f) =>
  run(idInput, f, "Plan abgeschlossen, die Massnahme ist jetzt in der Phase Do.", (ctx, d) => completePlan(ctx, d.measureId));
export const addStepAction: Action = async (_p, f) =>
  run(addStepInput, f, "Schritt hinzugefügt.", (ctx, d) => addStep(ctx, d.measureId, d.title));
export const renameStepAction: Action = async (_p, f) =>
  run(renameStepInput, f, "Schritt gespeichert.", (ctx, d) => renameStep(ctx, d.measureId, d.stepId, d.title));
export const toggleStepAction: Action = async (_p, f) =>
  run(toggleStepInput, f, "Schritt aktualisiert.", (ctx, d) => toggleStep(ctx, d.measureId, d.stepId, d.done));
export const removeStepAction: Action = async (_p, f) =>
  run(removeStepInput, f, "Schritt entfernt.", (ctx, d) => removeStep(ctx, d.measureId, d.stepId));
export const moveStepAction: Action = async (_p, f) =>
  run(moveStepInput, f, "Schritt verschoben.", (ctx, d) => moveStep(ctx, d.measureId, d.stepId, d.direction));
export const completeDoAction: Action = async (_p, f) =>
  run(completeDoInput, f, "Do abgeschlossen, die Massnahme ist jetzt in der Phase Check.", (ctx, d) =>
    completeDo(ctx, d.measureId, { confirmNoSteps: d.confirmNoSteps }));
export const recordEffectivenessAction: Action = async (_p, f) =>
  run(recordInput, f, "Wirksamkeit bewertet, die Massnahme ist jetzt in der Phase Act.", (ctx, d) =>
    recordEffectiveness(ctx, d.measureId, { result: d.result, note: d.note }));
export const closeMeasureAction: Action = async (_p, f) =>
  run(closeInput, f, "Massnahme abgeschlossen.", (ctx, d) => closeMeasure(ctx, d.measureId, { reason: d.reason }));
export const refineMeasureAction: Action = async (_p, f) =>
  run(idInput, f, "Massnahme nachgeschärft, sie ist wieder in der Phase Do.", (ctx, d) => refineMeasure(ctx, d.measureId));
export const startNewCycleAction: Action = async (_p, f) =>
  run(idInput, f, "Neuer Zyklus gestartet, die Massnahme ist wieder in der Phase Plan.", (ctx, d) => startNewCycle(ctx, d.measureId));
export const reopenMeasureAction: Action = async (_p, f) =>
  run(idInput, f, "Massnahme wiedereröffnet.", (ctx, d) => reopenMeasure(ctx, d.measureId));
