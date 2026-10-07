const ZURICH = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Zurich",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const SOON_DAYS = 30;
export type DeadlineUrgency = "overdue" | "soon" | "upcoming";

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

function dayNumber(iso: string): number {
  const [y, m, d] = parts(iso);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Kalendertag in Zürich als YYYY-MM-DD. */
export function zurichDate(now: Date): string {
  return ZURICH.format(now);
}

export function daysUntil(due: string, now: Date): number {
  return Math.round(dayNumber(due) - dayNumber(zurichDate(now)));
}

export function urgency(days: number): DeadlineUrgency {
  if (days < 0) return "overdue";
  return days <= SOON_DAYS ? "soon" : "upcoming";
}

/** Volle Monate bis zum Datum, nie negativ. */
export function monthsUntil(due: string, now: Date): number {
  const [ty, tm, td] = parts(zurichDate(now));
  const [dy, dm, dd] = parts(due);
  const months = (dy - ty) * 12 + (dm - tm) - (dd < td ? 1 : 0);
  return Math.max(0, months);
}

export function addDays(iso: string, days: number): string {
  return new Date((dayNumber(iso) + days) * 86_400_000).toISOString().slice(0, 10);
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function formatMonths(n: number): string {
  return n === 1 ? "1 Monat" : `${n} Monate`;
}

/** Dativ, z. B. nach "seit" oder "in". */
export function formatDaysDative(n: number): string {
  return n === 1 ? "1 Tag" : `${n} Tagen`;
}

const ZURICH_DATE_TIME = new Intl.DateTimeFormat("de-CH", {
  timeZone: "Europe/Zurich",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** TT.MM.JJJJ, HH:MM in Zürcher Zeit. */
export function formatDateTime(d: Date): string {
  const p = Object.fromEntries(ZURICH_DATE_TIME.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}.${p.month}.${p.year}, ${p.hour}:${p.minute}`;
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
