import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";

async function probeCount(): Promise<number> {
  const res = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM _tx_probe`,
  );
  return res.rows[0].n;
}

describe("db transactions", () => {
  beforeAll(async () => {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS _tx_probe (x int)`);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE _tx_probe`);
  });

  afterAll(async () => {
    await db.execute(sql`DROP TABLE IF EXISTS _tx_probe`);
  });

  it("rolls back inserts when the transaction throws", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(sql`INSERT INTO _tx_probe VALUES (1)`);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await probeCount()).toBe(0);
  });

  it("commits inserts when the transaction returns normally", async () => {
    await db.transaction(async (tx) => {
      await tx.execute(sql`INSERT INTO _tx_probe VALUES (1)`);
    });
    expect(await probeCount()).toBe(1);
  });
});
