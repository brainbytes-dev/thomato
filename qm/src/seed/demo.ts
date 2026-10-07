import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/auth/auth";
import { db } from "@/db";
import {
  ACTIVE_STANDARD_VERSION,
  criterion,
  criterionAssessment,
  deadline,
  member,
  organization,
} from "@/db/schema";
import type { AssessmentStatus } from "@/db/schema";
import { setAssessmentStatus } from "@/domain/assessments";
import { importCatalog } from "@/domain/catalog";
import { addDays, zurichDate } from "@/domain/dates";
import { ROLES, type Role } from "@/domain/rights";
import { assertResetAllowed } from "./reset-guard";

export { assertResetAllowed };

const DEMO_PASSWORD = "Demo-QM-2026";

// Story: Antrag, Struktur und Prozess sind weitgehend erfüllt (hoher Fortschritt), Ergebnis ist unbewertet.
// Zwei kritische Pflichtpunkte machen den Status trotzdem kritisch: Fortschritt ist nicht Readiness.
const CHAPTER_DEFAULT: Record<string, AssessmentStatus | undefined> = {
  Antrag: "met",
  Struktur: "met",
  Prozess: "met",
};
const OVERRIDES: Record<string, { status: AssessmentStatus; dueInDays?: number; reason?: string }> = {
  "6.3.2": { status: "critical", dueInDays: 25 },
  "7.3.10": { status: "critical", dueInDays: 12 },
  "6.5.2": { status: "open", dueInDays: 40 },
  "7.3.8": { status: "open", dueInDays: 40 },
  "7.3.2": { status: "open" },
  "7.9": { status: "not_applicable", reason: "Der Rettungsdienst betreibt keinen Rettungshelikopter (Demo-Angabe)." },
  "6.10": { status: "not_applicable", reason: "Notärzte werden vom Spital gestellt, der Rettungsdienst delegiert keine Notarzt-Tätigkeiten (Demo-Angabe)." },
  "8.1": { status: "open" },
};

export async function seedDemo(input: { catalog: unknown; now?: Date }) {
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
  const now = input.now ?? new Date();
  const catalogRows = await db
    .select({ id: criterion.id, number: criterion.number, chapter: criterion.chapter })
    .from(criterion)
    .where(eq(criterion.standardVersionId, ACTIVE_STANDARD_VERSION))
    .orderBy(criterion.sortOrder);
  const known = new Set(catalogRows.map((c) => c.number));
  for (const nr of Object.keys(OVERRIDES)) {
    if (!known.has(nr)) throw new Error(`Kriterium ${nr} fehlt im Katalog (Story-Schritt nicht ausführbar)`);
  }
  const today = zurichDate(now);
  for (const c of catalogRows) {
    const o = OVERRIDES[c.number];
    const status = o?.status ?? CHAPTER_DEFAULT[c.chapter];
    if (!status) continue;
    await setAssessmentStatus(ctx, c.id, status, { reason: o?.reason });
    if (o?.dueInDays !== undefined) {
      await db
        .update(criterionAssessment)
        .set({ dueDate: addDays(today, o.dueInDays) })
        .where(and(eq(criterionAssessment.organizationId, org.id), eq(criterionAssessment.criterionId, c.id)));
    }
  }
  await db.insert(deadline).values([
    { organizationId: org.id, kind: "application", label: "Antrag einreichen", dueDate: addDays(today, 20) },
    { organizationId: org.id, kind: "custom", label: "Besuchstermin der Expertinnen und Experten", dueDate: addDays(today, 60) },
    { organizationId: org.id, kind: "dossier", label: "Vollständiges Dossier abgeben", dueDate: addDays(today, 95) },
    { organizationId: org.id, kind: "expiry", label: "Ablauf der Anerkennung", dueDate: addDays(today, 640) },
  ]);
  return { organizationId: org.id, users };
}
