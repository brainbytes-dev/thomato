import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { member, organization, session } from "@/db/schema";
import { auth } from "./auth";
import { resetDb } from "@/test/helpers";

const PASSWORD = "correct-horse-battery-1";

async function signUp(email: string) {
  const { user } = await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: "T" } });
  return user;
}

async function addOrg(slug: string, userId: string, createdAt: Date) {
  const [org] = await db
    .insert(organization)
    .values({ id: randomUUID(), name: `Org ${slug}`, slug, createdAt })
    .returning();
  await db.insert(member).values({ id: randomUUID(), organizationId: org.id, userId, role: "owner", createdAt });
  return org;
}

async function signInAndReadSession(email: string, userId: string) {
  // signUp legt bereits eine Session ohne Mitgliedschaft an: nur die Sign-in-Session zählt.
  await db.delete(session).where(eq(session.userId, userId));
  await auth.api.signInEmail({ body: { email, password: PASSWORD } });
  const rows = await db.select().from(session).where(eq(session.userId, userId));
  return rows;
}

describe("session create hook", () => {
  beforeEach(resetDb);

  it("activates the organization of the single membership", async () => {
    const user = await signUp("one@example.test");
    const org = await addOrg("one", user.id, new Date());
    const rows = await signInAndReadSession("one@example.test", user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].activeOrganizationId).toBe(org.id);
  });

  it("picks the earliest membership when there are several", async () => {
    const user = await signUp("two@example.test");
    const later = await addOrg("later", user.id, new Date("2026-02-01T00:00:00Z"));
    const earliest = await addOrg("earliest", user.id, new Date("2026-01-01T00:00:00Z"));
    const rows = await signInAndReadSession("two@example.test", user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].activeOrganizationId).toBe(earliest.id);
    expect(earliest.id).not.toBe(later.id);
  });

  it("leaves activeOrganizationId null without membership", async () => {
    const user = await signUp("none@example.test");
    const rows = await signInAndReadSession("none@example.test", user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].activeOrganizationId).toBeNull();
  });
});
