import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION } from "@/db/schema";
import { importCatalog } from "@/domain/catalog";
import { makeOrg, resetDb } from "@/test/helpers";

async function setup() {
  await importCatalog(db, {
    standardVersionId: ACTIVE_STANDARD_VERSION,
    label: "t",
    rows: [
      {
        nummer: "7.3.10", titel: "K 7.3.10", kapitel: "Prozess", anerkennung_muss: true, anerkennung_soll: false,
        erneuerung_muss: true, erneuerung_soll: false, sortierung: 1,
      },
    ],
  });
  return makeOrg("mea-schema");
}

type Row = { orgId: string; userId: string; number?: string; status?: string; completedAt?: string | null };

function insert(r: Row) {
  const completed = r.completedAt === undefined || r.completedAt === null ? sql`NULL` : sql`${r.completedAt}::timestamptz`;
  return db.execute(sql`
    INSERT INTO measure (organization_id, standard_version_id, criterion_number, title, owner_user_id, due_date, status, completed_at)
    VALUES (${r.orgId}, ${ACTIVE_STANDARD_VERSION}, ${r.number ?? "7.3.10"}, 'Titel', ${r.userId}, '2026-11-15', ${r.status ?? "open"}, ${completed})
  `);
}

// drizzle wraps driver errors; the constraint name lives in the cause chain.
async function failureText(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const parts: string[] = [];
    let cur: unknown = e;
    while (cur instanceof Error) {
      parts.push(cur.message);
      const c = (cur as { constraint?: string }).constraint;
      if (c) parts.push(c);
      cur = cur.cause;
    }
    return parts.join(" | ");
  }
  throw new Error("expected the insert to be rejected");
}

describe("measure table constraints", () => {
  beforeEach(resetDb);

  it("rejects done without completed_at", async () => {
    const { org, user } = await setup();
    expect(await failureText(insert({ orgId: org.id, userId: user.id, status: "done" }))).toContain("measure_status_completed_check");
  });

  it("rejects open with completed_at", async () => {
    const { org, user } = await setup();
    expect(
      await failureText(insert({ orgId: org.id, userId: user.id, status: "open", completedAt: "2026-10-08T10:00:00Z" })),
    ).toContain("measure_status_completed_check");
  });

  it("rejects an unknown status", async () => {
    const { org, user } = await setup();
    expect(await failureText(insert({ orgId: org.id, userId: user.id, status: "weird" }))).toContain("measure_status_check");
  });

  it("rejects a criterion number that does not exist", async () => {
    const { org, user } = await setup();
    expect(await failureText(insert({ orgId: org.id, userId: user.id, number: "9.9.9" }))).toContain("measure_criterion_fk");
  });

  it("rejects an organization that does not exist", async () => {
    const { user } = await setup();
    expect(await failureText(insert({ orgId: "no-such-org", userId: user.id }))).toContain("foreign key");
  });

  it("accepts valid rows", async () => {
    const { org, user } = await setup();
    await insert({ orgId: org.id, userId: user.id });
    await insert({ orgId: org.id, userId: user.id, status: "done", completedAt: "2026-10-08T10:00:00Z" });
    const r = await db.execute<{ n: string }>(sql`SELECT count(*)::text AS n FROM measure`);
    expect(r.rows[0].n).toBe("2");
  });
});
