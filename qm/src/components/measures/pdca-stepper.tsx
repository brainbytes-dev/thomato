import { Check, Circle, CircleDot } from "lucide-react";
import type { MeasurePhase, MeasureStatus } from "@/db/schema";
import { PHASE_CAPTION, PHASE_NAME, PHASE_ORDER, PHASE_STATE_WORD, phaseStates, type PhaseState } from "./pdca-copy";

const ICON: Record<PhaseState, typeof Check> = { done: Check, active: CircleDot, pending: Circle };

const BOX: Record<PhaseState, string> = {
  done: "border-border bg-surface",
  active: "border-primary bg-primary-subtle",
  pending: "border-border bg-surface-subtle",
};

const STATE_TEXT: Record<PhaseState, string> = {
  done: "text-success",
  active: "text-primary",
  pending: "text-text-muted",
};

/** Vier gleich grosse Felder. Der Zustand steht als Wort und als Icon, die Farbe verstärkt nur. */
export function PdcaStepper({ phase, status }: { phase: MeasurePhase; status: MeasureStatus }) {
  const states = phaseStates({ phase, status });
  return (
    <section aria-labelledby="pdca-heading">
      <h2 id="pdca-heading" tabIndex={-1} className="sr-only">Phasen der Massnahme</h2>
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PHASE_ORDER.map((p, i) => {
          const state = states[p];
          const Icon = ICON[state];
          return (
            <li
              key={p}
              aria-current={state === "active" ? "step" : undefined}
              className={`flex min-w-0 flex-col gap-2 rounded-xl border p-4 ${BOX[state]}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="type-eyebrow text-text-muted">
                  <span className="type-meta-mono">{i + 1}</span> <span className="sr-only">von 4: </span>
                  {PHASE_NAME[p]}
                </span>
                <span className={`type-badge inline-flex items-center gap-2 ${STATE_TEXT[state]}`}>
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  {PHASE_STATE_WORD[state]}
                </span>
              </div>
              <p className="type-meta break-words text-text-muted">{PHASE_CAPTION[p]}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
