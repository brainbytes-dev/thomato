import { formatDate } from "./dates";

const STATUS_WORD: Record<string, string> = {
  not_assessed: "Nicht bewertet",
  met: "Erfüllt",
  open: "Offen",
  critical: "Kritisch",
  not_applicable: "Nicht anwendbar",
};

type StatusPayload = { status: string; reason: string | null };
type DuePayload = { dueDate: string | null };

function asStatus(v: unknown): StatusPayload | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.status !== "string") return null;
  return { status: o.status, reason: typeof o.reason === "string" ? o.reason : null };
}

function asDue(v: unknown): DuePayload | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (!("dueDate" in o)) return null;
  return { dueDate: typeof o.dueDate === "string" ? o.dueDate : null };
}

type DocPayload = { title: string | null; versionNumber: number | null; fileName: string | null; validUntil: string | null };

function asDoc(v: unknown): DocPayload | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.title !== "string") return null;
  return {
    title: o.title,
    versionNumber: typeof o.versionNumber === "number" ? o.versionNumber : null,
    fileName: typeof o.fileName === "string" ? o.fileName : null,
    validUntil: typeof o.validUntil === "string" ? o.validUntil : null,
  };
}

const MEASURE_STATUS_WORD: Record<string, string> = { open: "Offen", in_progress: "In Bearbeitung", done: "Erledigt" };

type MeasurePayload = { title: string; ownerName: string | null; dueDate: string | null; status: string | null };

function asMeasure(v: unknown): MeasurePayload | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.title !== "string") return null;
  return {
    title: o.title,
    ownerName: typeof o.ownerName === "string" ? o.ownerName : null,
    dueDate: typeof o.dueDate === "string" ? o.dueDate : null,
    status: typeof o.status === "string" ? o.status : null,
  };
}

const PHASE_WORD: Record<string, string> = { plan: "Plan", do: "Do", check: "Check", act: "Act" };
const RESULT_WORD: Record<string, string> = { effective: "wirksam", partly: "teilweise wirksam", not_effective: "nicht wirksam" };

type PdcaPayload = {
  title: string;
  phase: string | null;
  cycle: number | null;
  result: string | null;
  previousResult: string | null;
  reason: string | null;
  note: string | null;
  confirmedNoSteps: boolean;
  stepTitle: string | null;
  position: number | null;
  change: string | null;
  criterion: string | null | undefined;
};

function asPdca(v: unknown): PdcaPayload | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.title !== "string") return null;
  const str = (x: unknown) => (typeof x === "string" ? x : null);
  return {
    title: o.title,
    phase: str(o.phase),
    cycle: typeof o.cycle === "number" ? o.cycle : null,
    result: str(o.result),
    previousResult: str(o.previousResult),
    reason: str(o.reason),
    note: str(o.note),
    confirmedNoSteps: o.confirmedNoSteps === true,
    stepTitle: str(o.stepTitle),
    position: typeof o.position === "number" ? o.position : null,
    change: str(o.change),
    // undefined = Schlüssel fehlt (altes measure.updated), null = kein Kriterium gesetzt
    criterion: "effectivenessCriterion" in o ? str(o.effectivenessCriterion) : undefined,
  };
}

const phaseWord = (p: string) => PHASE_WORD[p] ?? p;
const resultWord = (r: string) => RESULT_WORD[r] ?? r;
const lastResult = (r: string | null) => (r === null ? "" : `, letzte Bewertung «${resultWord(r)}»`);

