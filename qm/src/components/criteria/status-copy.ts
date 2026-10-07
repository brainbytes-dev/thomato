import type { AssessmentStatus } from "@/db/schema";
import { DEFAULT_PROCEDURE } from "@/domain/dashboard";
import { scopeOf, type CriterionInput } from "@/domain/readiness";

export const STATUS_LABEL: Record<AssessmentStatus, string> = {
  not_assessed: "Nicht bewertet",
  met: "Erfüllt",
  open: "Offen",
  critical: "Kritisch",
  not_applicable: "Entfällt",
};

export const STATUS_TONE: Record<AssessmentStatus, string> = {
  not_assessed: "text-text-muted",
  met: "text-success",
  open: "text-warning",
  critical: "text-critical",
  not_applicable: "text-text-muted",
};

export function scopeLabel(r: Omit<CriterionInput, "status">): string {
  const scope = scopeOf({ ...r, status: "not_assessed" }, DEFAULT_PROCEDURE);
  if (scope.mandatory) return "Muss";
  return scope.should ? "Soll" : "- (nicht im Verfahren)";
}
