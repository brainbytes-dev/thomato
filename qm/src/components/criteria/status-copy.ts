import type { BadgeTone } from "@/components/ui/badge";
import type { AssessmentStatus, MeasureStatus } from "@/db/schema";
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

export const STATUS_BADGE: Record<AssessmentStatus, BadgeTone> = {
  not_assessed: "neutral",
  met: "success",
  open: "warning",
  critical: "critical",
  not_applicable: "neutral",
};

export const MEASURE_STATUS_LABEL: Record<MeasureStatus, string> = {
  open: "Offen",
  in_progress: "In Bearbeitung",
  done: "Erledigt",
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

export const EVIDENCE_BADGE: Record<EvidenceState, BadgeTone> = {
  none: "neutral",
  stale: "warning",
  current: "success",
};

export function scopeLabel(r: Omit<CriterionInput, "status">): string {
  const scope = scopeOf({ ...r, status: "not_assessed" }, DEFAULT_PROCEDURE);
  if (scope.mandatory) return "Muss";
  return scope.should ? "Soll" : "nicht im Verfahren";
}

/** Ein Satz zum Stand in der Hinweiskarte. Gibt nur wieder, was der Stand bedeutet, ohne neue Regeln. */
export const STATUS_EXPLANATION: Record<AssessmentStatus, string> = {
  not_assessed: "Dieses Kriterium ist noch nicht bewertet.",
  met: "Dieses Kriterium ist als erfüllt bewertet.",
  open: "Dieses Kriterium ist als offen bewertet. Die Erfüllung steht noch aus.",
  critical: "Dieses Kriterium ist als kritisch bewertet und braucht Aufmerksamkeit.",
  not_applicable: "Dieses Kriterium ist als nicht anwendbar bewertet.",
};

export const MEASURE_STATUS_BADGE: Record<MeasureStatus, BadgeTone> = {
  open: "neutral",
  in_progress: "primary",
  done: "success",
};