/** Beschreibung der PDCA-Ereignisse (Phase, Checkliste, Bewertung, Act). null, wenn der Typ nicht dazugehört oder die Nutzlast unlesbar ist. */
function describePdca(e: { eventType: string; before: unknown; after: unknown }): string | null | undefined {
  const b = asPdca(e.before);
  const a = asPdca(e.after);
  switch (e.eventType) {
    case "measure.phase_changed": {
      if (!b || !a || b.phase === null || a.phase === null) return null;
      const extra = a.confirmedNoSteps ? " (ohne Checkliste bestätigt)" : "";
      return `Massnahme «${a.title}»: Phase von «${phaseWord(b.phase)}» auf «${phaseWord(a.phase)}»${extra}`;
    }
    case "measure.step_added":
      return a && a.stepTitle !== null ? `Schritt «${a.stepTitle}» zur Checkliste hinzugefügt (Massnahme «${a.title}»)` : null;
    case "measure.step_removed":
      return b && b.stepTitle !== null ? `Schritt «${b.stepTitle}» aus der Checkliste entfernt (Massnahme «${b.title}»)` : null;
    case "measure.step_updated": {
      if (!b || !a || a.stepTitle === null || b.stepTitle === null) return null;
      const tail = ` (Massnahme «${a.title}»)`;
      if (a.change === "renamed") return `Schritt «${b.stepTitle}» umbenannt in «${a.stepTitle}»${tail}`;
      if (a.change === "done") return `Schritt «${a.stepTitle}» erledigt${tail}`;
      if (a.change === "undone") return `Schritt «${a.stepTitle}» wieder geöffnet${tail}`;
      if (a.change === "moved" && a.position !== null && b.position !== null) {
        return `Schritt «${a.stepTitle}» von Position ${b.position} auf ${a.position} verschoben${tail}`;
      }
      return `Schritt «${a.stepTitle}» geändert${tail}`;
    }
    case "measure.effectiveness_recorded": {
      if (!a || a.result === null || a.cycle === null) return null;
      return `Wirksamkeit von «${a.title}» bewertet (Zyklus ${a.cycle}): «${resultWord(a.result)}»${a.note ? `, Notiz: ${a.note}` : ""}`;
    }
    case "measure.refined": {
      if (!a || a.cycle === null) return null;
      return `Massnahme «${a.title}» nachgeschärft (zurück in Phase «Do», Zyklus ${a.cycle}${lastResult(a.previousResult)})`;
    }
    case "measure.cycle_started": {
      if (!a || a.cycle === null) return null;
      return `Neuer Zyklus ${a.cycle} für Massnahme «${a.title}» gestartet (Phase «Plan»${lastResult(a.previousResult)})`;
    }
    case "measure.closed": {
      if (!a) return null;
      return `Massnahme «${a.title}» abgeschlossen${a.result === null ? "" : ` (letzte Bewertung «${resultWord(a.result)}»)`}${a.reason ? `, Begründung: ${a.reason}` : ""}`;
    }
    case "measure.reopened":
      return a ? `Massnahme «${a.title}» wiedereröffnet (Phase «Do»)` : null;
    default:
      return undefined;
  }
}

const word = (s: string) => STATUS_WORD[s] ?? s;

