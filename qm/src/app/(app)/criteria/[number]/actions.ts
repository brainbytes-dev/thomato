"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ASSESSMENT_STATUSES } from "@/db/schema";
import { getAssessmentByNumber, setAssessmentDueDate, setAssessmentStatus } from "@/domain/assessments";
import { ForbiddenError, ValidationError } from "@/domain/org-context";
import { requireOrgContextOrRedirect } from "@/domain/request-context";

export type FormState = { ok: boolean; message: string } | null;

const input = z.object({
  number: z.string().min(1).max(40),
  status: z.enum(ASSESSMENT_STATUSES),
  reason: z.string().max(2000).optional(),
  dueDate: z.string().max(20).optional(),
});

export async function updateAssessmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = input.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Eingabe unvollständig oder ungültig." };
  const { number, status, reason, dueDate } = parsed.data;
  const ctx = await requireOrgContextOrRedirect();
  const detail = await getAssessmentByNumber(ctx, number);
  if (!detail) return { ok: false, message: "Kriterium nicht gefunden." };

  const due = dueDate && dueDate.length > 0 ? dueDate : null;
  const trimmedReason = (reason ?? "").trim();
  const statusUnchanged =
    status === detail.status &&
    (status !== "not_applicable" || trimmedReason === (detail.notApplicableReason ?? ""));

  try {
    // Zwei getrennte, je auditierte Schritte: Stand und Frist.
    if (!statusUnchanged) await setAssessmentStatus(ctx, detail.criterionId, status, { reason });
    if (due !== detail.dueDate) await setAssessmentDueDate(ctx, detail.criterionId, due);
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, message: e.message };
    if (e instanceof ForbiddenError) return { ok: false, message: "Keine Berechtigung für diese Änderung." };
    throw e;
  }

  revalidatePath("/");
  revalidatePath("/criteria");
  revalidatePath(`/criteria/${number}`);
  return { ok: true, message: "Gespeichert." };
}
