import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/auth/auth";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION, criterion, member, organization } from "@/db/schema";
import type { AssessmentStatus } from "@/db/schema";
import { setAssessmentStatus } from "@/domain/assessments";
import { importCatalog } from "@/domain/catalog";
import { ROLES, type Role } from "@/domain/rights";
import { assertResetAllowed } from "./reset-guard";

export { assertResetAllowed };

const DEMO_PASSWORD = "Demo-QM-2026";

// Story: wenige bewusst offene Pflichtpunkte, einige erfüllte, der Rest unbewertet.
const STORY: ReadonlyArray<{ number: string; status: AssessmentStatus }> = [
  { number: "5.2.1", status: "met" },
  { number: "5.2.2", status: "met" },
  { number: "7.3.10", status: "critical" },
  { number: "7.3.8", status: "open" },
  { number: "8.1", status: "open" },
];

export async function seedDemo(input: { catalog: unknown }) {
  assertResetAllowed(process.env);
  if (!Array.isArray(input.catalog)) throw new Error("Katalog muss ein Array sein");
  const rows: unknown[] = input.catalog;

  await db.execute(
    sql`TRUNCATE deadline, audit_event, criterion_assessment, invitation, member, session, account, verification, organization, "user" RESTART IDENTITY CASCADE`,
  );
  await importCatalog(db, {
    standardVersionId: ACTIVE_STANDARD_VERSION,
    label: "IVR Rettungsdienst (Entwurf, aus Python-Demo extrahiert)",
    rows,
  });

  const users = {} as Record<Role, { email: string; password: string }>;
  const ids = {} as Record<Role, string>;
  for (const role of ROLES) {
    const email = `${role.replace("_", "-")}@demo.qm.test`;
    const { user } = await auth.api.signUpEmail({
      body: { email, password: DEMO_PASSWORD, name: `Demo ${role}` },
    });
    users[role] = { email, password: DEMO_PASSWORD };
    ids[role] = user.id;
  }

  const [org] = await db
    .insert(organization)
    .values({
      id: crypto.randomUUID(),
      name: "Rettungsdienst Musterstadt - Demo",
      slug: "musterstadt-demo",
      createdAt: new Date(),
    })
    .returning();
  for (const role of ROLES) {
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: org.id,
      userId: ids[role],
      role,
      createdAt: new Date(),
    });
  }

  const ctx = { organizationId: org.id, userId: ids.owner, role: "owner" as const };
  for (const step of STORY) {
    const [c] = await db
      .select({ id: criterion.id })
      .from(criterion)
      .where(
        and(
          eq(criterion.standardVersionId, ACTIVE_STANDARD_VERSION),
          eq(criterion.number, step.number),
        ),
      );
    if (!c) throw new Error(`Kriterium ${step.number} fehlt im Katalog (Story-Schritt nicht ausführbar)`);
    await setAssessmentStatus(ctx, c.id, step.status);
  }
  return { organizationId: org.id, users };
}