/** Menschenlesbare Beschreibung eines Audit-Events zu einem Kriterium. Unbekanntes fällt auf den Eventtyp zurück. */
export function describeAuditEvent(e: { eventType: string; before: unknown; after: unknown }): string {
  if (e.eventType === "criterion.status_changed" || e.eventType === "criterion.not_applicable_changed") {
    const b = asStatus(e.before);
    const a = asStatus(e.after);
    if (!b || !a) return e.eventType;
    if (b.status === "not_applicable" && a.status === "not_applicable" && b.reason !== a.reason) {
      return `Begründung geändert von «${b.reason ?? ""}» zu «${a.reason ?? ""}»`;
    }
    const base = `Stand von «${word(b.status)}» auf «${word(a.status)}»`;
    if (a.status === "not_applicable" && a.reason) return `${base}, Begründung: ${a.reason}`;
    if (b.status === "not_applicable" && b.reason) return `${base}, frühere Begründung: ${b.reason}`;
    return base;
  }
  if (e.eventType === "criterion.due_date_changed") {
    const b = asDue(e.before);
    const a = asDue(e.after);
    if (!b || !a) return e.eventType;
    if (a.dueDate && !b.dueDate) return `Frist gesetzt: ${formatDate(a.dueDate)}`;
    if (!a.dueDate && b.dueDate) return `Frist entfernt (war ${formatDate(b.dueDate)})`;
    if (a.dueDate && b.dueDate) return `Frist von ${formatDate(b.dueDate)} auf ${formatDate(a.dueDate)}`;
  }
  if (e.eventType === "document.created") {
    const a = asDoc(e.after);
    if (!a || a.versionNumber === null || a.fileName === null) return e.eventType;
    return `Dokument «${a.title}» angelegt (Version ${a.versionNumber}, ${a.fileName})`;
  }
  if (e.eventType === "document.version_added") {
    const a = asDoc(e.after);
    if (!a || a.versionNumber === null || a.fileName === null) return e.eventType;
    const until = a.validUntil ? `gültig bis ${formatDate(a.validUntil)}` : "ohne Ablaufdatum";
    return `Neue Version ${a.versionNumber} von «${a.title}» (${a.fileName}), ${until}`;
  }
  if (e.eventType === "evidence.linked") {
    const a = asDoc(e.after);
    return a ? `Nachweis «${a.title}» verknüpft` : e.eventType;
  }
  if (e.eventType === "evidence.unlinked") {
    const b = asDoc(e.before);
    return b ? `Verknüpfung mit «${b.title}» gelöst` : e.eventType;
  }
  if (e.eventType === "measure.created") {
    const a = asMeasure(e.after);
    if (!a || a.ownerName === null || a.dueDate === null) return e.eventType;
    return `Massnahme «${a.title}» angelegt (verantwortlich: ${a.ownerName}, Frist ${formatDate(a.dueDate)})`;
  }
  if (e.eventType === "measure.status_changed") {
    const b = asMeasure(e.before);
    const a = asMeasure(e.after);
    if (!b || !a || b.status === null || a.status === null) return e.eventType;
    const w = (s: string) => MEASURE_STATUS_WORD[s] ?? s;
    return `Massnahme «${a.title}»: Status von «${w(b.status)}» auf «${w(a.status)}»`;
  }
  const pdca = describePdca(e);
  if (pdca !== undefined) return pdca ?? e.eventType;
  if (e.eventType === "measure.updated") {
    const pa = asPdca(e.after);
    const pb = asPdca(e.before);
    if (pa && pb && pa.criterion !== undefined && pb.criterion !== undefined) {
      if (pa.criterion === null && pb.criterion !== null) return `Wirksamkeitskriterium von «${pa.title}» entfernt (war «${pb.criterion}»)`;
      if (pa.criterion !== null && pb.criterion === null) return `Wirksamkeitskriterium von «${pa.title}» festgelegt: ${pa.criterion}`;
      if (pa.criterion !== null && pb.criterion !== null) return `Wirksamkeitskriterium von «${pa.title}» geändert: von «${pb.criterion}» auf «${pa.criterion}»`;
    }
    const b = asMeasure(e.before);
    const a = asMeasure(e.after);
    if (!b || !a) return e.eventType;
    const changes: string[] = [];
    if (b.ownerName !== a.ownerName && b.ownerName !== null && a.ownerName !== null) {
      changes.push(`verantwortlich: von ${b.ownerName} zu ${a.ownerName}`);
    }
    if (b.dueDate !== a.dueDate && b.dueDate !== null && a.dueDate !== null) {
      changes.push(`Frist von ${formatDate(b.dueDate)} auf ${formatDate(a.dueDate)}`);
    }
    if (b.title !== a.title) changes.unshift(`früherer Titel: «${b.title}»`);
    const head = `Massnahme «${a.title}» geändert`;
    return changes.length > 0 ? `${head} (${changes.join(", ")})` : head;
  }
  return e.eventType;
}
