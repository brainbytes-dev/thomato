import { CircleCheck, ClipboardList, ListChecks, RefreshCw, SearchCheck, type LucideIcon } from "lucide-react";
import type { MeasurePhase, MeasureStatus } from "@/db/schema";
import { PHASE_NAME, phaseWord } from "./pdca-copy";

export const PHASE_ICON: Record<MeasurePhase, LucideIcon> = {
  plan: ClipboardList,
  do: ListChecks,
  check: SearchCheck,
  act: RefreshCw,
};

/** Phase als Wort plus Icon, nie nur Farbe; Zyklusangabe erst ab Zyklus 2. */
export function PhaseLabel({ m }: { m: { phase: MeasurePhase; status: MeasureStatus; cycle: number } }) {
  const Icon = m.status === "done" ? CircleCheck : PHASE_ICON[m.phase];
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="type-label inline-flex items-center gap-2">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
        {phaseWord(m)}
      </span>
      {m.cycle >= 2 && <span className="type-meta text-text-muted">Zyklus {m.cycle}</span>}
    </span>
  );
}

export { PHASE_NAME };
