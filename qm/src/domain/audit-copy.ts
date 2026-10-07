import { formatDate } from "./dates";

const STATUS_WORD: Record<string, string> = {
  not_assessed: "Nicht bewertet",
  met: "Erfüllt",
  open: "Offen",
  critical: "Kritisch",
  not_applicable: "Entfällt",
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

const word = (s: string) => STATUS_WORD[s] ?? s;

/** Menschenlesbare Beschreibung eines Audit-Events zu einem Kriterium. Unbekanntes fällt auf den Eventtyp zurück. */
export function describeAuditEvent(e: { eventType: string; before: unknown; after: unknown }): string {
  if (e.eventType === "criterion.status_changed" || e.eventType === "criterion.not_applicable_changed") {
    const b = asStatus(e.before);
    const a = asStatus(e.after);
    if (!b || !a) return e.eventType;
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
  return e.eventType;
}
