"use client";

import { Fragment, startTransition, useActionState } from "react";
import type { AssessmentStatus } from "@/db/schema";
import { AREA, FIELD, PRIMARY_BTN } from "@/components/ui/styles";
import { updateAssessmentAction, type FormState } from "./actions";

export function AssessmentForm(props: {
  number: string;
  status: AssessmentStatus;
  reason: string | null;
  dueDate: string | null;
  statusOptions: { value: AssessmentStatus; label: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateAssessmentAction, null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="number" value={props.number} />
      <Fragment key={`${props.status}|${props.reason ?? ""}|${props.dueDate ?? ""}`}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1">
        <span className="text-text-muted">Stand</span>
        <select name="status" defaultValue={props.status} className={FIELD}>
          {props.statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-text-muted">Frist</span>
        <input type="date" name="dueDate" defaultValue={props.dueDate ?? ""} className={FIELD} />
      </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-text-muted">Begründung (Pflicht bei «nicht anwendbar», 10 bis 500 Zeichen)</span>
        <textarea
          name="reason"
          rows={3}
          maxLength={500}
          defaultValue={props.reason ?? ""}
          className={AREA}
        />
      </label>
      </Fragment>
      <p role="status" className="text-success empty:hidden">{state?.ok ? state.message : ""}</p>
      <p role="alert" className="text-critical empty:hidden">{state && !state.ok ? state.message : ""}</p>
      <button
        type="submit"
        disabled={pending}
        className={PRIMARY_BTN}
      >
        {pending ? "Speichern..." : "Speichern"}
      </button>
    </form>
  );
}
