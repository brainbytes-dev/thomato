import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Muss vor jedem Import von "@/db" laufen: die Services ziehen ihren Pool aus DATABASE_URL.
vi.hoisted(() => {
  const appUrl = process.env.TEST_APP_DATABASE_URL;
  if (!appUrl) throw new Error("TEST_APP_DATABASE_URL fehlt");
  process.env.DATABASE_URL = appUrl;
  // Kein vom Besitzer-Pool geerbter Cache (Pool wird in @/db auf globalThis gehalten).
  delete (globalThis as { pool?: unknown }).pool;
});

import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { ACTIVE_STANDARD_VERSION, criterion, document, documentVersion, measure } from "@/db/schema";
import { importCatalog } from "@/domain/catalog";
import { setAssessmentStatus, listCriterionHistory } from "@/domain/assessments";
import { addDocumentVersion, createDocument } from "@/domain/documents";
import { createMeasure, setMeasureStatus } from "@/domain/measures";
import { getDashboard } from "@/domain/dashboard";
import { authId } from "@/test/helpers";
import { eq } from "drizzle-orm";

const NOW = new Date("2026-10-08T10:00:00Z");
const pdf = (text: string) => ({ name: "k.pdf", bytes: Buffer.from(`%PDF-1.4\n${text}`) });

let ownerPool: Pool;

beforeAll(() => {
  ownerPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
});
afterAll(async () => {
  await ownerPool.end();
});

describe("core services run end to end as qm_app", () => {
  it("uses the restricted role for the service db", async () => {
    const r = await db.execute<{ u: string }>(sql`SELECT current_user AS u`);
    expect(r.rows[0].u).toBe("qm_app");
  });

  it("covers assessment, document, measure and dashboard flows", async () => {
    // Datenvorbereitung ausschliesslich als Besitzer.
    const ownerDb = drizzle(ownerPool, { schema });
    await ownerPool.query(
      `TRUNCATE measure, evidence_link, document_version, document, deadline, audit_event, criterion_assessment,
       criterion, standard_version, invitation, member, session, account, verification, organization, "user"
       RESTART IDENTITY CASCADE`,
    );
    await importCatalog(ownerDb, {
      standardVersionId: ACTIVE_STANDARD_VERSION,
      label: "t",
      rows: ["7.3.10", "6.3.2"].map((n, i) => ({
        nummer: n, titel: `K ${n}`, kapitel: "Prozess", anerkennung_muss: true, anerkennung_soll: false,
        erneuerung_muss: true, erneuerung_soll: false, sortierung: i + 1,
      })),
    });
    const userId = authId();
    const orgId = authId();
    await ownerDb.insert(schema.user).values({ id: userId, name: "Owner", email: `o-${randomUUID().slice(0, 8)}@example.test`, emailVerified: true });
    await ownerDb.insert(schema.organization).values({ id: orgId, name: "Org", slug: `o-${randomUUID().slice(0, 8)}`, createdAt: new Date() });
    await ownerDb.insert(schema.member).values({ id: authId(), organizationId: orgId, userId, role: "owner", createdAt: new Date() });
    const ctx = { organizationId: orgId, userId, role: "owner" as const };

    const [crit] = await ownerDb.select().from(criterion).where(eq(criterion.number, "7.3.10"));

    // Bewertung (lockt/legt criterion_assessment an, schreibt audit_event)
    const met = await setAssessmentStatus(ctx, crit.id, "met");
    expect(met.status).toBe("met");
    await setAssessmentStatus(ctx, crit.id, "not_applicable", { reason: "Gilt für unseren Betrieb nicht." });

    // Dokument, Version (INSERT-only auf document_version), Verknüpfung
    const { documentId } = await createDocument(ctx, {
      title: "Hygienekonzept", file: pdf("v1"), validUntil: "2026-12-31", criterionNumbers: ["7.3.10"],
    });
    await addDocumentVersion(ctx, documentId, { file: pdf("v2"), validUntil: "2027-12-31" });
    const versions = await ownerDb.select().from(documentVersion).where(eq(documentVersion.documentId, documentId));
    expect(versions).toHaveLength(2);
    expect(await ownerDb.select().from(document).where(eq(document.id, documentId))).toHaveLength(1);

    // Massnahme (INSERT/UPDATE, nie DELETE)
    const { id: measureId } = await createMeasure(ctx, {
      criterionNumber: "7.3.10", title: "Schulung planen", description: null, ownerUserId: userId, dueDate: "2026-11-15",
    });
    const done = await setMeasureStatus(ctx, measureId, "done", NOW);
    expect(done.status).toBe("done");
    expect(await ownerDb.select().from(measure).where(eq(measure.id, measureId))).toHaveLength(1);

    // Lesepfade
    const dash = await getDashboard(ctx, NOW);
    expect(dash.measures.open).toBe(0);
    const history = await listCriterionHistory(ctx, "7.3.10", null);
    expect(history.length).toBeGreaterThan(0);
  });
});
