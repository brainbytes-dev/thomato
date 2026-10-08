import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION, auditEvent, criterion, criterionAssessment, documentVersion } from "@/db/schema";
import { setAssessmentDueDate, setAssessmentStatus } from "./assessments";
import { listAuditEvents } from "./audit";
import { importCatalog } from "./catalog";
import {
  addDocumentVersion, createDocument, getVersionDownload, linkEvidence, listDocuments, unlinkEvidence,
} from "./documents";
import { MAX_FILE_BYTES } from "./file-validation";
import { ForbiddenError, ValidationError } from "./org-context";
import { addMemberTo, ctxFor, makeOrg, resetDb } from "@/test/helpers";

const pdf = (text: string) => ({ name: "konzept.pdf", bytes: Buffer.from(`%PDF-1.4\n${text}`) });

async function setup() {
  await importCatalog(db, {
    standardVersionId: ACTIVE_STANDARD_VERSION,
    label: "t",
    rows: [
      { nummer: "7.3.10", titel: "K", kapitel: "Prozess", anerkennung_muss: true, anerkennung_soll: false,
        erneuerung_muss: true, erneuerung_soll: false, sortierung: 1 },
    ],
  });
  const [c] = await db.select().from(criterion).where(eq(criterion.standardVersionId, ACTIVE_STANDARD_VERSION));
  const a = await makeOrg("err-a");
  const b = await makeOrg("err-b");
  const viewer = await addMemberTo(a.org.id, "err-viewer", "viewer");
  const reviewer = await addMemberTo(a.org.id, "err-reviewer", "reviewer");
  return {
    c,
    ctxA: ctxFor(a.org.id, a.user.id, "owner"),
    ctxB: ctxFor(b.org.id, b.user.id, "owner"),
    viewerCtx: ctxFor(a.org.id, viewer.id, "viewer"),
    reviewerCtx: ctxFor(a.org.id, reviewer.id, "reviewer"),
  };
}

async function rejection(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof ValidationError) return e.message;
    throw e;
  }
  throw new Error("expected a ValidationError");
}

describe("foreign, unknown and malformed ids give the identical message", () => {
  beforeEach(resetDb);

  it("addDocumentVersion, linkEvidence and unlinkEvidence", async () => {
    const { ctxA, ctxB } = await setup();
    const { documentId } = await createDocument(ctxA, {
      title: "Hygienekonzept", file: pdf("v1"), validUntil: null, criterionNumbers: ["7.3.10"],
    });
    const [link] = await db.select().from((await import("@/db/schema")).evidenceLink);
    const unknown = randomUUID();
    const add = (id: string) => rejection(addDocumentVersion(ctxB, id, { file: pdf("x"), validUntil: null }));
    const lnk = (id: string) => rejection(linkEvidence(ctxB, id, "7.3.10"));
    const unl = (id: string) => rejection(unlinkEvidence(ctxB, id));
    for (const f of [add, lnk]) {
      const foreign = await f(documentId);
      expect(foreign).toBe(await f(unknown));
      expect(foreign).toBe(await f("nicht-uuid"));
      expect(foreign).toBe("Das Dokument wurde nicht gefunden.");
    }
    const foreignLink = await unl(link.id);
    expect(foreignLink).toBe(await unl(unknown));
    expect(foreignLink).toBe(await unl("nicht-uuid"));
    expect(foreignLink).toBe("Die Verknüpfung wurde nicht gefunden.");
    expect(await listAuditEvents(ctxB)).toEqual([]);
    expect(await db.select().from(documentVersion)).toHaveLength(1);
  });

  it("getVersionDownload returns null for all three", async () => {
    const { ctxA, ctxB } = await setup();
    const { versionId } = await createDocument(ctxA, { title: "Konzept", file: pdf("v1"), validUntil: null, criterionNumbers: [] });
    for (const id of [versionId, randomUUID(), "nicht-uuid", ""]) expect(await getVersionDownload(ctxB, id)).toBeNull();
  });

  it("an unknown criterion id is a ValidationError, never a database error", async () => {
    const { ctxA } = await setup();
    const unknown = randomUUID();
    const status = await rejection(setAssessmentStatus(ctxA, unknown, "met"));
    expect(status).toBe("Das Kriterium wurde nicht gefunden.");
    expect(await rejection(setAssessmentDueDate(ctxA, unknown, "2026-11-01"))).toBe("Das Kriterium wurde nicht gefunden.");
    expect(await rejection(setAssessmentStatus(ctxA, "nicht-uuid", "met"))).toBe("Das Kriterium wurde nicht gefunden.");
    expect(await db.select().from(criterionAssessment)).toHaveLength(0);
    expect(await listAuditEvents(ctxA)).toEqual([]);
  });
});

