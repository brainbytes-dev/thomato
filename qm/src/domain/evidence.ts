export type EvidenceState = "none" | "stale" | "current";

/** Eine Version ist aktuell, wenn sie nicht abläuft oder am Ablauftag noch nicht vorbei ist. `today` = YYYY-MM-DD in Zürich. */
export function isCurrent(validUntil: string | null, today: string): boolean {
  return validUntil === null || validUntil >= today;
}

/** Eingabe: Ablaufdaten der NEUESTEN Version jedes verknüpften Dokuments. */
export function evidenceStateOf(latestValidUntils: readonly (string | null)[], today: string): EvidenceState {
  if (latestValidUntils.length === 0) return "none";
  return latestValidUntils.some((v) => isCurrent(v, today)) ? "current" : "stale";
}

export function summarizeEvidence(states: readonly EvidenceState[]): { current: number; stale: number; missing: number } {
  const out = { current: 0, stale: 0, missing: 0 };
  for (const s of states) {
    if (s === "current") out.current += 1;
    else if (s === "stale") out.stale += 1;
    else out.missing += 1;
  }
  return out;
}
