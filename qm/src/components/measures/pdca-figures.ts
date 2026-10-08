import type { PdcaFigures } from "@/domain/measure-pdca";

export type FigureView = { label: string; value: string; n: string; text: string };

/** «1 Tag», «21 Tage», «12,5 Tage»: Dezimalkomma, keine überflüssige Null. */
export function formatDays(days: number): string {
  const rounded = Math.round(days * 10) / 10;
  const value = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
  return `${value} ${rounded === 1 ? "Tag" : "Tage"}`;
}

function figure(label: string, value: string, n: number): FigureView {
  return { label, value, n: `n=${n}`, text: `${label}: ${value} (n=${n})` };
}

/** Kennzahlen nur ab n >= 1; sonst null, damit die Oberfläche einen ruhigen Leerzustand zeigt. */
export function describePdcaFigures(f: PdcaFigures): { effective: FigureView | null; duration: FigureView | null } {
  return {
    effective: f.effective.n >= 1 && f.effective.percent !== null ? figure("Wirksam", `${f.effective.percent} %`, f.effective.n) : null,
    duration:
      f.averageDaysToClose.n >= 1 && f.averageDaysToClose.days !== null
        ? figure("Ø Dauer bis Abschluss", formatDays(f.averageDaysToClose.days), f.averageDaysToClose.n)
        : null,
  };
}
