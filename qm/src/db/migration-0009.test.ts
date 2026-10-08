import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { applyRoles } from "../../scripts/roles-lib";
import { TEST_APP_PASSWORD } from "../../vitest.app-role.mjs";

// Migration 0009 läuft hier gegen eine Wegwerf-Datenbank mit Bestandsdaten im alten Format (Stand 0008).
const ownerUrl = process.env.TEST_DATABASE_URL;
if (!ownerUrl) throw new Error("TEST_DATABASE_URL fehlt");

const PROBE_DB = "qm_mig0009_probe";
const DRIZZLE_DIR = path.resolve(__dirname, "..", "..", "drizzle");

function urlFor(db: string): string {
  const u = new URL(ownerUrl as string);
  u.pathname = `/${db}`;
  return u.toString();
}

async function errorOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("erwartete Ablehnung blieb aus");
}

type Figures = { total: number; open: number; inProgress: number; done: number; overdue: number; openForDashboard: number };

async function figures(pool: Pool): Promise<Figures> {
  const r = await pool.query<Record<keyof Figures, string>>(`
    SELECT count(*)::text AS total,
      count(*) FILTER (WHERE status = 'open')::text AS open,
      count(*) FILTER (WHERE status = 'in_progress')::text AS "inProgress",
      count(*) FILTER (WHERE status = 'done')::text AS done,
      count(*) FILTER (WHERE status <> 'done' AND due_date < date '2026-10-08')::text AS overdue,
      count(*) FILTER (WHERE status IN ('open', 'in_progress'))::text AS "openForDashboard"
    FROM measure`);
  const row = r.rows[0];
  return {
    total: Number(row.total), open: Number(row.open), inProgress: Number(row.inProgress), done: Number(row.done),
    overdue: Number(row.overdue), openForDashboard: Number(row.openForDashboard),
  };
}

let admin: Pool;
let probe: Pool;
let before: Figures;
let tmpFolder: string;

