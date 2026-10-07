import { sql } from "drizzle-orm";
import { db } from "@/db";

const TABLES = [
  "audit_event",
  "criterion_assessment",
  "criterion",
  "standard_version",
  "invitation",
  "member",
  "session",
  "account",
  "verification",
  "organization",
  '"user"',
];

export async function resetDb() {
  if (process.env.ALLOW_DEMO_RESET !== "1") {
    throw new Error("resetDb nur mit ALLOW_DEMO_RESET=1");
  }
  const existing = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  const have = new Set(existing.rows.map((r) => r.tablename));
  const present = TABLES.filter((t) => have.has(t.replaceAll('"', "")));
  if (present.length === 0) return;
  await db.execute(sql.raw(`TRUNCATE ${present.join(", ")} RESTART IDENTITY CASCADE`));
}
