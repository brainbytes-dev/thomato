"use client";

import {
  createContext,
  Fragment,
  startTransition,
  useActionState,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { checkClientFile } from "@/components/criteria/file-check";
import { guardAction } from "@/components/criteria/guard-action";
import {
  addVersionAction,
  linkEvidenceAction,
  unlinkEvidenceAction,
  uploadDocumentAction,
  type EvidenceFormState,
} from "./evidence-actions";
import { FIELD, PRIMARY_BTN, SECONDARY_BTN } from "@/components/ui/styles";

const PRIMARY = PRIMARY_BTN;
const SECONDARY = SECONDARY_BTN;

type Action = (prev: EvidenceFormState, formData: FormData) => Promise<EvidenceFormState>;

/** Gemeinsamer Ablauf: Datei vorab prüfen, FormData synchron bilden, Felder nach Erfolg neu einhängen. */
function useEvidenceForm(action: Action, maxBytes: number | null) {
  const [guarded] = useState(() =>
    guardAction(
      action,
      maxBytes === null
        ? "Die Änderung konnte nicht gespeichert werden. Bitte versuchen Sie es noch einmal."
        : `Die Datei konnte nicht übertragen werden (höchstens ${maxBytes / (1024 * 1024)} MB). Bitte prüfen Sie die Verbindung und versuchen Sie es noch einmal. Besteht das Problem weiter, melden Sie es Ihrer QM-Verantwortlichen.`,
    ),
  );
  const [state, formAction, pending] = useActionState<EvidenceFormState, FormData>(guarded, null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [seen, setSeen] = useState<EvidenceFormState>(null);
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) setResetKey((k) => k + 1);
  }
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    if (maxBytes !== null) {
      const file = data.get("file");
      const problem = file instanceof File ? checkClientFile(file.size, maxBytes) : "Bitte wählen Sie eine Datei aus.";
      if (problem) {
        setLocalError(problem);
        return;
      }
    }
    setLocalError(null);
    startTransition(() => formAction(data));
  }
  const status = !localError && state?.ok ? state.message : "";
  const alert = localError ?? (state && !state.ok ? state.message : "");
  const clearLocalError = () => setLocalError(null);
  return { onSubmit, pending, resetKey, status, alert, clearLocalError };
}

function Messages({ status, alert }: { status: string; alert: string }) {
  return (
    <>
      <p role="status" className="text-success empty:hidden">{status}</p>
      <p role="alert" className="text-critical empty:hidden">{alert}</p>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-text-muted">{label}</span>
      {children}
    </label>
  );
}

const FILE_HINT = "PDF, PNG, JPG, DOCX oder XLSX";

export function UploadDocumentForm({ number, maxBytes }: { number: string; maxBytes: number }) {
  const f = useEvidenceForm(uploadDocumentAction, maxBytes);
  return (
    <form onSubmit={f.onSubmit} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="number" value={number} />
      <Fragment key={f.resetKey}>
        <Field label="Titel (3 bis 120 Zeichen)">
          <input type="text" name="title" required minLength={3} maxLength={120} className={FIELD} />
        </Field>
        <Field label={`Datei (${FILE_HINT}, bis ${maxBytes / (1024 * 1024)} MB)`}>
          <input
            type="file"
            name="file"
            required
            onChange={f.clearLocalError}
            className={`${FIELD} py-2`}
          />
        </Field>
        <Field label="Gültig bis (leer lassen, wenn der Nachweis nicht abläuft)">
          <input type="date" name="validUntil" className={FIELD} />
        </Field>
      </Fragment>
      <Messages status={f.status} alert={f.alert} />
      <button type="submit" disabled={f.pending} className={PRIMARY}>
        {f.pending ? "Hochladen..." : "Dokument hochladen"}
      </button>
    </form>
  );
}

export function AddVersionForm({ number, documentId, maxBytes }: { number: string; documentId: string; maxBytes: number }) {
  const f = useEvidenceForm(addVersionAction, maxBytes);
  return (
    <form onSubmit={f.onSubmit} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="number" value={number} />
      <input type="hidden" name="documentId" value={documentId} />
      <Fragment key={f.resetKey}>
        <Field label={`Datei (${FILE_HINT}, bis ${maxBytes / (1024 * 1024)} MB)`}>
          <input
            type="file"
            name="file"
            required
            onChange={f.clearLocalError}
            className={`${FIELD} py-2`}
          />
        </Field>
        <Field label="Gültig bis (leer lassen, wenn der Nachweis nicht abläuft)">
          <input type="date" name="validUntil" className={FIELD} />
        </Field>
      </Fragment>
      <Messages status={f.status} alert={f.alert} />
      <button type="submit" disabled={f.pending} className={PRIMARY}>
        {f.pending ? "Hochladen..." : "Neue Version hochladen"}
      </button>
    </form>
  );
}

export function LinkDocumentForm({
  number,
  options,
}: {
  number: string;
  options: { documentId: string; title: string }[];
}) {
  const f = useEvidenceForm(linkEvidenceAction, null);
  return (
    <form onSubmit={f.onSubmit} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="number" value={number} />
      <Fragment key={f.resetKey}>
        <Field label="Dokument">
          <select name="documentId" required defaultValue="" className={FIELD}>
            <option value="" disabled>Bitte auswählen</option>
            {options.map((o) => (
              <option key={o.documentId} value={o.documentId}>{o.title}</option>
            ))}
          </select>
        </Field>
      </Fragment>
      <Messages status={f.status} alert={f.alert} />
      <button type="submit" disabled={f.pending} className={PRIMARY}>
        {f.pending ? "Verknüpfen..." : "Dokument verknüpfen"}
      </button>
    </form>
  );
}

const UnlinkNoticeContext = createContext<(message: string) => void>(() => undefined);

/** Hält die Erfolgsmeldung des Lösens auf Abschnittsebene: die Zeile verschwindet, die Meldung muss bleiben. */
export function UnlinkNoticeScope({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  return (
    <UnlinkNoticeContext.Provider value={setMessage}>
      <p role="status" className="text-success empty:hidden">{message}</p>
      {children}
    </UnlinkNoticeContext.Provider>
  );
}

export function UnlinkForm({ number, linkId, title }: { number: string; linkId: string; title: string }) {
  const announce = useContext(UnlinkNoticeContext);
  const [pending, startUnlink] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError("");
    startUnlink(async () => {
      const result = await unlinkEvidenceAction(null, data);
      if (result?.ok) {
        announce(result.message);
        document.getElementById("evidence-heading")?.focus();
      } else {
        setError(result?.message ?? "Die Verknüpfung konnte nicht gelöst werden.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="number" value={number} />
      <input type="hidden" name="linkId" value={linkId} />
      {confirming ? (
        <div className="flex flex-col gap-3">
          <p>
            Verknüpfung von «{title}» mit diesem Kriterium lösen? Das Dokument und seine Versionen bleiben erhalten.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={pending} className={PRIMARY}>
              {pending ? "Lösen..." : "Ja, Verknüpfung lösen"}
            </button>
            <button type="button" disabled={pending} onClick={() => setConfirming(false)} className={SECONDARY}>
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={SECONDARY}>
          Verknüpfung lösen
        </button>
      )}
      <p role="alert" className="text-critical empty:hidden">{error}</p>
    </form>
  );
}
