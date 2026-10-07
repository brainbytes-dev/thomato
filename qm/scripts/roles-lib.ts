import { readFileSync } from "node:fs";
import path from "node:path";
import type { Pool } from "pg";

const ROLES_SQL = path.resolve(__dirname, "..", "db", "roles.sql");

/**
 * Führt db/roles.sql aus und setzt das Passwort. Das Passwort wird serverseitig mit format('%L')
 * gequotet, nie per String-Verkettung in SQL eingebaut und nie ausgegeben.
 */
export async function applyRoles(ownerPool: Pool, password: string): Promise<void> {
  if (password.length === 0) throw new Error("Passwort für qm_app darf nicht leer sein");
  await ownerPool.query(readFileSync(ROLES_SQL, "utf8"));
  const quoted = await ownerPool.query<{ stmt: string }>(
    `SELECT format('ALTER ROLE qm_app PASSWORD %L', $1::text) AS stmt`,
    [password],
  );
  await ownerPool.query(quoted.rows[0].stmt);
}
