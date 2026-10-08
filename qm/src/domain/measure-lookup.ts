import { sql } from "drizzle-orm";
import { db } from "@/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TOKEN_LENGTH = 256;
// Better-Auth-Tokens sind alphanumerisch; alles andere ist nie eine echte Sitzung und spart den Datenbankzugriff.
const TOKEN_CHARSET = /^[A-Za-z0-9]+$/;

/**
 * Der Better-Auth-Cookie hat die Form `<token>.<signatur>` (URL-kodiert). Hier wird nur der Token davor gelesen und
 * die Signatur NICHT geprüft: Das Ergebnis darf nur zwischen "404 jetzt" und "normal weiter" entscheiden, nie Zugriff geben.
 */
export function sessionTokenFromCookie(value: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  const dot = decoded.indexOf(".");
  const token = dot === -1 ? decoded : decoded.slice(0, dot);
  return token.length > 0 && token.length <= MAX_TOKEN_LENGTH && TOKEN_CHARSET.test(token) ? token : null;
}

/**
 * Beweist für den Proxy, dass eine Massnahmen-ID in der aktiven Organisation der Sitzung nicht existiert.
 * `true` nur, wenn eine gültige (nicht abgelaufene) Sitzung mit aktiver Mitgliedschaft gefunden wurde UND keine Massnahme
 * mit (id, organization_id) existiert. Fremde und unbekannte IDs sind dadurch nicht unterscheidbar. Alles andere (kein
 * Token, unbekannte oder abgelaufene Sitzung, keine aktive Organisation, keine Mitgliedschaft) heisst `false`: Die Anfrage
 * geht normal weiter und die Seite entscheidet. Datenbankfehler werfen; der Aufrufer behandelt sie als "nicht bewiesen".
 */
export async function measureProvablyMissing(
  cookieValue: string,
  measureId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const token = sessionTokenFromCookie(cookieValue);
  if (token === null || !UUID.test(measureId)) return false;
  // expires_at ist `timestamp` ohne Zeitzone und wird in UTC geschrieben; der ISO-String wird daher ohne Zone gecastet.
  const result = await db.execute<{ missing: boolean }>(sql`
    SELECT NOT EXISTS (
      SELECT 1 FROM measure m WHERE m.id = ${measureId}::uuid AND m.organization_id = s.active_organization_id
    ) AS missing
    FROM session s
    JOIN member mem ON mem.user_id = s.user_id AND mem.organization_id = s.active_organization_id
    WHERE s.token = ${token} AND s.expires_at > ${now.toISOString()}::timestamp
    LIMIT 1`);
  return result.rows[0]?.missing === true;
}
