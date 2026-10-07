import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION, criterion, criterionAssessment, documentVersion } from "@/db/schema";
import { importCatalog } from "./catalog";
import { listAuditEvents } from "./audit";
import {
  addDocumentVersion, createDocument, getEvidenceInfo, getEvidenceStates, getVersionDownload, linkEvidence,
  listCriterionEvidence, listDocuments, listLinkableDocuments, unlinkEvidence,
} from "./documents";
import { ForbiddenError, ValidationError } from "./org-context";
import { listCriterionHistory, setAssessmentStatus } from "./assessments";
import { addMemberTo, ctxFor, makeOrg, resetDb } from "@/test/helpers";

const NOW = new Date("2026-10-08T10:00:00Z");
const pdf = (text: string) => ({ name: "konzept.pdf", bytes: Buffer.from(`%PDF-1.4\n${text}`) });

async function setup() {
  await importCatalog(db, {
    standardVersionId: ACTIVE_STANDARD_VERSION,
    label: "t",
    rows: ["7.3.10", "6.3.2"].map((n, i) => ({
      nummer: n, titel: `K ${n}`, kapitel: "Prozess", anerkennung_muss: true, anerkennung_soll: false,
      erneuerung_muss: true, erneuerung_soll: false, sortierung: i + 1,
    })),
  });
  const a = await makeOrg("doc-a");
  const b = await makeOrg("doc-b");
  return { a, b, ctxA: ctxFor(a.org.id, a.user.id, "owner"), ctxB: ctxFor(b.org.id, b.user.id, "owner") };
}

