import { z } from "zod";
import { REVIEW_RESULTS } from "@/db/schema";

// Nur die Form wird hier geprüft (Typ, Obergrenze gegen riesige Eingaben); Längen und Regeln entscheiden die Services.
const measureId = z.uuid();
const stepId = z.uuid();
const text = (max: number, message: string) => z.string(message).max(max, message);

export const idInput = z.object({ measureId });
export const criterionInput = z.object({
  measureId,
  effectivenessCriterion: text(2000, "Das Wirksamkeitskriterium muss zwischen 3 und 500 Zeichen lang sein."),
});
export const addStepInput = z.object({ measureId, title: text(1000, "Der Titel des Schritts muss zwischen 3 und 200 Zeichen lang sein.") });
export const renameStepInput = z.object({ measureId, stepId, title: text(1000, "Der Titel des Schritts muss zwischen 3 und 200 Zeichen lang sein.") });
export const toggleStepInput = z.object({ measureId, stepId, done: z.enum(["true", "false"]).transform((v) => v === "true") });
export const removeStepInput = z.object({ measureId, stepId });
export const moveStepInput = z.object({ measureId, stepId, direction: z.enum(["up", "down"]) });
export const completeDoInput = z.object({
  measureId,
  confirmNoSteps: z.string().optional().transform((v) => v === "on"),
});
export const recordInput = z.object({
  measureId,
  result: z.enum(REVIEW_RESULTS, "Bitte wählen Sie ein Ergebnis."),
  note: text(5000, "Die Notiz muss zwischen 3 und 1000 Zeichen lang sein."),
});
export const closeInput = z.object({
  measureId,
  reason: text(5000, "Die Begründung darf höchstens 1000 Zeichen lang sein.").optional(),
});

/** Felder, deren Zod-Meldung deutsch und für Nutzer bestimmt ist; alles andere ist ein manipulierter Aufruf. */
export const PDCA_FIELD_MESSAGES: ReadonlySet<string> = new Set(["effectivenessCriterion", "title", "result", "note", "reason"]);
