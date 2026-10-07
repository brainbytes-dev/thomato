import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Pool } from "pg";

const ROLES_SQL = path.resolve(__dirname, "..", "db", "roles.sql");

/**
 * SCRAM-SHA-256-Verifier (RFC 5802 / PostgreSQL-Format), clientseitig berechnet: Das Klartext-Passwort
 * erreicht den Server nie und taucht damit auch nicht in Server-Logs auf.
 * Passwörter werden NFKC-normalisiert (Näherung an SASLprep, für ASCII identisch).
 */
export function scramVerifier(password: string, salt: Buffer = randomBytes(16), iterations = 4096): string {
  const salted = pbkdf2Sync(password.normalize("NFKC"), salt, iterations, 32, "sha256");
  const clientKey = createHmac("sha256", salted).update("Client Key").digest();
  const storedKey = createHash("sha256").update(clientKey).digest();
  const serverKey = createHmac("sha256", salted).update("Server Key").digest();
  return `SCRAM-SHA-256$${iterations}:${salt.toString("base64")}$${storedKey.toString("base64")}:${serverKey.toString("base64")}`;
}

// Neon (Control Plane) lehnt vorberechnete Verifier ab und akzeptiert nur Klartext-Passwörter.
const NEON_PLAINTEXT_ONLY = /only supports being given plaintext passwords/i;

async function setPassword(ownerPool: Pool, secret: string): Promise<void> {
  const quoted = await ownerPool.query<{ stmt: string }>(`SELECT format('ALTER ROLE qm_app PASSWORD %L', $1::text) AS stmt`, [secret]);
  await ownerPool.query(quoted.rows[0].stmt);
}

/**
 * Führt db/roles.sql aus und setzt das Passwort. Standard: nur als Verifier, serverseitig mit format('%L') gequotet,
 * damit das Klartext-Passwort nicht in Server-Logs landet. Auf Neon (nur Klartext erlaubt) gibt es einen Rückfall auf Klartext
 * über die TLS-Verbindung; dort verwaltet der Anbieter das Passwort selbst.
 */
export async function applyRoles(ownerPool: Pool, password: string, sqlText: string = readFileSync(ROLES_SQL, "utf8")): Promise<void> {
  if (password.length === 0) throw new Error("Passwort für qm_app darf nicht leer sein");
  await ownerPool.query(sqlText);
  try {
    await setPassword(ownerPool, scramVerifier(password));
  } catch (error: unknown) {
    if (!(error instanceof Error) || !NEON_PLAINTEXT_ONLY.test(error.message)) throw error;
    await setPassword(ownerPool, password);
  }
}
