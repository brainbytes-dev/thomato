import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION, criterion } from "@/db/schema";

const CRITERION_NUMBER = /^\d{1,3}(\.\d{1,3}){0,4}$/;

/** Nur Zahlen mit Punkten in sinnvoller Länge kommen in die Datenbank und in den Cache-Schlüssel. */
export function isWellFormedCriterionNumber(value: string): boolean {
  return CRITERION_NUMBER.test(value);
}

export async function catalogHasNumber(number: string): Promise<boolean> {
  const [row] = await db
    .select({ id: criterion.id })
    .from(criterion)
    .where(and(eq(criterion.standardVersionId, ACTIVE_STANDARD_VERSION), eq(criterion.number, number)))
    .limit(1);
  return row !== undefined;
}

const MEMO_TTL_MS = 5 * 60 * 1000;
const MEMO_MAX = 1000;
const memo = new Map<string, { exists: boolean; until: number }>();

/** Für den Proxy: `use cache` gibt es dort nicht, daher ein kleiner Speicher mit Ablauf und Obergrenze. */
export async function criterionExistsMemoized(raw: string, now: number = Date.now()): Promise<boolean> {
  const number = parseCriterionParam(raw);
  if (number === null) return false;
  const hit = memo.get(number);
  if (hit && hit.until > now) return hit.exists;
  const exists = await catalogHasNumber(number);
  if (memo.size >= MEMO_MAX) memo.clear();
  memo.set(number, { exists, until: now + MEMO_TTL_MS });
  return exists;
}

export function clearCriterionMemo(): void {
  memo.clear();
}

/** Normalisiert den URL-Parameter; null heisst: kann kein Kriterium sein. */
export function parseCriterionParam(raw: string): string | null {
  let number: string;
  try {
    number = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return isWellFormedCriterionNumber(number) ? number : null;
}
