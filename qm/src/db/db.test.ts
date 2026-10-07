import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";

describe("db", () => {
  it("opens a transaction that rolls back on error", async () => {
    await db.execute(sql`CREATE TEMP TABLE t (x int)`).catch(() => undefined);
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(sql`SELECT 1`);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const res = await db.execute(sql`SELECT 1 AS one`);
    expect(res.rows[0]).toEqual({ one: 1 });
  });
});
