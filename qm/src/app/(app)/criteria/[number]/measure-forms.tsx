"use client";

import {
  createContext,
  Fragment,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  createMeasureAction,
  setMeasureStatusAction,
  updateMeasureAction,
  type MeasureFormState,
} from "./measure-actions";
import { AREA, FIELD, PRIMARY_BTN } from "@/components/ui/styles";

const PRIMARY = PRIMARY_BTN;

export type MemberOption = { userId: string; name: string };
export type StatusOption = { value: string; label: string };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-text-muted">{label}</span>
      {children}
    </label>
  );
}

function Messages({ status, alert }: { status: string; alert: string }) {
  return (
    <>
      <p role="status" className="text-success empty:hidden">{status}</p>
      <p role="alert" className="text-critical empty:hidden">{alert}</p>
    </>
  );
}

const NoticeContext = createContext<(message: string) => void>(() => undefined);

/** Hält die Erfolgsmeldung von Status und Bearbeitung auf Abschnittsebene: die Zeile wird neu gerendert, die Meldung muss bleiben. */
export function MeasureNoticeScope({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  return (
    <NoticeContext.Provider value={setMessage}>
      <p role="status" className="text-success empty:hidden">{message}</p>
      {children}
    </NoticeContext.Provider>
  );
}

function focusHeading() {
  document.getElementById("measures-heading")?.focus();
}

function MemberSelect({ members, defaultValue }: { members: MemberOption[]; defaultValue: string }) {
  return (
    <select name="ownerUserId" required defaultValue={defaultValue} className={FIELD}>
      <option value="" disabled>Bitte auswählen</option>
      {members.map((m) => (
        <option key={m.userId} value={m.userId}>{m.name}</option>
      ))}
    </select>
  );
}

export function CreateMeasureForm({
  number,
  members,
  defaultOwnerId,
}: {
  number: string;
  members: MemberOption[];
  defaultOwnerId: string;
}) {
  const [state, formAction, pending] = useActionState<MeasureFormState, FormData>(createMeasureAction, null);
  const [resetKey, setResetKey] = useState(0);
  const [seen, setSeen] = useState<MeasureFormState>(null);
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) setResetKey((k) => k + 1);
  }
  useEffect(() => {
    if (resetKey > 0) focusHeading();
  }, [resetKey]);
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }
  const owner = members.some((m) => m.userId === defaultOwnerId) ? defaultOwnerId : "";
  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="number" value={number} />
      <Fragment key={resetKey}>
        <Field label="Titel (3 bis 120 Zeichen)">
          <input type="text" name="title" required minLength={3} maxLength={120} className={FIELD} />
        </Field>
        <Field label="Beschreibung (optional, bis 1000 Zeichen)">
          <textarea name="description" maxLength={1000} rows={3} className={AREA} />
        </Field>
        <Field label="Verantwortliche Person">
          <MemberSelect members={members} defaultValue={owner} />
        </Field>
        <Field label="Frist">
          <input type="date" name="dueDate" required className={FIELD} />
        </Field>
      </Fragment>
      <Messages status={state?.ok ? state.message : ""} alert={state && !state.ok ? state.message : ""} />
      <button type="submit" disabled={pending} className={PRIMARY}>
        {pending ? "Anlegen..." : "Massnahme anlegen"}
      </button>
    </form>
  );
}

/** Gemeinsamer Ablauf für Zeilenformulare: Erfolg meldet der Abschnitt, Fehler bleiben am Formular. */
function useRowForm(action: (prev: MeasureFormState, data: FormData) => Promise<MeasureFormState>) {
  const announce = useContext(NoticeContext);
  const [pending, startRow] = useTransition();
  const [error, setError] = useState("");
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setError("");
    startRow(async () => {
      const result = await action(null, data);
      if (result?.ok) {
        announce(result.message);
        form.closest("details")?.removeAttribute("open");
        focusHeading();
      } else {
        announce("");
        setError(result?.message ?? "Die Änderung konnte nicht gespeichert werden.");
      }
    });
  }
  return { onSubmit, pending, error };
}

export function MeasureStatusForm({
  number,
  measureId,
  title,
  status,
  options,
}: {
  number: string;
  measureId: string;
  title: string;
  status: string;
  options: StatusOption[];
}) {
  const f = useRowForm(setMeasureStatusAction);
  return (
    <form onSubmit={f.onSubmit} className="flex flex-col gap-2">
      <input type="hidden" name="number" value={number} />
      <input type="hidden" name="measureId" value={measureId} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-text-muted">Status<span className="sr-only"> von «{title}»</span></span>
          <select name="status" key={status} defaultValue={status} className={FIELD}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={f.pending} className={PRIMARY}>
          {f.pending ? "Speichern..." : "Status setzen"}
          <span className="sr-only"> für «{title}»</span>
        </button>
      </div>
      <p role="alert" className="text-critical empty:hidden">{f.error}</p>
    </form>
  );
}

export function EditMeasureForm({
  number,
  measureId,
  title,
  description,
  ownerUserId,
  dueDate,
  members,
  ownerName,
}: {
  number: string;
  measureId: string;
  title: string;
  description: string | null;
  ownerUserId: string;
  dueDate: string;
  members: MemberOption[];
  ownerName: string | null;
}) {
  const f = useRowForm(updateMeasureAction);
  // Ein ausgetretener Owner bleibt wählbar, damit reine Titeländerungen keinen Personenwechsel erzwingen.
  const isMember = members.some((m) => m.userId === ownerUserId);
  const options = isMember
    ? members
    : [{ userId: ownerUserId, name: `${ownerName ?? "unbekannt"} (nicht mehr Mitglied)` }, ...members];
  const owner = ownerUserId;
  return (
    <form onSubmit={f.onSubmit} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="number" value={number} />
      <input type="hidden" name="measureId" value={measureId} />
      <Field label="Titel (3 bis 120 Zeichen)">
        <input type="text" name="title" required minLength={3} maxLength={120} defaultValue={title} className={FIELD} />
      </Field>
      <Field label="Beschreibung (optional, bis 1000 Zeichen)">
        <textarea name="description" maxLength={1000} rows={3} defaultValue={description ?? ""} className={AREA} />
      </Field>
      <Field label="Verantwortliche Person">
        <MemberSelect members={options} defaultValue={owner} />
      </Field>
      <Field label="Frist">
        <input type="date" name="dueDate" required defaultValue={dueDate} className={FIELD} />
      </Field>
      <p role="alert" className="text-critical empty:hidden">{f.error}</p>
      <button type="submit" disabled={f.pending} className={PRIMARY}>
        {f.pending ? "Speichern..." : "Änderungen speichern"}
      </button>
    </form>
  );
}
