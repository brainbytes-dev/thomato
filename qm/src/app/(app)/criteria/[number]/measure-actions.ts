"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { createMeasure, setMeasureStatus, updateMeasure } from "@/domain/measures";
import { ForbiddenError, ValidationError, type OrgContext } from "@/domain/org-context";
import { requireOrgContextOrRedirect } from "@/domain/request-context";
import { can } from "@/domain/rights";
import { createMeasureInput, statusInput, updateMeasureInput } from "./measure-input";

export type MeasureFormState = { ok: boolean; message: string } | null;

const INVALID = "Eingabe unvollständig oder ungültig.";
const FORBIDDEN = "Keine Berechtigung für diese Änderung.";

// Nur diese Felder tragen eigene deutsche Meldungen; alles andere ist ein manipulierter Aufruf.
const FIELD_MESSAGES = new Set(["title", "description", "dueDate"]);

function revalidateMeasures(number: string) {
  revalidatePath("/");
  revalidatePath("/criteria");
  revalidatePath(`/criteria/${encodeURIComponent(number)}`);
}

/** Gemeinsamer Ablauf: Eingabe prüfen, Kontext, Recht, dann der Service. `now` entsteht hier, nicht im Service. */
async function run<S extends z.ZodType<{ number: string }>>(
  schema: S,
  formData: FormData,
  success: string,
  work: (ctx: OrgContext, data: z.output<S>, now: Date) => Promise<string>,
): Promise<MeasureFormState> {
  const ctx = await requireOrgContextOrRedirect();
  if (!can(ctx.role, "measure", "write")) return { ok: false, message: FORBIDDEN };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues.find((i) => FIELD_MESSAGES.has(String(i.path[0])));
    return { ok: false, message: issue?.message ?? INVALID };
  }
  let criterionNumber: string;
  try {
    criterionNumber = await work(ctx, parsed.data, new Date());
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, message: e.message };
    if (e instanceof ForbiddenError) return { ok: false, message: FORBIDDEN };
    throw e;
  }
  revalidateMeasures(criterionNumber);
  return { ok: true, message: success };
}

export async function createMeasureAction(_prev: MeasureFormState, formData: FormData): Promise<MeasureFormState> {
  return run(createMeasureInput, formData, "Massnahme angelegt.", async (ctx, data) => {
    await createMeasure(ctx, {
      criterionNumber: data.number,
      title: data.title,
      description: data.description ? data.description : null,
      ownerUserId: data.ownerUserId,
      dueDate: data.dueDate,
    });
    return data.number;
  });
}

export async function updateMeasureAction(_prev: MeasureFormState, formData: FormData): Promise<MeasureFormState> {
  return run(updateMeasureInput, formData, "Massnahme gespeichert.", async (ctx, data) => {
    const { criterionNumber } = await updateMeasure(ctx, data.measureId, {
      title: data.title,
      description: data.description ? data.description : null,
      ownerUserId: data.ownerUserId,
      dueDate: data.dueDate,
    });
    return criterionNumber;
  });
}

export async function setMeasureStatusAction(_prev: MeasureFormState, formData: FormData): Promise<MeasureFormState> {
  return run(statusInput, formData, "Status geändert.", async (ctx, data, now) => {
    const { criterionNumber } = await setMeasureStatus(ctx, data.measureId, data.status, now);
    return criterionNumber;
  });
}
