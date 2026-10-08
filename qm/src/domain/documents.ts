import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, notInArray } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { ACTIVE_STANDARD_VERSION, criterion, document, documentVersion, evidenceLink, user } from "@/db/schema";
import { insertAuditEvent, withAudit } from "./audit";
import { isValidIsoDate, zurichDate } from "./dates";
import { evidenceStateOf, isCurrent, type EvidenceState } from "./evidence";
import { validateUpload } from "./file-validation";
import { assertCan, ValidationError, type OrgContext } from "./org-context";

export type UploadInput = { name: string; bytes: Uint8Array };

export type VersionView = {
  id: string;
  versionNumber: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  validUntil: string | null;
  uploadedByName: string | null;
  createdAt: Date;
  current: boolean;
};

export type EvidenceDoc = {
  documentId: string;
  linkId: string;
  title: string;
  latest: VersionView;
  versions: VersionView[];
  state: "current" | "stale";
};

export type DocumentRow = {
  documentId: string;
  title: string;
  latest: VersionView;
  versionCount: number;
  criteria: string[];
  state: "current" | "stale";
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TITLE_MIN = 3;
const TITLE_MAX = 120;

function validateTitle(raw: string): string {
  const title = raw.trim();
  const length = [...title].length;
  if (length < TITLE_MIN || length > TITLE_MAX) {
    throw new ValidationError(`Der Titel muss zwischen ${TITLE_MIN} und ${TITLE_MAX} Zeichen lang sein.`);
  }
  return title;
}

function validateValidUntil(value: string | null): string | null {
  if (value !== null && !isValidIsoDate(value)) throw new ValidationError("Das Datum bei «Gültig bis» ist ungültig.");
  return value;
}

function validateFile(file: UploadInput) {
  const r = validateUpload(file);
  if (!r.ok) throw new ValidationError(r.error);
  return r.file;
}

async function assertCriteriaExist(numbers: readonly string[]): Promise<string[]> {
  const unique = [...new Set(numbers)];
  if (unique.length === 0) return [];
  const found = await db
    .select({ number: criterion.number })
    .from(criterion)
    .where(and(eq(criterion.standardVersionId, ACTIVE_STANDARD_VERSION), inArray(criterion.number, unique)));
  if (found.length !== unique.length) throw new ValidationError("Mindestens ein Kriterium wurde nicht gefunden.");
  return unique;
}

async function linkedNumbers(tx: Tx, ctx: OrgContext, documentId: string): Promise<string[]> {
  const rows = await tx
    .select({ number: evidenceLink.criterionNumber })
    .from(evidenceLink)
    .where(
      and(
        eq(evidenceLink.organizationId, ctx.organizationId),
        eq(evidenceLink.documentId, documentId),
        eq(evidenceLink.standardVersionId, ACTIVE_STANDARD_VERSION),
      ),
    )
    .orderBy(asc(evidenceLink.criterionNumber));
  return rows.map((r) => r.number);
}

export async function createDocument(
  ctx: OrgContext,
  input: { title: string; file: UploadInput; validUntil: string | null; criterionNumbers: readonly string[] },
): Promise<{ documentId: string; versionId: string }> {
  assertCan(ctx, "document", "write");
  const title = validateTitle(input.title);
  const validUntil = validateValidUntil(input.validUntil);
  const file = validateFile(input.file);
  const numbers = await assertCriteriaExist(input.criterionNumbers);
  const content = Buffer.from(input.file.bytes);
  const sha256 = createHash("sha256").update(content).digest("hex");

  return db.transaction(async (tx) => {
    const [doc] = await tx
      .insert(document)
      .values({ organizationId: ctx.organizationId, title, createdBy: ctx.userId })
      .returning({ id: document.id });
    const [version] = await tx
      .insert(documentVersion)
      .values({
        organizationId: ctx.organizationId,
        documentId: doc.id,
        versionNumber: 1,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.size,
        sha256,
        content,
        validUntil,
        uploadedBy: ctx.userId,
      })
      .returning({ id: documentVersion.id });
    // Reihenfolge = Schreibreihenfolge: erst das Dokument, dann die Verknüpfungen (Verlauf sortiert nach created_at).
    await insertAuditEvent(tx, ctx, {
      eventType: "document.created",
      entityType: "document",
      entityId: doc.id,
      before: null,
      after: { title, versionNumber: 1, fileName: file.fileName, validUntil, criterionNumbers: numbers },
    });
    for (const number of numbers) {
      const [link] = await tx
        .insert(evidenceLink)
        .values({
          organizationId: ctx.organizationId,
          documentId: doc.id,
          standardVersionId: ACTIVE_STANDARD_VERSION,
          criterionNumber: number,
          linkedBy: ctx.userId,
        })
        .returning({ id: evidenceLink.id });
      await insertAuditEvent(tx, ctx, {
        eventType: "evidence.linked",
        entityType: "evidence_link",
        entityId: link.id,
        before: null,
        after: { title, documentId: doc.id, criterionNumbers: [number] },
      });
    }
    return { documentId: doc.id, versionId: version.id };
  });
}

export async function addDocumentVersion(
  ctx: OrgContext,
  documentId: string,
  input: { file: UploadInput; validUntil: string | null },
): Promise<{ versionId: string; versionNumber: number }> {
  assertCan(ctx, "document", "write");
  const validUntil = validateValidUntil(input.validUntil);
  const file = validateFile(input.file);
  if (!UUID.test(documentId)) throw new ValidationError("Das Dokument wurde nicht gefunden.");
  const content = Buffer.from(input.file.bytes);
  const sha256 = createHash("sha256").update(content).digest("hex");

  return withAudit(ctx, async (tx) => {
    // Die Zeilensperre serialisiert gleichzeitige Uploads, damit die Versionsnummern lückenlos bleiben.
    const [doc] = await tx
      .select({ id: document.id, title: document.title })
      .from(document)
      .where(and(eq(document.id, documentId), eq(document.organizationId, ctx.organizationId)))
      .for("update");
    if (!doc) throw new ValidationError("Das Dokument wurde nicht gefunden.");
    const [latest] = await tx
      .select({ n: documentVersion.versionNumber })
      .from(documentVersion)
      .where(and(eq(documentVersion.documentId, doc.id), eq(documentVersion.organizationId, ctx.organizationId)))
      .orderBy(desc(documentVersion.versionNumber))
      .limit(1);
    const previous = latest?.n ?? 0;
    const versionNumber = previous + 1;
    const [version] = await tx
      .insert(documentVersion)
      .values({
        organizationId: ctx.organizationId,
        documentId: doc.id,
        versionNumber,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.size,
        sha256,
        content,
        validUntil,
        uploadedBy: ctx.userId,
      })
      .returning({ id: documentVersion.id });
    const numbers = await linkedNumbers(tx, ctx, doc.id);
    return {
      result: { versionId: version.id, versionNumber },
      event: {
        eventType: "document.version_added",
        entityType: "document",
        entityId: doc.id,
        before: { versionNumber: previous },
        after: { title: doc.title, versionNumber, fileName: file.fileName, validUntil, criterionNumbers: numbers },
      },
    };
  });
}

export async function linkEvidence(
  ctx: OrgContext,
  documentId: string,
  criterionNumber: string,
): Promise<{ linkId: string }> {
  assertCan(ctx, "document", "write");
  if (!UUID.test(documentId)) throw new ValidationError("Das Dokument wurde nicht gefunden.");
  await assertCriteriaExist([criterionNumber]);

  return withAudit(ctx, async (tx) => {
    const [doc] = await tx
      .select({ id: document.id, title: document.title })
      .from(document)
      .where(and(eq(document.id, documentId), eq(document.organizationId, ctx.organizationId)))
      .for("update");
    if (!doc) throw new ValidationError("Das Dokument wurde nicht gefunden.");
    const [existing] = await tx
      .select({ id: evidenceLink.id })
      .from(evidenceLink)
      .where(
        and(
          eq(evidenceLink.organizationId, ctx.organizationId),
          eq(evidenceLink.documentId, doc.id),
          eq(evidenceLink.standardVersionId, ACTIVE_STANDARD_VERSION),
          eq(evidenceLink.criterionNumber, criterionNumber),
        ),
      );
    if (existing) throw new ValidationError("Das Dokument ist bereits mit diesem Kriterium verknüpft.");
    const [link] = await tx
      .insert(evidenceLink)
      .values({
        organizationId: ctx.organizationId,
        documentId: doc.id,
        standardVersionId: ACTIVE_STANDARD_VERSION,
        criterionNumber,
        linkedBy: ctx.userId,
      })
      .returning({ id: evidenceLink.id });
    return {
      result: { linkId: link.id },
      event: {
        eventType: "evidence.linked",
        entityType: "evidence_link",
        entityId: link.id,
        before: null,
        after: { title: doc.title, documentId: doc.id, criterionNumbers: [criterionNumber] },
      },
    };
  });
}

export async function unlinkEvidence(ctx: OrgContext, linkId: string): Promise<{ criterionNumber: string }> {
  assertCan(ctx, "document", "write");
  if (!UUID.test(linkId)) throw new ValidationError("Die Verknüpfung wurde nicht gefunden.");

  return withAudit(ctx, async (tx) => {
    const [row] = await tx
      .select({
        id: evidenceLink.id,
        documentId: evidenceLink.documentId,
        number: evidenceLink.criterionNumber,
        title: document.title,
      })
      .from(evidenceLink)
      .innerJoin(
        document,
        and(eq(document.id, evidenceLink.documentId), eq(document.organizationId, evidenceLink.organizationId)),
      )
      .where(and(eq(evidenceLink.id, linkId), eq(evidenceLink.organizationId, ctx.organizationId)))
      .for("update", { of: evidenceLink });
    if (!row) throw new ValidationError("Die Verknüpfung wurde nicht gefunden.");
    await tx
      .delete(evidenceLink)
      .where(and(eq(evidenceLink.id, row.id), eq(evidenceLink.organizationId, ctx.organizationId)));
    return {
      result: { criterionNumber: row.number },
      event: {
        eventType: "evidence.unlinked",
        entityType: "evidence_link",
        entityId: row.id,
        before: { title: row.title, documentId: row.documentId, criterionNumbers: [row.number] },
        after: null,
      },
    };
  });
}

/** Versionen (ohne Inhalt) der Dokumente, neueste zuerst, gruppiert nach Dokument. */
async function loadVersions(
  ctx: OrgContext,
  documentIds: string[],
  today: string,
): Promise<Map<string, VersionView[]>> {
  const out = new Map<string, VersionView[]>();
  if (documentIds.length === 0) return out;
  const rows = await db
    .select({
      id: documentVersion.id,
      documentId: documentVersion.documentId,
      versionNumber: documentVersion.versionNumber,
      fileName: documentVersion.fileName,
      mimeType: documentVersion.mimeType,
      sizeBytes: documentVersion.sizeBytes,
      sha256: documentVersion.sha256,
      validUntil: documentVersion.validUntil,
      uploadedByName: user.name,
      createdAt: documentVersion.createdAt,
    })
    .from(documentVersion)
    .leftJoin(user, eq(user.id, documentVersion.uploadedBy))
    .where(
      and(eq(documentVersion.organizationId, ctx.organizationId), inArray(documentVersion.documentId, documentIds)),
    )
    .orderBy(asc(documentVersion.documentId), desc(documentVersion.versionNumber));
  for (const { documentId, ...v } of rows) {
    const list = out.get(documentId) ?? [];
    list.push({ ...v, current: isCurrent(v.validUntil, today) });
    out.set(documentId, list);
  }
  return out;
}

export async function listCriterionEvidence(
  ctx: OrgContext,
  number: string,
  now: Date,
): Promise<{ docs: EvidenceDoc[]; state: EvidenceState }> {
  assertCan(ctx, "document", "read");
  const today = zurichDate(now);
  const links = await db
    .select({ linkId: evidenceLink.id, documentId: document.id, title: document.title })
    .from(evidenceLink)
    .innerJoin(
      document,
      and(eq(document.id, evidenceLink.documentId), eq(document.organizationId, evidenceLink.organizationId)),
    )
    .where(
      and(
        eq(evidenceLink.organizationId, ctx.organizationId),
        eq(evidenceLink.standardVersionId, ACTIVE_STANDARD_VERSION),
        eq(evidenceLink.criterionNumber, number),
      ),
    )
    .orderBy(asc(document.title), asc(document.id));
  const versions = await loadVersions(
    ctx,
    links.map((l) => l.documentId),
    today,
  );
  const docs: EvidenceDoc[] = [];
  for (const l of links) {
    const vs = versions.get(l.documentId);
    if (!vs || vs.length === 0) continue;
    docs.push({
      documentId: l.documentId,
      linkId: l.linkId,
      title: l.title,
      latest: vs[0],
      versions: vs,
      state: vs[0].current ? "current" : "stale",
    });
  }
  return { docs, state: evidenceStateOf(docs.map((d) => d.latest.validUntil), today) };
}

export async function listDocuments(ctx: OrgContext, now: Date): Promise<DocumentRow[]> {
  assertCan(ctx, "document", "read");
  const today = zurichDate(now);
  const docs = await db
    .select({ id: document.id, title: document.title })
    .from(document)
    .where(eq(document.organizationId, ctx.organizationId))
    .orderBy(asc(document.title), asc(document.id));
  const ids = docs.map((d) => d.id);
  const versions = await loadVersions(ctx, ids, today);
  const links =
    ids.length === 0
      ? []
      : await db
          .select({ documentId: evidenceLink.documentId, number: evidenceLink.criterionNumber })
          .from(evidenceLink)
          .where(
            and(
              eq(evidenceLink.organizationId, ctx.organizationId),
              eq(evidenceLink.standardVersionId, ACTIVE_STANDARD_VERSION),
              inArray(evidenceLink.documentId, ids),
            ),
          )
          .orderBy(asc(evidenceLink.criterionNumber));
  const criteriaByDoc = new Map<string, string[]>();
  for (const l of links) criteriaByDoc.set(l.documentId, [...(criteriaByDoc.get(l.documentId) ?? []), l.number]);
  const rows: DocumentRow[] = [];
  for (const d of docs) {
    const vs = versions.get(d.id);
    if (!vs || vs.length === 0) continue;
    rows.push({
      documentId: d.id,
      title: d.title,
      latest: vs[0],
      versionCount: vs.length,
      criteria: criteriaByDoc.get(d.id) ?? [],
      state: vs[0].current ? "current" : "stale",
    });
  }
  return rows;
}

export async function listLinkableDocuments(
  ctx: OrgContext,
  number: string,
): Promise<{ documentId: string; title: string }[]> {
  assertCan(ctx, "document", "read");
  const linked = db
    .select({ id: evidenceLink.documentId })
    .from(evidenceLink)
    .where(
      and(
        eq(evidenceLink.organizationId, ctx.organizationId),
        eq(evidenceLink.standardVersionId, ACTIVE_STANDARD_VERSION),
        eq(evidenceLink.criterionNumber, number),
      ),
    );
  return db
    .select({ documentId: document.id, title: document.title })
    .from(document)
    .where(and(eq(document.organizationId, ctx.organizationId), notInArray(document.id, linked)))
    .orderBy(asc(document.title), asc(document.id));
}

/** Zustand und spätestes Ablaufdatum der neuesten Versionen je Kriterium, nur für Kriterien mit Verknüpfung. */
export async function getEvidenceInfo(
  ctx: OrgContext,
  now: Date,
): Promise<Map<string, { state: EvidenceState; latestValidUntil: string | null }>> {
  assertCan(ctx, "document", "read");
  const today = zurichDate(now);
  const links = await db
    .select({ documentId: evidenceLink.documentId, number: evidenceLink.criterionNumber })
    .from(evidenceLink)
    .where(
      and(
        eq(evidenceLink.organizationId, ctx.organizationId),
        eq(evidenceLink.standardVersionId, ACTIVE_STANDARD_VERSION),
      ),
    );
  const out = new Map<string, { state: EvidenceState; latestValidUntil: string | null }>();
  if (links.length === 0) return out;
  const versions = await loadVersions(ctx, [...new Set(links.map((l) => l.documentId))], today);
  const byNumber = new Map<string, (string | null)[]>();
  for (const l of links) {
    const latest = versions.get(l.documentId)?.[0];
    if (!latest) continue;
    byNumber.set(l.number, [...(byNumber.get(l.number) ?? []), latest.validUntil]);
  }
  for (const [number, untils] of byNumber) {
    const dated = untils.filter((u): u is string => u !== null);
    out.set(number, {
      state: evidenceStateOf(untils, today),
      latestValidUntil: dated.length === 0 ? null : dated.reduce((a, b) => (a >= b ? a : b)),
    });
  }
  return out;
}

export async function getEvidenceStates(ctx: OrgContext, now: Date): Promise<Map<string, EvidenceState>> {
  const info = await getEvidenceInfo(ctx, now);
  return new Map([...info].map(([number, v]) => [number, v.state]));
}

export async function getVersionDownload(
  ctx: OrgContext,
  versionId: string,
): Promise<{ fileName: string; mimeType: string; content: Buffer } | null> {
  assertCan(ctx, "document", "read");
  if (!UUID.test(versionId)) return null;
  const [row] = await db
    .select({
      fileName: documentVersion.fileName,
      mimeType: documentVersion.mimeType,
      content: documentVersion.content,
    })
    .from(documentVersion)
    .where(and(eq(documentVersion.id, versionId), eq(documentVersion.organizationId, ctx.organizationId)));
  return row ?? null;
}
