import type { AssessmentStatus } from "@/db/schema";
import type { EvidenceState } from "@/domain/evidence";
import { DEFAULT_PROCEDURE } from "@/domain/procedure";
import { scopeOf, type CriterionInput } from "@/domain/readiness";

export const STATUS_LABEL: Record<AssessmentStatus, string> = {
  not_assessed: "Nicht bewertet",
  met: "Erfüllt",
  open: "Offen",
  critical: "Kritisch",
  not_applicable: "Nicht anwendbar",
};

export const STATUS_TONE: Record<AssessmentStatus, string> = {
  not_assessed: "text-text-muted",
  met: "text-success",
  open: "text-warning",
  critical: "text-critical",
  not_applicable: "text-text-muted",
};

export const EVIDENCE_LABEL: Record<EvidenceState, string> = {
  none: "Fehlt",
  stale: "Veraltet",
  current: "Aktuell",
};

export const EVIDENCE_TONE: Record<EvidenceState, string> = {
  none: "text-text-muted",
  stale: "text-warning",
  current: "text-success",
};

export function scopeLabel(r: Omit<CriterionInput, "status">): string {
  const scope = scopeOf({ ...r, status: "not_assessed" }, DEFAULT_PROCEDURE);
  if (scope.mandatory) return "Muss";
  return scope.should ? "Soll" : "- (nicht im Verfahren)";
}