beforeAll(async () => {
  admin = new Pool({ connectionString: urlFor("postgres"), max: 1 });
  await admin.query(`DROP DATABASE IF EXISTS ${PROBE_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${PROBE_DB}`);
  probe = new Pool({ connectionString: urlFor(PROBE_DB), max: 2 });

  // Alter Stand: nur Migrationen bis 0008 (Journal und SQL-Dateien gekürzt).
  tmpFolder = mkdtempSync(path.join(tmpdir(), "qm-mig0009-"));
  mkdirSync(path.join(tmpFolder, "meta"));
  for (const f of readdirSync(DRIZZLE_DIR)) {
    if (f.endsWith(".sql") && !f.startsWith("0009_")) cpSync(path.join(DRIZZLE_DIR, f), path.join(tmpFolder, f));
  }
  const journal = JSON.parse(readFileSync(path.join(DRIZZLE_DIR, "meta", "_journal.json"), "utf8")) as {
    entries: { idx: number }[];
  };
  journal.entries = journal.entries.filter((e) => e.idx <= 8);
  writeFileSync(path.join(tmpFolder, "meta", "_journal.json"), JSON.stringify(journal));
  await migrate(drizzle(probe), { migrationsFolder: tmpFolder });

  const hasPhase = await probe.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'measure' AND column_name = 'phase'`);
  expect(hasPhase.rows).toHaveLength(0);

  await probe.query(`INSERT INTO "user" (id, name, email, email_verified) VALUES ('u1', 'U', 'u1@example.test', true)`);
  await probe.query(`INSERT INTO organization (id, name, slug, created_at) VALUES ('o1', 'Org', 'org-1', now())`);
  await probe.query(`INSERT INTO standard_version (id, label) VALUES ('ivr-rd-draft', 't')`);
  await probe.query(
    `INSERT INTO criterion (standard_version_id, number, title, chapter, mandatory_accreditation, should_accreditation,
       mandatory_renewal, should_renewal, sort_order) VALUES ('ivr-rd-draft', '1.1', 'K', 'Prozess', true, false, true, false, 1)`,
  );
  const insertMeasure = (title: string, status: string, due: string, completed: string | null) =>
    probe.query(
      `INSERT INTO measure (organization_id, standard_version_id, criterion_number, title, owner_user_id, due_date, status, completed_at)
       VALUES ('o1', 'ivr-rd-draft', '1.1', $1, 'u1', $2, $3, $4)`,
      [title, due, status, completed],
    );
  await insertMeasure("offen", "open", "2026-11-01", null);
  await insertMeasure("offen überfällig", "open", "2026-10-01", null);
  await insertMeasure("läuft", "in_progress", "2026-10-20", null);
  await insertMeasure("läuft überfällig", "in_progress", "2026-09-20", null);
  await insertMeasure("erledigt", "done", "2026-09-01", "2026-09-05T10:00:00Z");
  before = await figures(probe);

  // 0009 gegen die Bestandsdaten.
  await migrate(drizzle(probe), { migrationsFolder: DRIZZLE_DIR });
});

afterAll(async () => {
  await probe.end();
  await admin.query(`DROP DATABASE IF EXISTS ${PROBE_DB} WITH (FORCE)`);
  await admin.end();
  rmSync(tmpFolder, { recursive: true, force: true });
});

describe("migration 0009 on a database with old rows", () => {
  it("maps open to plan, in_progress to do and done to act without losing data", async () => {
    const r = await probe.query<{ title: string; status: string; phase: string; cycle: number; criterion: string | null; completed: Date | null }>(
      `SELECT title, status, phase, cycle, effectiveness_criterion AS criterion, completed_at AS completed FROM measure ORDER BY title`,
    );
    expect(r.rows.map((m) => [m.title, m.status, m.phase, m.cycle, m.criterion])).toEqual([
      ["erledigt", "done", "act", 1, null],
      ["läuft", "in_progress", "do", 1, null],
      ["läuft überfällig", "in_progress", "do", 1, null],
      ["offen", "open", "plan", 1, null],
      ["offen überfällig", "open", "plan", 1, null],
    ]);
    expect(r.rows.find((m) => m.title === "erledigt")?.completed?.toISOString()).toBe("2026-09-05T10:00:00.000Z");
  });

  it("leaves the dashboard figures identical (open, overdue, done counts)", async () => {
    expect(await figures(probe)).toEqual(before);
    expect(before).toEqual({ total: 5, open: 2, inProgress: 2, done: 1, overdue: 2, openForDashboard: 4 });
  });

  it("gives migrated done measures no review row (not reviewed)", async () => {
    const r = await probe.query<{ n: string }>(`SELECT count(*)::text AS n FROM measure_review`);
    expect(r.rows[0].n).toBe("0");
  });

  it("enforces the new rules afterwards: done only in phase act", async () => {
    expect(
      await errorOf(probe.query(`UPDATE measure SET phase = 'check' WHERE title = 'erledigt'`)),
    ).toMatch(/measure_done_phase_check/);
    expect(
      await errorOf(
        probe.query(
          `INSERT INTO measure (organization_id, standard_version_id, criterion_number, title, owner_user_id, due_date, status, completed_at, phase)
           VALUES ('o1', 'ivr-rd-draft', '1.1', 'x', 'u1', '2026-12-01', 'done', now(), 'do')`,
        ),
      ),
    ).toMatch(/measure_done_phase_check/);
  });

  it("keeps measure_review append-only for the owner (UPDATE and DELETE rejected)", async () => {
    const m = await probe.query<{ id: string }>(`SELECT id FROM measure WHERE title = 'läuft'`);
    const r = await probe.query<{ id: string }>(
      `INSERT INTO measure_review (organization_id, measure_id, cycle, result, note, checked_by)
       VALUES ('o1', $1, 1, 'effective', 'Wirksam belegt', 'u1') RETURNING id`,
      [m.rows[0].id],
    );
    expect(await errorOf(probe.query(`UPDATE measure_review SET note = 'anders' WHERE id = $1`, [r.rows[0].id]))).toMatch(/append-only/);
    expect(await errorOf(probe.query(`DELETE FROM measure_review WHERE id = $1`, [r.rows[0].id]))).toMatch(/append-only/);
  });

  it("rejects steps and reviews that point at another organization's measure (composite FK)", async () => {
    await probe.query(`INSERT INTO organization (id, name, slug, created_at) VALUES ('o2', 'Org2', 'org-2', now())`);
    const m = await probe.query<{ id: string }>(`SELECT id FROM measure WHERE title = 'läuft'`);
    expect(
      await errorOf(probe.query(`INSERT INTO measure_step (organization_id, measure_id, position, title) VALUES ('o2', $1, 1, 'Schritt eins')`, [m.rows[0].id])),
    ).toMatch(/measure_step_measure_fk/);
    expect(
      await errorOf(
        probe.query(
          `INSERT INTO measure_review (organization_id, measure_id, cycle, result, note, checked_by) VALUES ('o2', $1, 1, 'partly', 'Fremd', 'u1')`,
          [m.rows[0].id],
        ),
      ),
    ).toMatch(/measure_review_measure_fk/);
  });

  it("runs roles.sql twice after the migration and withholds UPDATE/DELETE on measure_review from qm_app", async () => {
    await applyRoles(probe, TEST_APP_PASSWORD);
    await applyRoles(probe, TEST_APP_PASSWORD);
    const priv = async (table: string) => {
      const r = await probe.query<{ p: string }>(
        `SELECT coalesce(string_agg(t, ',' ORDER BY t), '') AS p FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) AS t
         WHERE has_table_privilege('qm_app', $1, t)`,
        [table],
      );
      return r.rows[0].p;
    };
    expect(await priv("measure_review")).toBe("INSERT,SELECT");
    expect(await priv("measure_step")).toBe("DELETE,INSERT,SELECT,UPDATE");
    expect(await priv("measure")).toBe("INSERT,SELECT,UPDATE");
  });
});
