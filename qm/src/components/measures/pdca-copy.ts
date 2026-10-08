import type { BadgeTone } from "@/components/ui/badge";
import type { MeasurePhase, MeasureStatus, ReviewResult } from "@/db/schema";

export const PHASE_ORDER: readonly MeasurePhase[] = ["plan", "do", "check", "act"];

export const PHASE_NAME: Record<MeasurePhase, string> = { plan: "Plan", do: "Do", check: "Check", act: "Act" };

/** Kurze Erklärung, was in der Phase geschieht. */
export const PHASE_CAPTION: Record<MeasurePhase, string> = {
  plan: "Ziel und Wirksamkeitskriterium festlegen",
  do: "Schritte der Checkliste umsetzen",
  check: "Wirksamkeit prüfen",
  act: "Abschliessen, nachschärfen oder neu starten",
};

export type PhaseState = "done" | "active" | "pending";

export const PHASE_STATE_WORD: Record<PhaseState, string> = {
  done: "Abgeschlossen",
  active: "Aktiv",
  pending: "Ausstehend",
};

/** Eine abgeschlossene Massnahme hat alle vier Phasen durchlaufen; sonst gilt die Reihenfolge ab der aktuellen Phase. */
export function phaseStates(m: { phase: MeasurePhase; status: MeasureStatus }): Record<MeasurePhase, PhaseState> {
  const current = PHASE_ORDER.indexOf(m.phase);
  const out = {} as Record<MeasurePhase, PhaseState>;
  PHASE_ORDER.forEach((p, i) => {
    out[p] = m.status === "done" || i < current ? "done" : i === current ? "active" : "pending";
  });
  return out;
}

export const RESULT_LABEL: Record<ReviewResult, string> = {
  effective: "Wirksam",
  partly: "Teilweise wirksam",
  not_effective: "Nicht wirksam",
};

export const RESULT_BADGE: Record<ReviewResult, BadgeTone> = {
  effective: "success",
  partly: "warning",
  not_effective: "critical",
};

export const RESULT_HINT: Record<ReviewResult, string> = {
  effective: "Das Ziel ist erreicht.",
  partly: "Das Ziel ist teilweise erreicht.",
  not_effective: "Das Ziel ist nicht erreicht.",
};

/** Phase im Register und auf der Karte: Wort, bei erledigten Massnahmen «Abgeschlossen». */
export function phaseWord(m: { phase: MeasurePhase; status: MeasureStatus }): string {
  return m.status === "done" ? "Abgeschlossen" : PHASE_NAME[m.phase];
}
