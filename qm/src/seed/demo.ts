import { eq, sql } from "drizzle-orm";
import { seedAuth } from "@/auth/seed-auth";
import { db } from "@/db";
import {
  ACTIVE_STANDARD_VERSION,
  criterion,
  deadline,
  member,
  organization,
} from "@/db/schema";
import type { AssessmentStatus } from "@/db/schema";
import { setAssessmentDueDate, setAssessmentStatus } from "@/domain/assessments";
import { importCatalog } from "@/domain/catalog";
import { createMeasure, setMeasureStatus } from "@/domain/measures";
import { addDays, zurichDate } from "@/domain/dates";
import { ROLES, type Role } from "@/domain/rights";
import { seedDemoDocuments } from "./demo-documents";
import { assertResetAllowed } from "./reset-guard";

export { assertResetAllowed };

const DEFAULT_DEMO_PASSWORD = "Demo-QM-2026";

// Lokal gilt das bekannte Demo-Passwort. Für ein Deployment setzt QM_DEMO_PASSWORD ein eigenes (mind. 12 Zeichen), das nie im Repo steht.
function demoPassword(): string {
  const custom = process.env.QM_DEMO_PASSWORD;
  if (custom === undefined || custom === "") return DEFAULT_DEMO_PASSWORD;
  if (custom.length < 12) throw new Error("QM_DEMO_PASSWORD muss mindestens 12 Zeichen lang sein.");
  return custom;
}

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

type DemoMeasure = {
  criterion: string;
  title: string;
  owner: Role;
  dueInDays: number;
  status: "open" | "in_progress" | "done";
  /** Nur für erledigte Massnahmen: Erledigung liegt so viele Tage vor dem Seed-Zeitpunkt. */
  completedDaysAgo?: number;
};

// Eine laufende, eine offene, eine überfällige und eine erledigte Massnahme; die erledigte darf nirgends als offen zählen.
const DEMO_MEASURES: DemoMeasure[] = [
  { criterion: "7.3.10", title: "Hygienekonzept überarbeiten und neu freigeben (Demo)", owner: "qm_admin", dueInDays: 12, status: "in_progress" },
  { criterion: "6.3.2", title: "Statusmeldungen an die SNZ 144 technisch sicherstellen (Demo)", owner: "editor", dueInDays: 25, status: "open" },
  { criterion: "7.3.8", title: "Wartungsplan für Fahrzeuge vervollständigen (Demo)", owner: "reviewer", dueInDays: -4, status: "open" },
  { criterion: "5.2.2", title: "Organigramm aktualisieren (Demo)", owner: "owner", dueInDays: -30, status: "done", completedDaysAgo: 32 },
];

export async function seedDemo(input: { catalog: unknown; now?: Date }) {
  assertResetAllowed(process.env);
  if (!Array.isArray(input.catalog)) throw new Error("Katalog muss ein Array sein");
  const rows: unknown[] = input.catalog;

  await db.execute(
    sql`TRUNCATE measure, evidence_link, document_version, document, deadline, audit_event, criterion_assessment, invitation, member, session, account, verification, organization, "user" RESTART IDENTITY CASCADE`,
  );
  await importCatalog(db, {
    standardVersionId: ACTIVE_STANDARD_VERSION,
    label: "IVR Rettungsdienst (Entwurf, aus Python-Demo extrahiert)",
    rows,
  });

  const users = {} as Record<Role, { email: string; password: string }>;
  const ids = {} as Record<Role, string>;
  const password = demoPassword();
  for (const role of ROLES) {
    const email = `${role.replace("_", "-")}@demo.qm.test`;
    const { user } = await seedAuth.api.signUpEmail({
      body: { email, password, name: `Demo ${role}` },
    });
    users[role] = { email, password };
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
      await setAssessmentDueDate(ctx, c.id, addDays(today, o.dueInDays));
    }
  }
  await seedDemoDocuments(ctx, now);
  for (const m of DEMO_MEASURES) {
    if (!known.has(m.criterion)) throw new Error(`Kriterium ${m.criterion} fehlt im Katalog (Massnahme nicht anlegbar)`);
    const { id } = await createMeasure(ctx, {
      criterionNumber: m.criterion,
      title: m.title,
      description: null,
      ownerUserId: ids[m.owner],
      dueDate: addDays(today, m.dueInDays),
    });
    if (m.status !== "open") {
      const at = m.completedDaysAgo === undefined ? now : new Date(now.getTime() - m.completedDaysAgo * 86_400_000);
      await setMeasureStatus(ctx, id, m.status, at);
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
