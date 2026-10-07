import { z } from "zod";
import { ASSESSMENT_STATUSES } from "@/db/schema";
import { isValidIsoDate } from "@/domain/dates";

export const assessmentInput = z.object({
  number: z.string().min(1).max(40),
  status: z.enum(ASSESSMENT_STATUSES),
  reason: z.string().max(2000).optional(),
  dueDate: z
    .string()
    .max(20)
    .refine((v) => v === "" || isValidIsoDate(v), "Die Frist muss ein gültiges Datum sein.")
    .optional(),
});

export function isStatusUnchanged(
  current: { status: string; notApplicableReason: string | null },
  next: { status: string; reason?: string },
): boolean {
  if (next.status !== current.status) return false;
  if (next.status !== "not_applicable") return true;
  return (next.reason ?? "").trim() === (current.notApplicableReason ?? "");
}
