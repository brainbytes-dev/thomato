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
    const base = `Stand von «${word(b.status)}» zu «${word(a.status)}»`;
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
    if (a.dueDate && b.dueDate) return `Frist von ${formatDate(b.dueDate)} zu ${formatDate(a.dueDate)}`;
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
    return b ? `Nachweis «${b.title}» gelöst` : e.eventType;
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
    return `Massnahme «${a.title}»: Status von «${w(b.status)}» zu «${w(a.status)}»`;
  }
  if (e.eventType === "measure.updated") {
    const b = asMeasure(e.before);
    const a = asMeasure(e.after);
    if (!b || !a) return e.eventType;
    const changes: string[] = [];
    if (b.ownerName !== a.ownerName && b.ownerName !== null && a.ownerName !== null) {
      changes.push(`verantwortlich: ${b.ownerName} zu ${a.ownerName}`);
    }
    if (b.dueDate !== a.dueDate && b.dueDate !== null && a.dueDate !== null) {
      changes.push(`Frist ${formatDate(b.dueDate)} zu ${formatDate(a.dueDate)}`);
    }
    if (b.title !== a.title) changes.unshift(`früherer Titel: «${b.title}»`);
    const head = `Massnahme «${a.title}» geändert`;
    return changes.length > 0 ? `${head} (${changes.join(", ")})` : head;
  }
  return e.eventType;
}
