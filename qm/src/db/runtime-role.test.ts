import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { ACTIVE_STANDARD_VERSION } from "@/db/schema";
import { authId } from "@/test/helpers";

// Die Rolle qm_app wird von vitest.global-setup.ts angelegt (db/roles.sql mit dem Besitzer).
// Dieser Test verbindet sich als qm_app (eigener Pool); der Besitzer-Pool bereitet nur Daten vor.
const ownerUrl = process.env.TEST_DATABASE_URL;
const appUrl = process.env.TEST_APP_DATABASE_URL;
if (!ownerUrl || !appUrl) throw new Error("TEST_DATABASE_URL und TEST_APP_DATABASE_URL müssen gesetzt sein");

let owner: Pool;
let app: Pool;

beforeAll(() => {
  owner = new Pool({ connectionString: ownerUrl, max: 2 });
  app = new Pool({ connectionString: appUrl, max: 2 });
});
afterAll(async () => {
  await Promise.all([owner.end(), app.end()]);
});

async function errorOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("erwartete Ablehnung blieb aus");
}

type Fixture = { orgId: string; userId: string; docId: string; versionId: string; eventId: string; measureId: string };

async function prepare(): Promise<Fixture> {
  await owner.query(
    `BEGIN; SET LOCAL qm.allow_truncate = 'on'; TRUNCATE measure_review, measure_step, measure, evidence_link, document_version, document, deadline, audit_event, criterion_assessment,
     criterion, standard_version, invitation, member, session, account, verification, organization, "user"
     RESTART IDENTITY CASCADE; COMMIT`,
  );
  const userId = authId();
  const orgId = authId();
  await owner.query(`INSERT INTO "user" (id, name, email, email_verified) VALUES ($1, 'U', $2, true)`, [
    userId,
    `u-${randomUUID().slice(0, 8)}@example.test`,
  ]);
  await owner.query(`INSERT INTO organization (id, name, slug, created_at) VALUES ($1, 'Org', $2, now())`, [
    orgId,
    `org-${randomUUID().slice(0, 8)}`,
  ]);
  await owner.query(`INSERT INTO standard_version (id, label) VALUES ($1, 't') ON CONFLICT DO NOTHING`, [
    ACTIVE_STANDARD_VERSION,
  ]);
  await owner.query(
    `INSERT INTO criterion (standard_version_id, number, title, chapter, mandatory_accreditation, should_accreditation,
       mandatory_renewal, should_renewal, sort_order) VALUES ($1, '1.1', 'K', 'Prozess', true, false, true, false, 1)`,
    [ACTIVE_STANDARD_VERSION],
  );
  const doc = await owner.query<{ id: string }>(
    `INSERT INTO document (organization_id, title) VALUES ($1, 'D') RETURNING id`,
    [orgId],
  );
  const docId = doc.rows[0].id;
  const ver = await owner.query<{ id: string }>(
    `INSERT INTO document_version (organization_id, document_id, version_number, file_name, mime_type, size_bytes, sha256, content)
     VALUES ($1, $2, 1, 'a.pdf', 'application/pdf', 4, $3, $4) RETURNING id`,
    [orgId, docId, "0".repeat(64), Buffer.from("%PDF")],
  );
  const ev = await owner.query<{ id: string }>(
    `INSERT INTO audit_event (organization_id, event_type, entity_type, entity_id) VALUES ($1, 'test.created', 'test', '1') RETURNING id`,
    [orgId],
  );
  const m = await owner.query<{ id: string }>(
    `INSERT INTO measure (organization_id, standard_version_id, criterion_number, title, owner_user_id, due_date)
     VALUES ($1, $2, '1.1', 'M', $3, '2026-12-01') RETURNING id`,
    [orgId, ACTIVE_STANDARD_VERSION, userId],
  );
  return { orgId, userId, docId, versionId: ver.rows[0].id, eventId: ev.rows[0].id, measureId: m.rows[0].id };
}

