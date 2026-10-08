"use client";

import {
  createContext, Fragment, useContext, useState, useTransition, type FormEvent, type ReactNode,
} from "react";
import { ArrowDown, ArrowUp, Check, GitBranch, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import {
  addStepAction, closeMeasureAction, completeDoAction, completePlanAction, moveStepAction, recordEffectivenessAction,
  refineMeasureAction, removeStepAction, renameStepAction, reopenMeasureAction, setCriterionAction, startNewCycleAction,
  toggleStepAction, type PdcaFormState,
} from "@/app/(app)/measures/[id]/pdca-actions";
import { AREA, FIELD, PRIMARY_BTN, SECONDARY_BTN } from "@/components/ui/styles";
import type { ReviewResult } from "@/db/schema";
import { RESULT_HINT, RESULT_LABEL } from "./pdca-copy";

type Action = (prev: PdcaFormState, data: FormData) => Promise<PdcaFormState>;

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const ICON_BTN = `inline-flex size-9 items-center justify-center rounded border border-border bg-surface text-text hover:bg-surface-subtle disabled:opacity-40 ${FOCUS}`;

const NoticeContext = createContext<(message: string) => void>(() => undefined);

/** Hält die Erfolgsmeldung auf Seitenebene: das auslösende Formular verschwindet oft mit dem Phasenwechsel, die Meldung muss bleiben. */
export function PdcaNoticeScope({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  return (
    <NoticeContext.Provider value={setMessage}>
      <p role="status" className="type-label rounded-lg border border-border bg-success-tint px-4 py-3 text-success empty:hidden">
        {message}
      </p>
      {children}
    </NoticeContext.Provider>
  );
}

function focusStepper() {
  document.getElementById("pdca-heading")?.focus();
}

/**
 * Gemeinsamer Ablauf aller Formulare: FormData wird synchron gebildet, die Aktion läuft in einer Transition.
 * Erfolg meldet die Seite, Fehler bleiben am Formular und die Eingaben stehen.
 */
function usePdcaForm(action: Action, opts: { moveFocus?: boolean } = {}) {
  const announce = useContext(NoticeContext);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [resetKey, setResetKey] = useState(0);
  function submit(data: FormData, onFail?: () => void) {
    setError("");
    start(async () => {
      const result = await action(null, data);
      if (result?.ok) {
        announce(result.message);
        setResetKey((k) => k + 1);
        if (opts.moveFocus !== false) focusStepper();
      } else {
        announce("");
        setError(result?.message ?? "Die Änderung konnte nicht gespeichert werden.");
        onFail?.();
      }
    });
  }
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    submit(new FormData(e.currentTarget));
  }
  return { pending, error, resetKey, submit, onSubmit };
}

function Alert({ children }: { children: string }) {
  return <p role="alert" className="type-meta text-critical empty:hidden">{children}</p>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-text-muted">{label}</span>
      {children}
      {hint && <span className="type-meta text-text-muted">{hint}</span>}
    </label>
  );
}

// ---------------------------------------------------------------- Plan

