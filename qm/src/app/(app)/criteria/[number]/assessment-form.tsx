"use client";

import { Fragment, startTransition, useActionState } from "react";
import type { AssessmentStatus } from "@/db/schema";
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
      className="flex max-w-xl flex-col gap-4"
    >
      <input type="hidden" name="number" value={props.number} />
      <Fragment key={`${props.status}|${props.reason ?? ""}|${props.dueDate ?? ""}`}>
      <label className="flex flex-col gap-1">
        <span className="text-text-muted">Stand</span>
        <select
          name="status"
          defaultValue={props.status}
          className="h-10 rounded border border-field-border bg-surface px-3"
        >
          {props.statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-text-muted">Begründung (Pflicht bei «Nicht anwendbar», 10 bis 500 Zeichen)</span>
        <textarea
          name="reason"
          rows={3}
          maxLength={500}
          defaultValue={props.reason ?? ""}
          className="rounded border border-field-border bg-surface px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-text-muted">Frist</span>
        <input
          type="date"
          name="dueDate"
          defaultValue={props.dueDate ?? ""}
          className="h-10 rounded border border-field-border bg-surface px-3"
        />
      </label>
      </Fragment>
      <p role="status" className="text-success empty:hidden">{state?.ok ? state.message : ""}</p>
      <p role="alert" className="text-critical empty:hidden">{state && !state.ok ? state.message : ""}</p>
      <button
        type="submit"
        disabled={pending}
        className="type-label h-10 self-start rounded bg-primary px-4 text-on-primary disabled:opacity-60"
      >
        {pending ? "Speichern..." : "Speichern"}
      </button>
    </form>
  );
}
