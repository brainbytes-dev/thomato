"use server";

import { revalidatePath } from "next/cache";
import { getAssessmentByNumber, setAssessmentDueDate, setAssessmentStatus } from "@/domain/assessments";
import { ForbiddenError, ValidationError } from "@/domain/org-context";
import { requireOrgContextOrRedirect } from "@/domain/request-context";
import { can } from "@/domain/rights";
import { assessmentInput, isStatusUnchanged } from "./action-input";

export type FormState = { ok: boolean; message: string } | null;

export async function updateAssessmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = assessmentInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Die Eingabe ist unvollständig oder ungültig." };
  const { number, status, reason, dueDate } = parsed.data;
  const ctx = await requireOrgContextOrRedirect();
  if (!can(ctx.role, "assessment", "write")) return { ok: false, message: "Sie haben keine Berechtigung für diese Änderung." };
  const detail = await getAssessmentByNumber(ctx, number);
  if (!detail) return { ok: false, message: "Das Kriterium wurde nicht gefunden." };

  const due = dueDate && dueDate.length > 0 ? dueDate : null;
  const statusUnchanged = isStatusUnchanged(detail, { status, reason });

  try {
    // Zwei getrennte, je auditierte Schritte: Stand und Frist.
    if (!statusUnchanged) await setAssessmentStatus(ctx, detail.criterionId, status, { reason });
    if (due !== detail.dueDate) await setAssessmentDueDate(ctx, detail.criterionId, due);
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, message: e.message };
    if (e instanceof ForbiddenError) return { ok: false, message: "Sie haben keine Berechtigung für diese Änderung." };
    throw e;
  }

  revalidatePath("/");
  revalidatePath("/criteria");
  revalidatePath(`/criteria/${encodeURIComponent(number)}`);
  return { ok: true, message: "Gespeichert." };
}