export function CriterionForm({ measureId, value }: { measureId: string; value: string }) {
  const f = usePdcaForm(setCriterionAction);
  return (
    <form onSubmit={f.onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="measureId" value={measureId} />
      <Fragment key={`${f.resetKey}|${value}`}>
        <Field label="Text (3 bis 500 Zeichen)" hint="Woran erkennen Sie später, dass die Massnahme wirkt? Leer lassen, um das Kriterium zu entfernen.">
          <textarea name="effectivenessCriterion" rows={3} maxLength={500} defaultValue={value} className={AREA} />
        </Field>
      </Fragment>
      <Alert>{f.error}</Alert>
      <button type="submit" disabled={f.pending} className={SECONDARY_BTN}>
        {f.pending ? "Speichern..." : "Kriterium speichern"}
      </button>
    </form>
  );
}

/** Aktion ohne weitere Eingabe: nur die Massnahmen-ID. */
function SimpleActionForm({
  measureId, action, label, pendingLabel, variant = "primary", icon, children,
}: {
  measureId: string;
  action: Action;
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary";
  icon?: ReactNode;
  children?: ReactNode;
}) {
  const f = usePdcaForm(action);
  return (
    <form onSubmit={f.onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="measureId" value={measureId} />
      {children}
      <Alert>{f.error}</Alert>
      <button type="submit" disabled={f.pending} className={`${variant === "primary" ? PRIMARY_BTN : SECONDARY_BTN} inline-flex items-center gap-2 whitespace-nowrap ${FOCUS}`}>
        {icon}
        {f.pending ? pendingLabel : label}
      </button>
    </form>
  );
}

export function CompletePlanForm({ measureId }: { measureId: string }) {
  return <SimpleActionForm measureId={measureId} action={completePlanAction} label="Plan abschliessen" pendingLabel="Speichern..." />;
}

export function RefineForm({ measureId }: { measureId: string }) {
  return <SimpleActionForm measureId={measureId} action={refineMeasureAction} label="Nachschärfen" pendingLabel="Speichern..." variant="secondary" icon={<RotateCcw aria-hidden="true" className="size-4" />} />;
}

export function NewCycleForm({ measureId }: { measureId: string }) {
  return <SimpleActionForm measureId={measureId} action={startNewCycleAction} label="Neuen Zyklus starten" pendingLabel="Speichern..." variant="secondary" icon={<GitBranch aria-hidden="true" className="size-4" />} />;
}

export function ReopenForm({ measureId }: { measureId: string }) {
  return <SimpleActionForm measureId={measureId} action={reopenMeasureAction} label="Wiedereröffnen" pendingLabel="Speichern..." variant="secondary" icon={<RotateCcw aria-hidden="true" className="size-4" />} />;
}

// ---------------------------------------------------------------- Do

export type StepItem = { id: string; position: number; title: string; done: boolean; doneText: string | null };

function StepRow({ measureId, step, first, last }: { measureId: string; step: StepItem; first: boolean; last: boolean }) {
  const toggle = usePdcaForm(toggleStepAction, { moveFocus: false });
  const move = usePdcaForm(moveStepAction, { moveFocus: false });
  const remove = usePdcaForm(removeStepAction, { moveFocus: false });
  const rename = usePdcaForm(renameStepAction, { moveFocus: false });
  const [editing, setEditing] = useState(false);
  const busy = toggle.pending || move.pending || remove.pending || rename.pending;
  const error = toggle.error || move.error || remove.error || rename.error;
  const [prevKey, setPrevKey] = useState(rename.resetKey);
  if (rename.resetKey !== prevKey) {
    setPrevKey(rename.resetKey);
    setEditing(false);
  }

  function send(extra: Record<string, string>): FormData {
    const data = new FormData();
    data.set("measureId", measureId);
    data.set("stepId", step.id);
    for (const [k, v] of Object.entries(extra)) data.set(k, v);
    return data;
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-surface-subtle p-3">
      <div className="flex flex-wrap items-start gap-3">
        <input
          key={`${step.id}|${step.done}|${toggle.resetKey}`}
          type="checkbox"
          defaultChecked={step.done}
          disabled={busy}
          aria-label={`Erledigt: ${step.title}`}
          onChange={(e) => {
            const input = e.currentTarget;
            toggle.submit(send({ done: String(input.checked) }), () => {
              input.checked = !input.checked;
            });
          }}
          className={`mt-0.5 size-5 shrink-0 accent-primary ${FOCUS}`}
        />
        <div className="min-w-0 flex-1">
          <p className={`type-body break-words ${step.done ? "text-text-muted line-through" : ""}`}>
            <span className="type-meta-mono text-text-muted">{step.position}. </span>
            {step.title}
          </p>
          {step.doneText && <p className="type-meta text-text-muted">{step.doneText}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" disabled={busy || first} onClick={() => move.submit(send({ direction: "up" }))} className={ICON_BTN} aria-label={`Nach oben: ${step.title}`}>
            <ArrowUp aria-hidden="true" className="size-4" />
          </button>
          <button type="button" disabled={busy || last} onClick={() => move.submit(send({ direction: "down" }))} className={ICON_BTN} aria-label={`Nach unten: ${step.title}`}>
            <ArrowDown aria-hidden="true" className="size-4" />
          </button>
          <button type="button" disabled={busy} onClick={() => setEditing((v) => !v)} aria-expanded={editing} className={ICON_BTN} aria-label={`Umbenennen: ${step.title}`}>
            {editing ? <X aria-hidden="true" className="size-4" /> : <Pencil aria-hidden="true" className="size-4" />}
          </button>
          <button type="button" disabled={busy} onClick={() => remove.submit(send({}))} className={ICON_BTN} aria-label={`Entfernen: ${step.title}`}>
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
      {editing && (
        <form onSubmit={rename.onSubmit} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="measureId" value={measureId} />
          <input type="hidden" name="stepId" value={step.id} />
          <Field label="Neuer Titel">
            <input type="text" name="title" required minLength={3} maxLength={200} defaultValue={step.title} className={`${FIELD} min-w-0 sm:w-80`} />
          </Field>
          <button type="submit" disabled={rename.pending} className={SECONDARY_BTN}>{rename.pending ? "Speichern..." : "Titel speichern"}</button>
        </form>
      )}
      <Alert>{error}</Alert>
    </li>
  );
}

export function EditableChecklist({ measureId, steps }: { measureId: string; steps: StepItem[] }) {
  if (steps.length === 0) return null;
  return (
    <ul aria-label="Checkliste" className="flex flex-col gap-2">
      {steps.map((s, i) => (
        <StepRow key={s.id} measureId={measureId} step={s} first={i === 0} last={i === steps.length - 1} />
      ))}
    </ul>
  );
}

export function AddStepForm({ measureId }: { measureId: string }) {
  const f = usePdcaForm(addStepAction, { moveFocus: false });
  return (
    <form onSubmit={f.onSubmit} className="flex flex-col gap-2">
      <input type="hidden" name="measureId" value={measureId} />
      <div className="flex flex-wrap items-end gap-3">
        <Fragment key={f.resetKey}>
          <Field label="Neuer Schritt (3 bis 200 Zeichen)">
            <input type="text" name="title" required minLength={3} maxLength={200} className={`${FIELD} min-w-0 sm:w-96`} />
          </Field>
        </Fragment>
        <button type="submit" disabled={f.pending} className={SECONDARY_BTN}>{f.pending ? "Hinzufügen..." : "Schritt hinzufügen"}</button>
      </div>
      <Alert>{f.error}</Alert>
    </form>
  );
}

export function CompleteDoForm({ measureId, stepCount, openCount }: { measureId: string; stepCount: number; openCount: number }) {
  return (
    <SimpleActionForm measureId={measureId} action={completeDoAction} label="Do abschliessen" pendingLabel="Speichern...">
      {stepCount === 0 ? (
        <label className="flex items-start gap-2">
          <input type="checkbox" name="confirmNoSteps" className={`mt-0.5 size-5 shrink-0 accent-primary ${FOCUS}`} />
          <span className="type-meta text-text-muted">Es gibt keine Schritte. Ich bestätige, dass die Massnahme ohne Checkliste umgesetzt wurde.</span>
        </label>
      ) : openCount > 0 ? (
        <p className="type-meta text-text-muted">
          {openCount === 1 ? "Ein Schritt ist" : `${openCount} Schritte sind`} noch offen.
        </p>
      ) : null}
    </SimpleActionForm>
  );
}

// ---------------------------------------------------------------- Check

const RESULTS: ReviewResult[] = ["effective", "partly", "not_effective"];

export function ReviewForm({ measureId, criterion }: { measureId: string; criterion: string | null }) {
  const f = usePdcaForm(recordEffectivenessAction);
  return (
    <form onSubmit={f.onSubmit} className="flex flex-col gap-4 rounded-lg border border-border bg-surface-subtle p-4">
      <input type="hidden" name="measureId" value={measureId} />
      <h3 className="type-body-emphasis">Wirksamkeit bewerten</h3>
      <p className="type-meta text-text-muted">
        {criterion ? `Kriterium: ${criterion}` : "Für diese Massnahme wurde kein Wirksamkeitskriterium festgehalten."}
        {" "}Die Bewertung wird festgehalten und kann nicht mehr geändert werden. Danach folgt die Entscheidung in Act.
      </p>
      <Fragment key={f.resetKey}>
        <fieldset className="flex flex-col gap-2">
          <legend className="type-label mb-1">Ergebnis</legend>
          {RESULTS.map((r) => (
            <label key={r} className="flex items-start gap-2">
              <input type="radio" name="result" value={r} required className={`mt-0.5 size-5 shrink-0 accent-primary ${FOCUS}`} />
              <span>
                <span className="type-label">{RESULT_LABEL[r]}</span>
                <span className="type-meta block text-text-muted">{RESULT_HINT[r]}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Field label="Notiz (3 bis 1000 Zeichen)">
          <textarea name="note" rows={3} required minLength={3} maxLength={1000} className={AREA} />
        </Field>
      </Fragment>
      <Alert>{f.error}</Alert>
      <button type="submit" disabled={f.pending} className={PRIMARY_BTN}>{f.pending ? "Speichern..." : "Bewertung festhalten"}</button>
    </form>
  );
}

// ---------------------------------------------------------------- Act

export function CloseForm({ measureId, reasonRequired }: { measureId: string; reasonRequired: boolean }) {
  const f = usePdcaForm(closeMeasureAction);
  return (
    <form onSubmit={f.onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="measureId" value={measureId} />
      <Fragment key={f.resetKey}>
        <Field
          label={reasonRequired ? "Begründung (Pflicht, 10 bis 1000 Zeichen)" : "Begründung (optional, bis 1000 Zeichen)"}
          hint={reasonRequired ? "Die letzte Bewertung lautet nicht «wirksam». Halten Sie fest, warum die Massnahme trotzdem abgeschlossen wird." : undefined}
        >
          <textarea name="reason" rows={3} maxLength={1000} required={reasonRequired} minLength={reasonRequired ? 10 : undefined} className={AREA} />
        </Field>
      </Fragment>
      <Alert>{f.error}</Alert>
      <button type="submit" disabled={f.pending} className={`${PRIMARY_BTN} inline-flex items-center gap-2 whitespace-nowrap ${FOCUS}`}>
        <Check aria-hidden="true" className="size-4" />
        {f.pending ? "Speichern..." : "Massnahme abschliessen"}
      </button>
    </form>
  );
}