describe("invalid input leaves no trace", () => {
  beforeEach(resetDb);

  it("rejects bad uploads for a new version without a new row or audit event", async () => {
    const { ctxA } = await setup();
    const { documentId } = await createDocument(ctxA, { title: "Konzept", file: pdf("v1"), validUntil: null, criterionNumbers: [] });
    const before = (await listAuditEvents(ctxA)).length;
    const huge = { name: "gross.pdf", bytes: Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(MAX_FILE_BYTES)]) };
    const bad = [
      { name: "x.exe", bytes: Buffer.from("MZ") },
      { name: "x.pdf", bytes: Buffer.from("kein pdf") },
      { name: "x.pdf", bytes: Buffer.alloc(0) },
      { name: "keine-endung", bytes: Buffer.from("%PDF-1.4") },
      huge,
    ];
    for (const file of bad) {
      const message = await rejection(addDocumentVersion(ctxA, documentId, { file, validUntil: null }));
      expect(message).toMatch(/[äöüÄÖÜ]|Datei|Dateiendung|leer|gross|grösser/);
      expect(message).not.toMatch(/Error|undefined|\[object/);
    }
    expect(await rejection(addDocumentVersion(ctxA, documentId, { file: pdf("x"), validUntil: "31.12.2026" }))).toBe("Das Datum bei «Gültig bis» ist ungültig.");
    expect(await db.select().from(documentVersion)).toHaveLength(1);
    expect((await listAuditEvents(ctxA)).length).toBe(before);
  });

  it("rejects an invalid due date before writing, with a German message", async () => {
    const { c, ctxA } = await setup();
    for (const d of ["2026-02-30", "31.12.2026", "morgen", "", "2026-13-01"]) {
      expect(await rejection(setAssessmentDueDate(ctxA, c.id, d))).toBe("Die Frist ist ungültig.");
    }
    expect(await db.select().from(criterionAssessment)).toHaveLength(0);
    expect(await listAuditEvents(ctxA)).toEqual([]);
  });

  it("an invalid upload creates no document at all", async () => {
    const { ctxA } = await setup();
    await expect(
      createDocument(ctxA, { title: "Gut", file: { name: "x.pdf", bytes: Buffer.alloc(0) }, validUntil: null, criterionNumbers: [] }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await listDocuments(ctxA, new Date())).toEqual([]);
    expect(await db.select().from(auditEvent)).toEqual([]);
  });
});

describe("roles are enforced in the service layer", () => {
  beforeEach(resetDb);

  it("viewer cannot write documents or assessments; viewer and reviewer cannot read the audit log", async () => {
    const { c, ctxA, viewerCtx, reviewerCtx } = await setup();
    const { documentId } = await createDocument(ctxA, { title: "Konzept", file: pdf("v1"), validUntil: null, criterionNumbers: [] });
    const eventsBefore = (await listAuditEvents(ctxA)).length;
    {
      const ctx = viewerCtx;
      await expect(createDocument(ctx, { title: "Neu", file: pdf("x"), validUntil: null, criterionNumbers: [] })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(addDocumentVersion(ctx, documentId, { file: pdf("x"), validUntil: null })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(linkEvidence(ctx, documentId, "7.3.10")).rejects.toBeInstanceOf(ForbiddenError);
      await expect(setAssessmentStatus(ctx, c.id, "met")).rejects.toBeInstanceOf(ForbiddenError);
      await expect(setAssessmentDueDate(ctx, c.id, "2026-11-01")).rejects.toBeInstanceOf(ForbiddenError);
    }
    await expect(listAuditEvents(reviewerCtx)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listAuditEvents(viewerCtx)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await listAuditEvents(ctxA)).length).toBe(eventsBefore);
  });
});

describe("concurrent saves keep one consistent audit chain", () => {
  beforeEach(resetDb);

  it("six parallel status and due date saves chain before to after without gaps", async () => {
    for (let round = 0; round < 3; round += 1) {
      await resetDb();
      const { c, ctxA } = await setup();
      const statuses = ["open", "critical", "met", "open", "critical", "met"] as const;
      await Promise.all(statuses.map((s) => setAssessmentStatus(ctxA, c.id, s)));
      const events = (await listAuditEvents(ctxA)).reverse();
      expect(events).toHaveLength(6);
      const tails = events.map((e) => ({ b: (e.beforeJson as { status: string }).status, a: (e.afterJson as { status: string }).status }));
      expect(tails[0].b).toBe("not_assessed");
      for (let i = 1; i < tails.length; i += 1) expect(tails[i].b).toBe(tails[i - 1].a);
      const [row] = await db.select().from(criterionAssessment);
      expect(row.status).toBe(tails[5].a);
    }
  });

  it("parallel version uploads and a link keep gapless versions and exactly one event each", async () => {
    const { ctxA } = await setup();
    const { documentId } = await createDocument(ctxA, { title: "Konzept", file: pdf("v1"), validUntil: null, criterionNumbers: [] });
    await Promise.all([
      addDocumentVersion(ctxA, documentId, { file: pdf("a"), validUntil: null }),
      addDocumentVersion(ctxA, documentId, { file: pdf("b"), validUntil: null }),
      linkEvidence(ctxA, documentId, "7.3.10"),
    ]);
    const versions = await db.select({ n: documentVersion.versionNumber }).from(documentVersion);
    expect(versions.map((v) => v.n).sort()).toEqual([1, 2, 3]);
    const events = await listAuditEvents(ctxA);
    expect(events.filter((e) => e.eventType === "document.version_added")).toHaveLength(2);
    expect(events.filter((e) => e.eventType === "evidence.linked")).toHaveLength(1);
  });
});