describe("qm_app runtime role", () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await prepare();
  });

  it("connects as qm_app and is neither superuser nor owner of any table (g)", async () => {
    const who = await app.query<{ current_user: string }>(`SELECT current_user`);
    expect(who.rows[0].current_user).toBe("qm_app");
    const attrs = await owner.query(
      `SELECT rolsuper, rolcreatedb, rolcreaterole, rolcanlogin, rolbypassrls, rolreplication, rolinherit, rolconnlimit
       FROM pg_roles WHERE rolname = 'qm_app'`,
    );
    // rolinherit ist bewusst false (NOINHERIT): qm_app erbt keine Rechte aus Gruppenrollen und besitzt auch keine.
    expect(attrs.rows[0]).toEqual({
      rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolcanlogin: true,
      rolbypassrls: false, rolreplication: false, rolinherit: false, rolconnlimit: 50,
    });
    const owned = await owner.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner = 'qm_app'`);
    expect(owned.rows).toEqual([]);
  });

  it("can INSERT into audit_event and document_version (a)", async () => {
    await app.query(
      `INSERT INTO audit_event (organization_id, event_type, entity_type, entity_id) VALUES ($1, 'x.created', 'x', '2')`,
      [f.orgId],
    );
    await app.query(
      `INSERT INTO document_version (organization_id, document_id, version_number, file_name, mime_type, size_bytes, sha256, content)
       VALUES ($1, $2, 2, 'b.pdf', 'application/pdf', 4, $3, $4)`,
      [f.orgId, f.docId, "1".repeat(64), Buffer.from("%PDF")],
    );
    const counts = await owner.query<{ a: string; v: string }>(
      `SELECT (SELECT count(*) FROM audit_event) AS a, (SELECT count(*) FROM document_version) AS v`,
    );
    expect(counts.rows[0]).toEqual({ a: "2", v: "2" });
  });

  it.each([
    ["audit_event", "UPDATE audit_event SET event_type = 'x'"],
    ["audit_event", "DELETE FROM audit_event"],
    ["audit_event", "TRUNCATE audit_event"],
    ["document_version", "UPDATE document_version SET file_name = 'x'"],
    ["document_version", "DELETE FROM document_version"],
    ["document_version", "TRUNCATE document_version"],
  ])("denies the app role on %s: %s (b)", async (table, statement) => {
    expect(await errorOf(app.query(statement))).toMatch(new RegExp(`permission denied for table ${table}`));
  });

  it("keeps measure_review append-only: qm_app may INSERT and SELECT, never UPDATE, DELETE or TRUNCATE, and the owner is stopped by the trigger", async () => {
    const ins = await app.query<{ id: string }>(
      `INSERT INTO measure_review (organization_id, measure_id, cycle, result, note, checked_by)
       VALUES ($1, $2, 1, 'partly', 'Teilweise wirksam', $3) RETURNING id`,
      [f.orgId, f.measureId, f.userId],
    );
    const reviewId = ins.rows[0].id;
    const read = await app.query<{ n: string }>(`SELECT count(*)::text AS n FROM measure_review WHERE id = $1`, [reviewId]);
    expect(read.rows[0].n).toBe("1");
    for (const statement of [
      `UPDATE measure_review SET note = 'anders'`,
      `DELETE FROM measure_review`,
      `TRUNCATE measure_review`,
    ]) {
      expect(await errorOf(app.query(statement)), statement).toMatch(/permission denied for table measure_review/);
    }
    // Besitzer: Rechte vorhanden, aber der Trigger lehnt ab.
    expect(await errorOf(owner.query(`UPDATE measure_review SET note = 'anders' WHERE id = $1`, [reviewId]))).toMatch(/append-only/);
    expect(await errorOf(owner.query(`DELETE FROM measure_review WHERE id = $1`, [reviewId]))).toMatch(/append-only/);
    // TRUNCATE ist auch für den Besitzer gesperrt (Statement-Trigger), ausser ein Reset hebt es ausdrücklich auf.
    expect(await errorOf(owner.query(`TRUNCATE measure_review`))).toMatch(/append-only/);
    expect(await errorOf(owner.query(`TRUNCATE measure CASCADE`))).toMatch(/append-only/);
    expect(await errorOf(app.query(`ALTER TABLE measure_review DISABLE TRIGGER ALL`))).toMatch(/must be owner of table measure_review/);
    const after = await owner.query<{ note: string }>(`SELECT note FROM measure_review WHERE id = $1`, [reviewId]);
    expect(after.rows[0].note).toBe("Teilweise wirksam");
  });

  it("lets qm_app insert, update and delete measure_step rows", async () => {
    const ins = await app.query<{ id: string }>(
      `INSERT INTO measure_step (organization_id, measure_id, position, title) VALUES ($1, $2, 1, 'Schritt eins') RETURNING id`,
      [f.orgId, f.measureId],
    );
    await app.query(`UPDATE measure_step SET title = 'Schritt zwei', done_at = now(), done_by = $2 WHERE id = $1`, [ins.rows[0].id, f.userId]);
    await app.query(`SELECT id FROM measure_step WHERE id = $1 FOR UPDATE`, [ins.rows[0].id]);
    await app.query(`DELETE FROM measure_step WHERE id = $1`, [ins.rows[0].id]);
    const left = await owner.query<{ n: string }>(`SELECT count(*)::text AS n FROM measure_step`);
    expect(left.rows[0].n).toBe("0");
  });

  it("denies TRUNCATE on every public table (c)", async () => {
    const tables = await owner.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
    expect(tables.rows.length).toBeGreaterThan(10);
    for (const { tablename } of tables.rows) {
      expect(await errorOf(app.query(`TRUNCATE "${tablename}" CASCADE`)), tablename).toMatch(/permission denied/);
    }
  });

  it("denies DDL (d)", async () => {
    expect(await errorOf(app.query(`CREATE TABLE evil (id int)`))).toMatch(/permission denied for schema public/);
    expect(await errorOf(app.query(`ALTER TABLE criterion ADD COLUMN evil int`))).toMatch(/must be owner of table criterion/);
    expect(await errorOf(app.query(`DROP TABLE document CASCADE`))).toMatch(/must be owner of table document/);
  });

  it("cannot disable the immutability triggers (e)", async () => {
    expect(await errorOf(app.query(`ALTER TABLE audit_event DISABLE TRIGGER ALL`))).toMatch(/must be owner of table audit_event/);
    expect(await errorOf(app.query(`ALTER TABLE document_version DISABLE TRIGGER ALL`))).toMatch(/must be owner of table document_version/);
  });

  it("has no access to the drizzle migration schema", async () => {
    expect(await errorOf(app.query(`SELECT * FROM drizzle.__drizzle_migrations`))).toMatch(/permission denied/);
  });

  it("runs normal operations (f)", async () => {
    // deadline
    const dl = await app.query<{ id: string }>(
      `INSERT INTO deadline (organization_id, kind, label, due_date) VALUES ($1, 'custom', 'F', '2026-12-01') RETURNING id`,
      [f.orgId],
    );
    await app.query(`UPDATE deadline SET label = 'G' WHERE id = $1`, [dl.rows[0].id]);
    await app.query(`DELETE FROM deadline WHERE id = $1`, [dl.rows[0].id]);
    // evidence_link
    const link = await app.query<{ id: string }>(
      `INSERT INTO evidence_link (organization_id, document_id, standard_version_id, criterion_number)
       VALUES ($1, $2, $3, '1.1') RETURNING id`,
      [f.orgId, f.docId, ACTIVE_STANDARD_VERSION],
    );
    await app.query(`UPDATE evidence_link SET linked_at = now() WHERE id = $1`, [link.rows[0].id]);
    await app.query(`SELECT id FROM evidence_link WHERE id = $1 FOR UPDATE`, [link.rows[0].id]);
    await app.query(`DELETE FROM evidence_link WHERE id = $1`, [link.rows[0].id]);
    // session (Better Auth, hängt am Benutzer)
    const sid = authId();
    await app.query(
      `INSERT INTO session (id, expires_at, token, updated_at, user_id) VALUES ($1, now() + interval '1 day', $2, now(), $3)`,
      [sid, randomUUID(), f.userId],
    );
    await app.query(`UPDATE session SET user_agent = 'x' WHERE id = $1`, [sid]);
    await app.query(`DELETE FROM session WHERE id = $1`, [sid]);
    // measure: INSERT/UPDATE ja, DELETE nein (R48)
    await app.query(`UPDATE measure SET title = 'M2' WHERE id = $1`, [f.measureId]);
    await app.query(
      `INSERT INTO measure (organization_id, standard_version_id, criterion_number, title, owner_user_id, due_date)
       VALUES ($1, $2, '1.1', 'M3', $3, '2026-12-02')`,
      [f.orgId, ACTIVE_STANDARD_VERSION, f.userId],
    );
    expect(await errorOf(app.query(`DELETE FROM measure WHERE id = $1`, [f.measureId]))).toMatch(
      /permission denied for table measure/,
    );
    // Zeilensperren, wie die Services sie nehmen
    for (const table of ["document", "evidence_link", "criterion_assessment", "measure"]) {
      await app.query(`BEGIN`);
      try {
        await app.query(`SELECT * FROM ${table} FOR UPDATE`);
      } finally {
        await app.query(`ROLLBACK`);
      }
    }
    // SELECT auf alle Tabellen
    const tables = await owner.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
    for (const { tablename } of tables.rows) await app.query(`SELECT count(*) FROM "${tablename}"`);
  });

  it("applies CHECK constraints to the role as well (h)", async () => {
    await app.query(
      `INSERT INTO criterion_assessment (organization_id, criterion_id, status) SELECT $1, id, 'not_assessed' FROM criterion LIMIT 1`,
      [f.orgId],
    );
    expect(
      await errorOf(app.query(`UPDATE criterion_assessment SET status = 'not_applicable', not_applicable_reason = NULL`)),
    ).toMatch(/assessment_na_reason_check/);
    expect(await errorOf(app.query(`UPDATE measure SET status = 'done', phase = 'act', completed_at = NULL WHERE id = $1`, [f.measureId]))).toMatch(
      /measure_status_completed_check/,
    );
  });
});
