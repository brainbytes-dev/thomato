import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { organization, member, user } from "@/db/schema";
import type { OrgContext } from "@/domain/org-context";
import type { Role } from "@/domain/rights";
import { assertResetAllowed } from "@/seed/reset-guard";

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
  assertResetAllowed(process.env);
  const existing = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  const have = new Set(existing.rows.map((r) => r.tablename));
  const present = TABLES.filter((t) => have.has(t.replaceAll('"', "")));
  if (present.length === 0) return;
  await db.execute(sql.raw(`TRUNCATE ${present.join(", ")} RESTART IDENTITY CASCADE`));
}

export async function makeUser(label: string) {
  const [u] = await db
    .insert(user)
    .values({
      id: randomUUID(),
      name: label,
      email: `${label}-${randomUUID().slice(0, 8)}@example.test`,
      emailVerified: true,
    })
    .returning();
  return u;
}

export async function makeOrg(slug: string, role: Role = "owner") {
  const u = await makeUser(`user-${slug}`);
  const [org] = await db
    .insert(organization)
    .values({ id: randomUUID(), name: `Org ${slug}`, slug, createdAt: new Date() })
    .returning();
  await db
    .insert(member)
    .values({ id: randomUUID(), organizationId: org.id, userId: u.id, role, createdAt: new Date() });
  return { org, user: u };
}

export async function addMemberTo(orgId: string, label: string, role: Role) {
  const u = await makeUser(label);
  await db
    .insert(member)
    .values({ id: randomUUID(), organizationId: orgId, userId: u.id, role, createdAt: new Date() });
  return u;
}

export function ctxFor(orgId: string, userId: string, role: Role): OrgContext {
  return { organizationId: orgId, userId, role };
}
