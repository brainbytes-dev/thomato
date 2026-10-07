import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION, document, documentVersion, evidenceLink } from "@/db/schema";
import { importCatalog } from "@/domain/catalog";
import { makeOrg, resetDb } from "@/test/helpers";

function errorText(e: unknown): string {
  const err = e as { message?: string; cause?: { message?: string } };
  return `${err.message ?? ""} ${err.cause?.message ?? ""}`;
}

async function setup() {
  await importCatalog(db, {
    standardVersionId: ACTIVE_STANDARD_VERSION,
    label: "t",
    rows: [{ nummer: "7.3.10", titel: "Hygiene", kapitel: "Prozess", anerkennung_muss: true, anerkennung_soll: false, erneuerung_muss: true, erneuerung_soll: false, sortierung: 1 }],
  });
  const a = await makeOrg("ds-a");
  const b = await makeOrg("ds-b");
  const [doc] = await db.insert(document).values({ organizationId: a.org.id, title: "Hygienekonzept", createdBy: a.user.id }).returning();
  const [ver] = await db
    .insert(documentVersion)
    .values({
      organizationId: a.org.id, documentId: doc.id, versionNumber: 1, fileName: "h.pdf", mimeType: "application/pdf",
      sizeBytes: 3, sha256: "x".repeat(64), content: Buffer.from("abc"), uploadedBy: a.user.id,
    })
    .returning();
  return { a, b, doc, ver };
}

describe("document tables", () => {
  beforeEach(resetDb);

  it("versions are immutable: UPDATE and DELETE are rejected by the database", async () => {
    const { ver } = await setup();
    await expect(db.execute(sql`UPDATE document_version SET file_name = 'x.pdf' WHERE id = ${ver.id}`)).rejects.toSatisfy((e) => /immutable/i.test(errorText(e)));
    await expect(db.execute(sql`DELETE FROM document_version WHERE id = ${ver.id}`)).rejects.toSatisfy((e) => /immutable/i.test(errorText(e)));
  });

  it("version numbers are unique per document", async () => {
    const { a, doc } = await setup();
    await expect(
      db.insert(documentVersion).values({
        organizationId: a.org.id, documentId: doc.id, versionNumber: 1, fileName: "h2.pdf", mimeType: "application/pdf",
        sizeBytes: 3, sha256: "y".repeat(64), content: Buffer.from("abc"), uploadedBy: a.user.id,
      }),
    ).rejects.toSatisfy((e) => /unique|duplicate/i.test(errorText(e)));
  });

  it("a version cannot reference a document of another organisation (composite foreign key)", async () => {
    const { b, doc } = await setup();
    await expect(
      db.insert(documentVersion).values({
        organizationId: b.org.id, documentId: doc.id, versionNumber: 2, fileName: "x.pdf", mimeType: "application/pdf",
        sizeBytes: 3, sha256: "z".repeat(64), content: Buffer.from("abc"), uploadedBy: b.user.id,
      }),
    ).rejects.toSatisfy((e) => /foreign key/i.test(errorText(e)));
  });

  it("an evidence link cannot cross organisations and needs an existing criterion", async () => {
    const { a, b, doc } = await setup();
    await expect(
      db.insert(evidenceLink).values({ organizationId: b.org.id, documentId: doc.id, standardVersionId: ACTIVE_STANDARD_VERSION, criterionNumber: "7.3.10", linkedBy: b.user.id }),
    ).rejects.toSatisfy((e) => /foreign key/i.test(errorText(e)));
    await expect(
      db.insert(evidenceLink).values({ organizationId: a.org.id, documentId: doc.id, standardVersionId: ACTIVE_STANDARD_VERSION, criterionNumber: "9.9.9", linkedBy: a.user.id }),
    ).rejects.toSatisfy((e) => /foreign key/i.test(errorText(e)));
    expect(await db.select().from(evidenceLink).where(eq(evidenceLink.organizationId, b.org.id))).toHaveLength(0);
    const [ok] = await db
      .insert(evidenceLink)
      .values({ organizationId: a.org.id, documentId: doc.id, standardVersionId: ACTIVE_STANDARD_VERSION, criterionNumber: "7.3.10", linkedBy: a.user.id })
      .returning();
    expect(ok.id).toBeDefined();
    await expect(
      db.insert(evidenceLink).values({ organizationId: a.org.id, documentId: doc.id, standardVersionId: ACTIVE_STANDARD_VERSION, criterionNumber: "7.3.10", linkedBy: a.user.id }),
    ).rejects.toSatisfy((e) => /unique|duplicate/i.test(errorText(e)));
  });
});
