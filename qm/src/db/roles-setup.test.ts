import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { scramVerifier } from "../../scripts/roles-lib";

// roles.sql läuft hier unter einem NICHT-Superuser mit CREATEROLE (wie neondb_owner auf Neon),
// in einer Wegwerf-Datenbank und mit umbenannter Rolle (qm_probe_app), damit qm_app/qm_test unberührt bleiben.
const ownerUrl = process.env.TEST_DATABASE_URL;
if (!ownerUrl) throw new Error("TEST_DATABASE_URL fehlt");

const PROBE_DB = "qm_roles_probe";
const PROBE_OWNER = "qm_probe_owner";
const PROBE_APP = "qm_probe_app";
const PROBE_PASSWORD = "probe-owner-pw";
const rolesSql = readFileSync(path.resolve(__dirname, "..", "..", "db", "roles.sql"), "utf8").replaceAll("qm_app", PROBE_APP);

function urlFor(db: string, user?: string, password?: string): string {
  const u = new URL(ownerUrl as string);
  u.pathname = `/${db}`;
  if (user) u.username = user;
  if (password) u.password = password;
  return u.toString();
}

let admin: Pool; // Superuser des Docker-Clusters, nur für Aufbau und Abbau
let adminProbe: Pool; // Superuser, verbunden mit der Probe-DB (Prüfungen, Abbau)
let probe: Pool; // Verbindung als PROBE_OWNER (CREATEROLE, kein Superuser)

async function errorOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("erwartete Ablehnung blieb aus");
}

async function resetProbeApp() {
  const exists = await admin.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [PROBE_APP]);
  if (exists.rows.length === 0) return;
  await adminProbe.query(`DROP OWNED BY ${PROBE_APP}`);
  await admin.query(`DROP ROLE ${PROBE_APP}`);
}

beforeAll(async () => {
  admin = new Pool({ connectionString: urlFor("postgres"), max: 1 });
  await admin.query(`DROP DATABASE IF EXISTS ${PROBE_DB} WITH (FORCE)`);
  await admin.query(`DROP ROLE IF EXISTS ${PROBE_APP}`);
  await admin.query(`DROP ROLE IF EXISTS ${PROBE_OWNER}`);
  await admin.query(`CREATE ROLE ${PROBE_OWNER} LOGIN CREATEROLE NOSUPERUSER PASSWORD '${PROBE_PASSWORD}'`);
  await admin.query(`CREATE DATABASE ${PROBE_DB} OWNER ${PROBE_OWNER}`);
  adminProbe = new Pool({ connectionString: urlFor(PROBE_DB), max: 1 });
  probe = new Pool({ connectionString: urlFor(PROBE_DB, PROBE_OWNER, PROBE_PASSWORD), max: 1 });
  await probe.query(`CREATE TABLE audit_event (id int)`);
  await probe.query(`CREATE TABLE document_version (id int)`);
  await probe.query(`CREATE TABLE measure (id int)`);
});

afterAll(async () => {
  await probe.end();
  await adminProbe.end();
  await admin.query(`DROP DATABASE IF EXISTS ${PROBE_DB} WITH (FORCE)`);
  await admin.query(`DROP ROLE IF EXISTS ${PROBE_APP}`);
  await admin.query(`DROP ROLE IF EXISTS ${PROBE_OWNER}`);
  await admin.end();
});

describe("roles.sql without superuser", () => {
  it("runs as a CREATEROLE non-superuser, creates the role and is idempotent", async () => {
    const me = await probe.query<{ rolsuper: boolean }>(`SELECT rolsuper FROM pg_roles WHERE rolname = current_user`);
    expect(me.rows[0].rolsuper).toBe(false);
    await resetProbeApp();
    await probe.query(rolesSql);
    await probe.query(rolesSql);
    const r = await admin.query(
      `SELECT rolsuper, rolbypassrls, rolreplication, rolcreatedb, rolcreaterole, rolcanlogin, rolconnlimit FROM pg_roles WHERE rolname = $1`,
      [PROBE_APP],
    );
    expect(r.rows[0]).toEqual({
      rolsuper: false, rolbypassrls: false, rolreplication: false, rolcreatedb: false, rolcreaterole: false,
      rolcanlogin: true, rolconnlimit: 20,
    });
    // Ausnahmen wurden erzwungen
    const priv = await adminProbe.query<{ p: string }>(
      `SELECT string_agg(t, ',' ORDER BY t) AS p FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) AS t
       WHERE has_table_privilege($1, 'audit_event', t)`,
      [PROBE_APP],
    );
    expect(priv.rows[0].p).toBe("INSERT,SELECT");
  });

  it("aborts when a pre-existing qm_app is over-powerful, and changes nothing", async () => {
    await resetProbeApp();
    await admin.query(`CREATE ROLE ${PROBE_APP} LOGIN SUPERUSER`);
    const message = await errorOf(adminProbe.query(rolesSql));
    expect(message).toMatch(/unzulässige Attribute/);
    const grants = await adminProbe.query<{ ok: boolean }>(`SELECT coalesce(relacl::text, '') LIKE '%' || $1 || '%' AS ok FROM pg_class WHERE relname = 'audit_event'`, [PROBE_APP]);
    expect(grants.rows[0].ok).toBe(false);
    for (const attr of ["CREATEDB", "CREATEROLE", "REPLICATION", "BYPASSRLS"]) {
      await admin.query(`ALTER ROLE ${PROBE_APP} NOSUPERUSER`);
      await admin.query(`ALTER ROLE ${PROBE_APP} ${attr}`);
      expect(await errorOf(adminProbe.query(rolesSql)), attr).toMatch(/unzulässige Attribute/);
      await admin.query(`ALTER ROLE ${PROBE_APP} NO${attr}`);
    }
  });
});

describe("SCRAM verifier", () => {
  it("authenticates with the plaintext password and rejects a wrong one", async () => {
    await resetProbeApp();
    await probe.query(rolesSql);
    const password = "geheim-Pässwörd 123";
    const verifier = scramVerifier(password);
    expect(verifier).toMatch(/^SCRAM-SHA-256\$4096:[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    const stmt = await probe.query<{ s: string }>(`SELECT format('ALTER ROLE ${PROBE_APP} PASSWORD %L', $1::text) AS s`, [verifier]);
    await probe.query(stmt.rows[0].s);
    const ok = new Pool({ connectionString: urlFor(PROBE_DB, PROBE_APP, password), max: 1 });
    try {
      const r = await ok.query<{ u: string }>(`SELECT current_user AS u`);
      expect(r.rows[0].u).toBe(PROBE_APP);
    } finally {
      await ok.end();
    }
    const bad = new Pool({ connectionString: urlFor(PROBE_DB, PROBE_APP, "falsch"), max: 1 });
    try {
      expect(await errorOf(bad.query(`SELECT 1`))).toMatch(/password authentication failed/);
    } finally {
      await bad.end();
    }
  });

  it("is what is stored for the real qm_app (no plaintext)", async () => {
    const r = await admin.query<{ rolpassword: string }>(`SELECT rolpassword FROM pg_authid WHERE rolname = 'qm_app'`);
    expect(r.rows[0].rolpassword).toMatch(/^SCRAM-SHA-256\$4096:/);
    expect(r.rows[0].rolpassword).not.toContain("test-app-password");
  });
});
