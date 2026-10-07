import { sql } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import { db } from "@/db";
import { organization, member, user } from "@/db/schema";
import type { OrgContext } from "@/domain/org-context";
import type { Role } from "@/domain/rights";
import { assertResetAllowed } from "@/seed/reset-guard";

const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Id im Stil von Better Auth: 32 Zeichen aus [A-Za-z0-9], keine UUID. Rejection Sampling vermeidet Modulo-Bias. */
export function authId(): string {
  let out = "";
  while (out.length < 32) {
    for (const byte of randomBytes(48)) {
      if (byte < 248 && out.length < 32) out += ALPHANUMERIC[byte % 62];
    }
  }
  return out;
}

const TABLES = [
  "measure",
  "evidence_link",
  "document_version",
  "document",
  "deadline",
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
      id: authId(),
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
    .values({ id: authId(), name: `Org ${slug}`, slug, createdAt: new Date() })
    .returning();
  await db
    .insert(member)
    .values({ id: authId(), organizationId: org.id, userId: u.id, role, createdAt: new Date() });
  return { org, user: u };
}

export async function addMemberTo(orgId: string, label: string, role: Role) {
  const u = await makeUser(label);
  await db
    .insert(member)
    .values({ id: authId(), organizationId: orgId, userId: u.id, role, createdAt: new Date() });
  return u;
}

export function ctxFor(orgId: string, userId: string, role: Role): OrgContext {
  return { organizationId: orgId, userId, role };
}