describe("createDocument", () => {
  beforeEach(resetDb);

  it("creates document, version 1 and links, with one audit event per fact", async () => {
    const { ctxA } = await setup();
    const { documentId } = await createDocument(ctxA, {
      title: "Hygienekonzept", file: pdf("v1"), validUntil: "2026-12-31", criterionNumbers: ["7.3.10"],
    });
    const evidence = await listCriterionEvidence(ctxA, "7.3.10", NOW);
    expect(evidence.state).toBe("current");
    expect(evidence.docs[0]).toMatchObject({ documentId, title: "Hygienekonzept" });
    expect(evidence.docs[0].latest).toMatchObject({ versionNumber: 1, fileName: "konzept.pdf", validUntil: "2026-12-31", current: true });
    expect(evidence.docs[0].latest.sha256).toMatch(/^[0-9a-f]{64}$/);
    const events = await listAuditEvents(ctxA);
    expect(events.map((e) => e.eventType).sort()).toEqual(["document.created", "evidence.linked"]);
    const created = events.find((e) => e.eventType === "document.created")!;
    expect(created.afterJson).toMatchObject({ title: "Hygienekonzept", versionNumber: 1, fileName: "konzept.pdf", criterionNumbers: ["7.3.10"] });
  });

  it("rejects invalid input without writing a row or an audit event", async () => {
    const { ctxA } = await setup();
    const cases: Array<Parameters<typeof createDocument>[1]> = [
      { title: "ab", file: pdf("x"), validUntil: null, criterionNumbers: [] },
      { title: "Gut", file: { name: "x.exe", bytes: Buffer.from("%PDF-1") }, validUntil: null, criterionNumbers: [] },
      { title: "Gut", file: pdf("x"), validUntil: "2026-02-30", criterionNumbers: [] },
      { title: "Gut", file: pdf("x"), validUntil: null, criterionNumbers: ["9.9.9"] },
    ];
    for (const c of cases) await expect(createDocument(ctxA, c)).rejects.toBeInstanceOf(ValidationError);
    expect(await listDocuments(ctxA, NOW)).toEqual([]);
    expect(await listAuditEvents(ctxA)).toEqual([]);
  });

  it("is forbidden for a viewer", async () => {
    const { a } = await setup();
    const v = await addMemberTo(a.org.id, "viewer", "viewer");
    await expect(
      createDocument(ctxFor(a.org.id, v.id, "viewer"), { title: "Hygienekonzept", file: pdf("x"), validUntil: null, criterionNumbers: [] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("never changes an assessment status", async () => {
    const { ctxA } = await setup();
    const [c] = await db.select().from(criterion).where(eq(criterion.number, "7.3.10"));
    await setAssessmentStatus(ctxA, c.id, "open");
    await createDocument(ctxA, { title: "Hygienekonzept", file: pdf("v1"), validUntil: null, criterionNumbers: ["7.3.10"] });
    const [row] = await db.select().from(criterionAssessment).where(eq(criterionAssessment.criterionId, c.id));
    expect(row.status).toBe("open");
  });
});

describe("addDocumentVersion", () => {
  beforeEach(resetDb);

  it("adds immutable versions with gapless numbers and keeps the old ones", async () => {
    const { ctxA } = await setup();
    const { documentId } = await createDocument(ctxA, { title: "Hygienekonzept", file: pdf("v1"), validUntil: "2026-01-01", criterionNumbers: ["7.3.10"] });
    expect((await listCriterionEvidence(ctxA, "7.3.10", NOW)).state).toBe("stale");
    const v2 = await addDocumentVersion(ctxA, documentId, { file: pdf("v2"), validUntil: "2027-06-30" });
    expect(v2.versionNumber).toBe(2);
    const ev = await listCriterionEvidence(ctxA, "7.3.10", NOW);
    expect(ev.state).toBe("current");
    expect(ev.docs[0].versions.map((v) => [v.versionNumber, v.current])).toEqual([[2, true], [1, false]]);
    const events = (await listAuditEvents(ctxA)).filter((e) => e.eventType === "document.version_added");
    expect(events).toHaveLength(1);
    expect(events[0].afterJson).toMatchObject({ versionNumber: 2, criterionNumbers: ["7.3.10"] });
    expect(events[0].beforeJson).toMatchObject({ versionNumber: 1 });
  });

  it("two concurrent uploads produce two versions with gapless numbers", async () => {
    const { ctxA } = await setup();
    const { documentId } = await createDocument(ctxA, { title: "Hygienekonzept", file: pdf("v1"), validUntil: null, criterionNumbers: [] });
    await Promise.all([
      addDocumentVersion(ctxA, documentId, { file: pdf("a"), validUntil: null }),
      addDocumentVersion(ctxA, documentId, { file: pdf("b"), validUntil: null }),
    ]);
    const rows = await db.select({ n: documentVersion.versionNumber }).from(documentVersion).where(eq(documentVersion.documentId, documentId));
    expect(rows.map((r) => r.n).sort()).toEqual([1, 2, 3]);
  });

  it("rejects a foreign or unknown document id and invalid files without side effects", async () => {
    const { ctxA, ctxB } = await setup();
    const { documentId } = await createDocument(ctxA, { title: "Hygienekonzept", file: pdf("v1"), validUntil: null, criterionNumbers: [] });
    await expect(addDocumentVersion(ctxB, documentId, { file: pdf("x"), validUntil: null })).rejects.toBeInstanceOf(ValidationError);
    await expect(addDocumentVersion(ctxA, documentId, { file: { name: "x.pdf", bytes: Buffer.from("kein pdf") }, validUntil: null })).rejects.toBeInstanceOf(ValidationError);
    expect(await db.select().from(documentVersion)).toHaveLength(1);
  });
});

describe("audit event order", () => {
  beforeEach(resetDb);

  it("keeps write order for events of one transaction in the criterion history", async () => {
    const { ctxA } = await setup();
    await createDocument(ctxA, { title: "Hygienekonzept", file: pdf("v1"), validUntil: null, criterionNumbers: ["7.3.10"] });
    const history = await listCriterionHistory(ctxA, "7.3.10", null);
    expect(history.map((h) => h.eventType)).toEqual(["evidence.linked", "document.created"]);
    const events = await listAuditEvents(ctxA);
    expect(events.map((e) => e.eventType)).toEqual(["evidence.linked", "document.created"]);
    // JS-Dates haben Millisekunden-Auflösung, Gleichstand ist möglich; die Reihenfolge selbst ist oben über die DB-Sortierung (Mikrosekunden) belegt.
    expect(history[0].createdAt.getTime()).toBeGreaterThanOrEqual(history[1].createdAt.getTime());
  });
});

describe("linking", () => {
  beforeEach(resetDb);

  it("links and unlinks with audit events and lists linkable documents", async () => {
    const { ctxA } = await setup();
    const { documentId } = await createDocument(ctxA, { title: "Hygienekonzept", file: pdf("v1"), validUntil: null, criterionNumbers: [] });
    expect((await listLinkableDocuments(ctxA, "7.3.10")).map((d) => d.documentId)).toEqual([documentId]);
    const { linkId } = await linkEvidence(ctxA, documentId, "7.3.10");
    expect(await listLinkableDocuments(ctxA, "7.3.10")).toEqual([]);
    await expect(linkEvidence(ctxA, documentId, "7.3.10")).rejects.toBeInstanceOf(ValidationError);
    expect(await unlinkEvidence(ctxA, linkId)).toEqual({ criterionNumber: "7.3.10" });
    expect((await listCriterionEvidence(ctxA, "7.3.10", NOW)).state).toBe("none");
    const types = (await listAuditEvents(ctxA)).map((e) => e.eventType).sort();
    expect(types).toEqual(["document.created", "evidence.linked", "evidence.unlinked"]);
    const unlinked = (await listAuditEvents(ctxA)).find((e) => e.eventType === "evidence.unlinked")!;
    expect(unlinked.beforeJson).toMatchObject({ criterionNumbers: ["7.3.10"] });
  });

  it("listLinkableDocuments is tenant scoped and excludes already linked documents", async () => {
    const { ctxA, ctxB } = await setup();
    const linked = await createDocument(ctxA, { title: "Verknüpft", file: pdf("a"), validUntil: null, criterionNumbers: ["7.3.10"] });
    const free = await createDocument(ctxA, { title: "Frei", file: pdf("b"), validUntil: null, criterionNumbers: [] });
    expect((await listLinkableDocuments(ctxA, "7.3.10")).map((d) => d.documentId)).toEqual([free.documentId]);
    expect((await listLinkableDocuments(ctxA, "6.3.2")).map((d) => d.documentId).sort()).toEqual(
      [linked.documentId, free.documentId].sort(),
    );
    expect(await listLinkableDocuments(ctxB, "7.3.10")).toEqual([]);
    expect(await listLinkableDocuments(ctxB, "6.3.2")).toEqual([]);
  });

  it("refuses unknown criteria and foreign documents or links", async () => {
    const { ctxA, ctxB } = await setup();
    const { documentId } = await createDocument(ctxA, { title: "Hygienekonzept", file: pdf("v1"), validUntil: null, criterionNumbers: ["7.3.10"] });
    await expect(linkEvidence(ctxA, documentId, "9.9.9")).rejects.toBeInstanceOf(ValidationError);
    await expect(linkEvidence(ctxB, documentId, "7.3.10")).rejects.toBeInstanceOf(ValidationError);
    const ev = await listCriterionEvidence(ctxA, "7.3.10", NOW);
    await expect(unlinkEvidence(ctxB, ev.docs[0].linkId)).rejects.toBeInstanceOf(ValidationError);
    expect((await listCriterionEvidence(ctxA, "7.3.10", NOW)).state).toBe("current");
  });
});

describe("reads are tenant scoped", () => {
  beforeEach(resetDb);

  it("organisation B sees no documents, evidence, states or downloads of organisation A", async () => {
    const { ctxA, ctxB } = await setup();
    await createDocument(ctxA, { title: "Hygienekonzept", file: pdf("geheim"), validUntil: null, criterionNumbers: ["7.3.10"] });
    const [v] = await db.select().from(documentVersion);
    expect(await listDocuments(ctxB, NOW)).toEqual([]);
    expect((await listCriterionEvidence(ctxB, "7.3.10", NOW)).state).toBe("none");
    expect((await getEvidenceStates(ctxB, NOW)).size).toBe(0);
    expect(await getVersionDownload(ctxB, v.id)).toBeNull();
    expect(await getVersionDownload(ctxA, v.id)).toMatchObject({ fileName: "konzept.pdf", mimeType: "application/pdf" });
    expect((await getEvidenceStates(ctxA, NOW)).get("7.3.10")).toBe("current");
  });

  it("a viewer may read and download but not write", async () => {
    const { a, ctxA } = await setup();
    await createDocument(ctxA, { title: "Hygienekonzept", file: pdf("x"), validUntil: null, criterionNumbers: ["7.3.10"] });
    const v = await addMemberTo(a.org.id, "viewer", "viewer");
    const ctxV = ctxFor(a.org.id, v.id, "viewer");
    expect(await listDocuments(ctxV, NOW)).toHaveLength(1);
    const [ver] = await db.select().from(documentVersion);
    expect(await getVersionDownload(ctxV, ver.id)).not.toBeNull();
    await expect(linkEvidence(ctxV, (await listDocuments(ctxV, NOW))[0].documentId, "6.3.2")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("getEvidenceInfo", () => {
  beforeEach(resetDb);

  it("reports state and the latest expiry among the newest versions", async () => {
    const { ctxA } = await setup();
    const d1 = await createDocument(ctxA, { title: "Konzept eins", file: pdf("a"), validUntil: "2026-12-31", criterionNumbers: ["7.3.10"] });
    await addDocumentVersion(ctxA, d1.documentId, { file: pdf("a2"), validUntil: "2027-03-01" });
    await createDocument(ctxA, { title: "Konzept zwei", file: pdf("b"), validUntil: "2027-09-15", criterionNumbers: ["7.3.10"] });
    await createDocument(ctxA, { title: "Konzept drei", file: pdf("c"), validUntil: null, criterionNumbers: ["6.3.2"] });
    await createDocument(ctxA, { title: "Konzept vier", file: pdf("d"), validUntil: "2026-01-01", criterionNumbers: [] });
    const info = await getEvidenceInfo(ctxA, NOW);
    expect(info.get("7.3.10")).toEqual({ state: "current", latestValidUntil: "2027-09-15" });
    expect(info.get("6.3.2")).toEqual({ state: "current", latestValidUntil: null });
    expect(info.size).toBe(2);
  });

  it("is stale with the latest (past) expiry when every newest version has expired", async () => {
    const { ctxA } = await setup();
    const d = await createDocument(ctxA, { title: "Konzept eins", file: pdf("a"), validUntil: "2027-12-31", criterionNumbers: ["7.3.10"] });
    await addDocumentVersion(ctxA, d.documentId, { file: pdf("a2"), validUntil: "2026-02-01" });
    expect((await getEvidenceInfo(ctxA, NOW)).get("7.3.10")).toEqual({ state: "stale", latestValidUntil: "2026-02-01" });
  });

  it("is tenant scoped", async () => {
    const { ctxA, ctxB } = await setup();
    await createDocument(ctxA, { title: "Konzept eins", file: pdf("a"), validUntil: null, criterionNumbers: ["7.3.10"] });
    expect((await getEvidenceInfo(ctxB, NOW)).size).toBe(0);
  });
});
