# QM Nachweise und Dokumente Implementation Plan (Plan 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Demo-Story «veralteter Nachweis, neuer Upload, neue Dokumentversion, Kriterium und Dashboard sichtbar verändert» läuft echt: Dokumente werden versioniert (nie überschrieben), mandantengetrennt gespeichert, mit Kriterien verknüpft und auditiert. Die Oberfläche unterscheidet klar «Dokument vorhanden», «Dokument aktuell» und «Kriterium erfüllt». Ein Upload ändert den Status eines Kriteriums nie von selbst.

**Architecture:** Neue Tabellen `document`, `document_version` (unveränderlich, Datei-Bytes in Postgres) und `evidence_link` (Dokument zu Kriterium). Reine Fachfunktionen für Dateiprüfung und Nachweiszustand. Mandantengebundene Services mit `withAudit`; Dashboard und Kriterienliste lesen den Nachweiszustand mit. Uploads laufen über Server Actions, Downloads über einen Route Handler mit Berechtigungsprüfung.

**Tech Stack:** Wie Plan 3 (Next.js 16 Cache Components, Drizzle, Better Auth, Vitest gegen echtes Postgres, Zod, pnpm).

**Spec:** `docs/implementation/BUILD_PLAN_TO_2026-11-17.md`, Plan 3 (Kriterium-Detail, Audit-Muster), Layout-Spec `~/Downloads/Thomato_IVR_QM_Dashboard_Layout.md` und die Vorgaben von Henrik vom 2026-10-08 (siehe Global Constraints). Massnahmen und Fristenpflege folgen danach in Plan 5.

## Global Constraints

- Alle Constraints aus Plan 1 bis 3 gelten weiter (pnpm, kein `any`, kein `db:push`, `organization_id NOT NULL`, Rechte nur aus `src/domain/rights.ts`, kein Produktnamen-Literal ausser `src/brand.ts`, Tokens statt Hex, keine Em-Dashes auch nicht in UI-Texten, Conventional Commits, kein `git push` ohne Freigabe, Client-Komponenten ohne Wert-Imports aus `@/db`, `@/db/schema`, `@/domain/dashboard`, `@/domain/assessments`, `@/domain/documents`).
- **Henrik 2026-10-08, verbindlich:**
  - Dokumente versionieren, nie überschreiben; alte Versionen bleiben nachvollziehbar und herunterladbar.
  - Upload und Verknüpfung sind immer mandantengetrennt.
  - Audit-Events für Dokument anlegen, neue Version, Verknüpfung, Verknüpfung lösen.
  - Eine Statusänderung ist nie «magisch» eine Folge des Uploads, sondern bleibt eine ausdrückliche, auditierte Bewertung (Ruling R26). Die Oberfläche weist darauf hin, wenn ein aktueller Nachweis vorliegt, das Kriterium aber noch nicht «Erfüllt» ist.
  - Die Oberfläche unterscheidet drei Dinge getrennt: Dokument vorhanden, Dokument aktuell, Kriterium erfüllt.
  - Reihenfolge: Nachweise und Dokumente zuerst, Massnahmen danach.
- **Fachregeln (Rulings R24 bis R27):**
  - R24: Datei-Bytes liegen in Postgres (`bytea`, getrennt von der Listenabfrage nie mitgeladen). Grund: Persistenz und Atomarität mit dem Audit, kein Vercel-Blob-Konto für den Pitch nötig. Der Speicher ist hinter der Serviceschicht gekapselt (nur `documents.ts` und der Download-Handler berühren `content`), ein Wechsel auf private Blobs bleibt später möglich.
  - R25: Erlaubt sind PDF, PNG, JPG/JPEG, DOCX, XLSX bis höchstens 4 MiB (Vercel erlaubt Funktionen nur rund 4.5 MB Body). Der Dateityp wird an den Magic Bytes geprüft, nicht am Browser-MIME; der gespeicherte MIME-Typ kommt aus einer festen Tabelle. Dateinamen werden bereinigt.
  - R26: Nachweiszustand eines Kriteriums: `none` (kein Dokument verknüpft), `stale` (verknüpft, aber die neueste Version jedes verknüpften Dokuments ist abgelaufen), `current` (mindestens ein verknüpftes Dokument hat eine aktuelle neueste Version). Eine Version ist aktuell, wenn `valid_until` leer ist oder nicht vor «heute» (Europe/Zurich) liegt. Der Nachweiszustand verändert Readiness und Status nie.
  - R27: Action Center: pro Pflichtkriterium mit Zustand `stale` ein Eintrag «Nachweis veraltet» (Priorität hoch, Fälligkeit = Ablaufdatum). Erfüllte Pflichtkriterien ohne Nachweis (`none`) erscheinen NICHT einzeln, sondern als ein gebündelter Eintrag «N erfüllte Pflichtkriterien ohne Nachweis» (Priorität mittel) mit Link in die gefilterte Kriterienliste. Das Dashboard zeigt zusätzlich die Zähler Aktuell, Veraltet, Fehlend (über anwendbare Pflichtkriterien im Verfahren).
- Datenbank erzwingt Isolation zusätzlich: Dokument, Version und Verknüpfung tragen `organization_id` und verweisen über zusammengesetzte Fremdschlüssel `(id, organization_id)` aufeinander, sodass ein Cross-Tenant-Verweis auch bei direktem SQL unmöglich ist. Versionen sind per Trigger unveränderlich (kein UPDATE, kein DELETE).
- Zeitstempel und Daten wie bisher in `Europe/Zurich` (`formatDate`, `formatDateTime`, `now` als Parameter).
- Keine echten Personen, keine Patientendaten, keine echten Dokumente in Seeds und Tests. Demo-Dokumente sind synthetisch, enthalten sichtbar «Demo» und werden aus Code erzeugt.

## Review Focus

1. Ein Upload in Organisation A ist für Organisation B weder auffindbar, herunterladbar noch verknüpfbar, auch nicht mit einer fremden `documentId` oder `versionId` (Task 2, 4).
2. Eine Version wird nie überschrieben oder gelöscht (DB-Trigger und Service), und zwei gleichzeitige Uploads erzeugen zwei Versionen mit lückenlosen Nummern (Task 1, 2).
3. Falscher Dateityp (Endung passt nicht zum Inhalt), leere Datei, zu grosse Datei, manipulierter Dateiname (`../`, Steuerzeichen) werden abgelehnt oder bereinigt, ohne Zeile und ohne Audit-Event (Task 1, 2).
4. Ein Upload ändert den Bewertungsstand eines Kriteriums nie (Task 2, 6).
5. `viewer` kann Dokumente ansehen und herunterladen, aber nicht hochladen, verknüpfen oder lösen; die Server Action und der Download-Handler prüfen das serverseitig (Task 4).
6. Ablauf genau heute: gilt als aktuell; gestern abgelaufen: veraltet (Zeitzone Zürich) (Task 1).

## File Structure

```
qm/
  next.config.ts                                       serverActions.bodySizeLimit
  drizzle/0006_*.sql                                   Tabellen, Fremdschlüssel, Immutability-Trigger
  src/db/schema/domain.ts                              + bytea, document, documentVersion, evidenceLink
  src/domain/file-validation.ts                        rein: Magic Bytes, MIME-Tabelle, Dateiname, Grösse
  src/domain/evidence.ts                               rein: isCurrent, evidenceStateOf, summarize
  src/domain/documents.ts                              Services (Anlegen, neue Version, verknüpfen, lösen, lesen)
  src/domain/audit-copy.ts                             + Texte für document.* und evidence.*
  src/domain/assessments.ts                            listCriterionHistory nach Kriteriennummer
  src/domain/dashboard.ts                              evidenceSummary, ActionItem mit href und source evidence
  src/components/criteria/status-copy.ts               + EVIDENCE_LABEL, EVIDENCE_TONE
  src/components/dashboard/readiness-hero.tsx          + Nachweiszähler
  src/components/dashboard/action-center.tsx           Zeilen verlinkt
  src/app/(app)/criteria/page.tsx                      Nachweis-Spalte und Filter
  src/app/(app)/criteria/[number]/page.tsx             + Sektion Nachweise
  src/app/(app)/criteria/[number]/evidence-section.tsx Server: Liste, Zustände, Versionen
  src/app/(app)/criteria/[number]/evidence-forms.tsx   Client: Upload, neue Version, verknüpfen, lösen
  src/app/(app)/criteria/[number]/evidence-actions.ts  Server Actions
  src/app/(app)/criteria/[number]/evidence-input.ts    Zod-Schemas (rein)
  src/app/(app)/documents/page.tsx                     Dokumentenliste
  src/app/(app)/documents/versions/[versionId]/route.ts Download-Handler
  src/components/app-nav.tsx                           + «Dokumente»
  src/seed/demo.ts, src/seed/demo-documents.ts         Demo-Dokumente (erzeugte PDFs)
```

---

### Task 1: Schema, Immutability und reine Fachfunktionen

**Files:**
- Modify: `qm/src/db/schema/domain.ts`
- Create: `qm/drizzle/0006_*.sql` (generiert, plus Trigger), `qm/src/domain/file-validation.ts`, `qm/src/domain/evidence.ts`
- Test: `qm/src/domain/file-validation.test.ts`, `qm/src/domain/evidence.test.ts`, `qm/src/db/document-schema.test.ts`

**Interfaces:**
- Produces:
  - Tabellen `document`, `documentVersion`, `evidenceLink` (siehe Code), Spaltentyp `bytea`.
  - `MAX_FILE_BYTES = 4 * 1024 * 1024`, `type AllowedFile = { fileName: string; mimeType: string; size: number }`, `validateUpload(input: { name: string; bytes: Uint8Array }): { ok: true; file: AllowedFile } | { ok: false; error: string }`, `sanitizeFileName(name: string): string`.
  - `isCurrent(validUntil: string | null, today: string): boolean` (`today` = `zurichDate(now)`), `type EvidenceState = "none" | "stale" | "current"`, `evidenceStateOf(latestValidUntils: readonly (string | null)[], today: string): EvidenceState`, `summarizeEvidence(states: readonly EvidenceState[]): { current: number; stale: number; missing: number }`.

- [ ] **Step 1: Failing tests (rein)**

Create `qm/src/domain/file-validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, sanitizeFileName, validateUpload } from "./file-validation";

const bytes = (...b: number[]) => Uint8Array.from(b);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00);
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00);

describe("validateUpload", () => {
  it("accepts the allowed types when the content matches the extension", () => {
    expect(validateUpload({ name: "Hygienekonzept.pdf", bytes: PDF })).toEqual({
      ok: true,
      file: { fileName: "Hygienekonzept.pdf", mimeType: "application/pdf", size: PDF.length },
    });
    expect(validateUpload({ name: "scan.PNG", bytes: PNG })).toMatchObject({ ok: true, file: { mimeType: "image/png" } });
    expect(validateUpload({ name: "foto.jpeg", bytes: JPG })).toMatchObject({ ok: true, file: { mimeType: "image/jpeg" } });
    expect(validateUpload({ name: "foto.jpg", bytes: JPG })).toMatchObject({ ok: true });
    expect(validateUpload({ name: "liste.xlsx", bytes: ZIP })).toMatchObject({
      ok: true,
      file: { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
    expect(validateUpload({ name: "konzept.docx", bytes: ZIP })).toMatchObject({
      ok: true,
      file: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    });
  });

  it("rejects a mismatch between extension and content", () => {
    expect(validateUpload({ name: "x.pdf", bytes: PNG })).toMatchObject({ ok: false });
    expect(validateUpload({ name: "x.png", bytes: PDF })).toMatchObject({ ok: false });
    expect(validateUpload({ name: "x.docx", bytes: PDF })).toMatchObject({ ok: false });
  });

  it("rejects unknown extensions, missing extension, empty and oversized files", () => {
    expect(validateUpload({ name: "x.exe", bytes: PDF })).toMatchObject({ ok: false });
    expect(validateUpload({ name: "x.svg", bytes: PDF })).toMatchObject({ ok: false });
    expect(validateUpload({ name: "ohne-endung", bytes: PDF })).toMatchObject({ ok: false });
    expect(validateUpload({ name: "x.pdf", bytes: new Uint8Array(0) })).toMatchObject({ ok: false });
    const big = new Uint8Array(MAX_FILE_BYTES + 1);
    big.set(PDF);
    expect(validateUpload({ name: "x.pdf", bytes: big })).toMatchObject({ ok: false });
    const exact = new Uint8Array(MAX_FILE_BYTES);
    exact.set(PDF);
    expect(validateUpload({ name: "x.pdf", bytes: exact })).toMatchObject({ ok: true });
  });

  it("stores a sanitized file name", () => {
    expect(validateUpload({ name: "../../etc/passwd.pdf", bytes: PDF })).toMatchObject({
      ok: true,
      file: { fileName: "passwd.pdf" },
    });
  });
});

describe("sanitizeFileName", () => {
  it("drops paths, control characters and quotes, limits the length and keeps umlauts", () => {
    expect(sanitizeFileName("C:\\Users\\x\\Hygiene.pdf")).toBe("Hygiene.pdf");
    expect(sanitizeFileName("a/b/Notfallkonzept Süd.pdf")).toBe("Notfallkonzept Süd.pdf");
    expect(sanitizeFileName('bad"name\r\n.pdf')).toBe("badname.pdf");
    expect(sanitizeFileName("   .pdf")).toBe("dokument.pdf");
    const long = `${"a".repeat(300)}.pdf`;
    const out = sanitizeFileName(long);
    expect(out.length).toBeLessThanOrEqual(120);
    expect(out.endsWith(".pdf")).toBe(true);
  });
});
```

Create `qm/src/domain/evidence.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { evidenceStateOf, isCurrent, summarizeEvidence } from "./evidence";

describe("isCurrent", () => {
  it("is current without an expiry date and on the expiry day, stale the day after", () => {
    expect(isCurrent(null, "2026-10-08")).toBe(true);
    expect(isCurrent("2026-10-08", "2026-10-08")).toBe(true);
    expect(isCurrent("2026-10-07", "2026-10-08")).toBe(false);
    expect(isCurrent("2027-01-01", "2026-10-08")).toBe(true);
  });
});

describe("evidenceStateOf", () => {
  it("is none without documents, current if any latest version is current, stale otherwise", () => {
    expect(evidenceStateOf([], "2026-10-08")).toBe("none");
    expect(evidenceStateOf(["2026-01-01"], "2026-10-08")).toBe("stale");
    expect(evidenceStateOf(["2026-01-01", "2027-01-01"], "2026-10-08")).toBe("current");
    expect(evidenceStateOf([null], "2026-10-08")).toBe("current");
  });
});

describe("summarizeEvidence", () => {
  it("counts current, stale and missing", () => {
    expect(summarizeEvidence(["current", "stale", "none", "none", "current"])).toEqual({ current: 2, stale: 1, missing: 2 });
    expect(summarizeEvidence([])).toEqual({ current: 0, stale: 0, missing: 0 });
  });
});
```

Run: `pnpm test src/domain/file-validation.test.ts src/domain/evidence.test.ts`
Expected: FAIL (Module fehlen).

- [ ] **Step 2: Reine Module**

Create `qm/src/domain/file-validation.ts`:

```ts
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_FILE_NAME = 120;

export type AllowedFile = { fileName: string; mimeType: string; size: number };

const TYPES: Record<string, { mime: string; magic: readonly (readonly number[])[] }> = {
  pdf: { mime: "application/pdf", magic: [[0x25, 0x50, 0x44, 0x46, 0x2d]] },
  png: { mime: "image/png", magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  jpg: { mime: "image/jpeg", magic: [[0xff, 0xd8, 0xff]] },
  jpeg: { mime: "image/jpeg", magic: [[0xff, 0xd8, 0xff]] },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    magic: [[0x50, 0x4b, 0x03, 0x04]],
  },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    magic: [[0x50, 0x4b, 0x03, 0x04]],
  },
};

/** Entfernt Pfade, Steuerzeichen und Anführungszeichen, begrenzt die Länge, behält die Endung. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f"]/g, "").trim();
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 ? cleaned.slice(dot) : dot === 0 ? cleaned : "";
  const stem = dot > 0 ? cleaned.slice(0, dot).trim() : dot === 0 ? "" : cleaned;
  const safeStem = stem.length > 0 ? stem : "dokument";
  const room = Math.max(1, MAX_FILE_NAME - ext.length);
  return `${[...safeStem].slice(0, room).join("")}${ext}`;
}

export function validateUpload(input: {
  name: string;
  bytes: Uint8Array;
}): { ok: true; file: AllowedFile } | { ok: false; error: string } {
  const fileName = sanitizeFileName(input.name);
  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
  const type = TYPES[ext];
  if (!type) return { ok: false, error: "Dateityp nicht erlaubt. Erlaubt sind PDF, PNG, JPG, DOCX und XLSX." };
  if (input.bytes.length === 0) return { ok: false, error: "Die Datei ist leer." };
  if (input.bytes.length > MAX_FILE_BYTES) {
    return { ok: false, error: "Die Datei ist grösser als 4 MB." };
  }
  const matches = type.magic.some((m) => m.every((b, i) => input.bytes[i] === b));
  if (!matches) return { ok: false, error: "Der Inhalt passt nicht zur Dateiendung." };
  return { ok: true, file: { fileName, mimeType: type.mime, size: input.bytes.length } };
}
```

Create `qm/src/domain/evidence.ts`:

```ts
export type EvidenceState = "none" | "stale" | "current";

/** Eine Version ist aktuell, wenn sie nicht abläuft oder am Ablauftag noch nicht vorbei ist. `today` = YYYY-MM-DD in Zürich. */
export function isCurrent(validUntil: string | null, today: string): boolean {
  return validUntil === null || validUntil >= today;
}

/** Eingabe: Ablaufdaten der NEUESTEN Version jedes verknüpften Dokuments. */
export function evidenceStateOf(latestValidUntils: readonly (string | null)[], today: string): EvidenceState {
  if (latestValidUntils.length === 0) return "none";
  return latestValidUntils.some((v) => isCurrent(v, today)) ? "current" : "stale";
}

export function summarizeEvidence(states: readonly EvidenceState[]): { current: number; stale: number; missing: number } {
  const out = { current: 0, stale: 0, missing: 0 };
  for (const s of states) {
    if (s === "current") out.current += 1;
    else if (s === "stale") out.stale += 1;
    else out.missing += 1;
  }
  return out;
}
```

Run: `pnpm test src/domain/file-validation.test.ts src/domain/evidence.test.ts`
Expected: PASS.

- [ ] **Step 3: Failing test für Schema und Unveränderlichkeit**

Create `qm/src/db/document-schema.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION, criterion, document, documentVersion, evidenceLink } from "@/db/schema";
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
    const [ok] = await db
      .insert(evidenceLink)
      .values({ organizationId: a.org.id, documentId: doc.id, standardVersionId: ACTIVE_STANDARD_VERSION, criterionNumber: "7.3.10", linkedBy: a.user.id })
      .returning();
    expect(ok.id).toBeDefined();
    await expect(
      db.insert(evidenceLink).values({ organizationId: a.org.id, documentId: doc.id, standardVersionId: ACTIVE_STANDARD_VERSION, criterionNumber: "7.3.10", linkedBy: a.user.id }),
    ).rejects.toSatisfy((e) => /unique|duplicate/i.test(errorText(e)));
    expect((await db.select().from(criterion).where(eq(criterion.number, "7.3.10"))).length).toBe(1);
    void randomUUID;
  });
});
```

(`randomUUID` und die letzte Zeile entfernen, falls `pnpm lint` sie bemängelt; sie sind nur Platzhalter-frei gemeint und nicht nötig.)

Run: `pnpm test src/db/document-schema.test.ts`
Expected: FAIL (Tabellen fehlen).

- [ ] **Step 4: Schema**

In `qm/src/db/schema/domain.ts` die Importe um `customType`, `foreignKey`, `bigint` ergänzen (aus `drizzle-orm/pg-core`) und hinzufügen:

```ts
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const document = pgTable(
  "document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id),
    title: text("title").notNull(),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("document_id_org").on(t.id, t.organizationId),
    index("document_org_idx").on(t.organizationId),
  ],
);

export const documentVersion = pgTable(
  "document_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    documentId: uuid("document_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    content: bytea("content").notNull(),
    validUntil: date("valid_until"),
    uploadedBy: text("uploaded_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("document_version_number").on(t.documentId, t.versionNumber),
    foreignKey({
      name: "document_version_document_fk",
      columns: [t.documentId, t.organizationId],
      foreignColumns: [document.id, document.organizationId],
    }),
    index("document_version_org_idx").on(t.organizationId),
  ],
);

export const evidenceLink = pgTable(
  "evidence_link",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    documentId: uuid("document_id").notNull(),
    standardVersionId: text("standard_version_id").notNull(),
    criterionNumber: text("criterion_number").notNull(),
    linkedBy: text("linked_by").references(() => user.id),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("evidence_link_unique").on(t.organizationId, t.documentId, t.standardVersionId, t.criterionNumber),
    foreignKey({
      name: "evidence_link_document_fk",
      columns: [t.documentId, t.organizationId],
      foreignColumns: [document.id, document.organizationId],
    }),
    foreignKey({
      name: "evidence_link_criterion_fk",
      columns: [t.standardVersionId, t.criterionNumber],
      foreignColumns: [criterion.standardVersionId, criterion.number],
    }),
    index("evidence_link_org_criterion_idx").on(t.organizationId, t.criterionNumber),
  ],
);
```

Hinweis: `documentVersion.organizationId` und `evidenceLink.organizationId` haben bewusst keinen eigenen Fremdschlüssel auf `organization`: die zusammengesetzten Fremdschlüssel auf `document(id, organization_id)` erzwingen Existenz und Mandantengleichheit. `criterion` hat bereits `unique("criterion_version_number").on(standardVersionId, number)`, auf das der zweite Fremdschlüssel zeigt.

Migration erzeugen und Trigger anhängen:

```bash
cd qm && pnpm db:generate
```

Danach in der erzeugten `drizzle/0006_*.sql` am Ende anfügen (mit `--> statement-breakpoint` zwischen den Anweisungen):

```sql
CREATE OR REPLACE FUNCTION document_version_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'document_version is immutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER document_version_no_change
  BEFORE UPDATE OR DELETE ON document_version
  FOR EACH ROW EXECUTE FUNCTION document_version_immutable();
```

```bash
pnpm db:migrate
```

Expected: Migration auf `qm_dev` angewendet. Falls drizzle-kit Trigger nicht im selben File akzeptiert, `pnpm drizzle-kit generate --custom --name=document_version_immutable` für einen eigenen Schritt verwenden.

`TABLES` in `qm/src/test/helpers.ts` (resetDb) und die `TRUNCATE`-Liste in `qm/src/seed/demo.ts` um `evidence_link`, `document_version`, `document` ergänzen (vor `audit_event`; TRUNCATE ... CASCADE umgeht den Trigger, wie bei `audit_event`).

- [ ] **Step 5: Tests, Typecheck, Commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: alles grün.

```bash
git add qm/ && git commit -m "feat(qm): add document, immutable version and evidence link schema with pure validation and evidence state"
```

---

### Task 2: Dokument-Services mit Audit und Historie nach Kriterium

**Files:**
- Create: `qm/src/domain/documents.ts`
- Modify: `qm/src/domain/audit-copy.ts`, `qm/src/domain/assessments.ts` (`listCriterionHistory`)
- Test: `qm/src/domain/documents.test.ts`, `qm/src/domain/audit-copy.test.ts` (Fälle ergänzen), `qm/src/domain/assessment-detail.test.ts` (Fälle ergänzen)

**Interfaces:**
- Consumes: `withAudit`, `assertCan`, `ValidationError`, `validateUpload`, `isCurrent`, `evidenceStateOf`, `zurichDate`, `isValidIsoDate`, Test-Helper.
- Produces (alle `ctx: OrgContext` zuerst, `now: Date` wo Datum zählt):
  - `type UploadInput = { name: string; bytes: Uint8Array }`
  - `createDocument(ctx, input: { title: string; file: UploadInput; validUntil: string | null; criterionNumbers: readonly string[] }): Promise<{ documentId: string; versionId: string }>`
  - `addDocumentVersion(ctx, documentId: string, input: { file: UploadInput; validUntil: string | null }): Promise<{ versionId: string; versionNumber: number }>`
  - `linkEvidence(ctx, documentId: string, criterionNumber: string): Promise<{ linkId: string }>`
  - `unlinkEvidence(ctx, linkId: string): Promise<void>`
  - `type VersionView = { id: string; versionNumber: number; fileName: string; mimeType: string; sizeBytes: number; sha256: string; validUntil: string | null; uploadedByName: string | null; createdAt: Date; current: boolean }`
  - `type EvidenceDoc = { documentId: string; linkId: string; title: string; latest: VersionView; versions: VersionView[]; state: "current" | "stale" }`
  - `listCriterionEvidence(ctx, number: string, now: Date): Promise<{ docs: EvidenceDoc[]; state: EvidenceState }>`
  - `type DocumentRow = { documentId: string; title: string; latest: VersionView; versionCount: number; criteria: string[]; state: "current" | "stale" }`
  - `listDocuments(ctx, now: Date): Promise<DocumentRow[]>`
  - `listLinkableDocuments(ctx, number: string): Promise<{ documentId: string; title: string }[]>` (Dokumente der Organisation, die noch nicht mit dem Kriterium verknüpft sind)
  - `getEvidenceStates(ctx, now: Date): Promise<Map<string, EvidenceState>>` (Kriteriennummer zu Zustand, nur Nummern mit Verknüpfung; fehlende Nummern bedeuten `none`)
  - `getVersionDownload(ctx, versionId: string): Promise<{ fileName: string; mimeType: string; content: Buffer } | null>`
  - `listCriterionHistory(ctx, number: string, assessmentId: string | null)` (Signatur erweitert, siehe Step 4)

Audit-Konvention (verbindlich): Events dieser Task tragen im `after`/`before` JSON immer `criterionNumbers: string[]` (leeres Array erlaubt), damit die Kriterien-Historie sie findet. Eventtypen: `document.created`, `document.version_added`, `evidence.linked`, `evidence.unlinked`. `entityType` ist `document` (bzw. `evidence_link`), `entityId` die jeweilige ID.

- [ ] **Step 1: Failing tests**

Create `qm/src/domain/documents.test.ts` mit diesen Gruppen (Code vollständig; Hilfsfunktionen `pdf(text)` erzeugen gültige PDF-Magic-Bytes plus Text):

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION, criterion, criterionAssessment, documentVersion } from "@/db/schema";
import { importCatalog } from "./catalog";
import { listAuditEvents } from "./audit";
import {
  addDocumentVersion, createDocument, getEvidenceStates, getVersionDownload, linkEvidence,
  listCriterionEvidence, listDocuments, listLinkableDocuments, unlinkEvidence,
} from "./documents";
import { ForbiddenError, ValidationError } from "./org-context";
import { setAssessmentStatus } from "./assessments";
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

describe("linking", () => {
  beforeEach(resetDb);

  it("links and unlinks with audit events and lists linkable documents", async () => {
    const { ctxA } = await setup();
    const { documentId } = await createDocument(ctxA, { title: "Hygienekonzept", file: pdf("v1"), validUntil: null, criterionNumbers: [] });
    expect((await listLinkableDocuments(ctxA, "7.3.10")).map((d) => d.documentId)).toEqual([documentId]);
    const { linkId } = await linkEvidence(ctxA, documentId, "7.3.10");
    expect(await listLinkableDocuments(ctxA, "7.3.10")).toEqual([]);
    await expect(linkEvidence(ctxA, documentId, "7.3.10")).rejects.toBeInstanceOf(ValidationError);
    await unlinkEvidence(ctxA, linkId);
    expect((await listCriterionEvidence(ctxA, "7.3.10", NOW)).state).toBe("none");
    const types = (await listAuditEvents(ctxA)).map((e) => e.eventType).sort();
    expect(types).toEqual(["document.created", "evidence.linked", "evidence.unlinked"]);
    const unlinked = (await listAuditEvents(ctxA)).find((e) => e.eventType === "evidence.unlinked")!;
    expect(unlinked.beforeJson).toMatchObject({ criterionNumbers: ["7.3.10"] });
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
    void and;
  });
});
```

(`and` und die Zeile `void and;` entfernen, falls Lint sie meldet.)

Ergänze `qm/src/domain/audit-copy.test.ts`:

```ts
  it("describes document and evidence events", () => {
    expect(describeAuditEvent({ eventType: "document.created", before: null, after: { title: "Hygienekonzept", versionNumber: 1, fileName: "h.pdf", criterionNumbers: ["7.3.10"] } }))
      .toBe("Dokument «Hygienekonzept» angelegt (Version 1, h.pdf)");
    expect(describeAuditEvent({ eventType: "document.version_added", before: { versionNumber: 1 }, after: { title: "Hygienekonzept", versionNumber: 2, fileName: "h2.pdf", validUntil: "2027-06-30", criterionNumbers: ["7.3.10"] } }))
      .toBe("Neue Version 2 von «Hygienekonzept» (h2.pdf), gültig bis 30.06.2027");
    expect(describeAuditEvent({ eventType: "document.version_added", before: { versionNumber: 1 }, after: { title: "Hygienekonzept", versionNumber: 2, fileName: "h2.pdf", validUntil: null, criterionNumbers: [] } }))
      .toBe("Neue Version 2 von «Hygienekonzept» (h2.pdf), ohne Ablaufdatum");
    expect(describeAuditEvent({ eventType: "evidence.linked", before: null, after: { title: "Hygienekonzept", criterionNumbers: ["7.3.10"] } }))
      .toBe("Nachweis «Hygienekonzept» verknüpft");
    expect(describeAuditEvent({ eventType: "evidence.unlinked", before: { title: "Hygienekonzept", criterionNumbers: ["7.3.10"] }, after: null }))
      .toBe("Nachweis «Hygienekonzept» gelöst");
  });
```

Ergänze `qm/src/domain/assessment-detail.test.ts` einen Fall: Ein Dokument-Event mit `criterionNumbers: ["7.3.10"]` erscheint in `listCriterionHistory(ctx, "7.3.10", assessmentId)`; ein Event mit `["6.3.2"]` nicht; Organisation B sieht keines; für `assessmentId === null` (nie bewertet) liefert die Historie trotzdem die Dokument-Events.

Run: `pnpm test`
Expected: FAIL.

- [ ] **Step 2: Service `documents.ts`**

Create `qm/src/domain/documents.ts`. Struktur und verbindliche Regeln (Code schreiben, so dass die Tests oben bestehen):

```ts
import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { ACTIVE_STANDARD_VERSION, criterion, document, documentVersion, evidenceLink, user } from "@/db/schema";
import { withAudit } from "./audit";
import { zurichDate, isValidIsoDate } from "./dates";
import { evidenceStateOf, isCurrent, type EvidenceState } from "./evidence";
import { validateUpload } from "./file-validation";
import { assertCan, ValidationError, type OrgContext } from "./org-context";
```

Verbindliche Eigenschaften:

1. Jede Funktion beginnt mit `assertCan(ctx, "document", "read" | "write")` (Lesen: `listDocuments`, `listCriterionEvidence`, `listLinkableDocuments`, `getEvidenceStates`, `getVersionDownload`; Schreiben: `createDocument`, `addDocumentVersion`, `linkEvidence`, `unlinkEvidence`), danach die Eingabevalidierung (Titel nach Trim 3 bis 120 Zeichen in Codepunkten; `validUntil` null oder `isValidIsoDate`; Datei über `validateUpload`; Kriteriennummern müssen in `ACTIVE_STANDARD_VERSION` existieren; sonst `ValidationError` mit deutscher Meldung), und erst dann `withAudit`.
2. `createDocument`: in EINER Transaktion `document`, Version 1 (`sha256` über die Bytes mit `createHash("sha256")`, `content` als `Buffer.from(bytes)`), die Verknüpfungen (pro Nummer eine Zeile); Audit-Event `document.created` (`entityType: "document"`, `entityId: documentId`, `before: null`, `after: { title, versionNumber: 1, fileName, validUntil, criterionNumbers }`). `withAudit` schreibt genau EIN Event pro Aufruf: für die Verknüpfungen wird daher `withAudit` nur für `document.created` genutzt und die `evidence.linked`-Events werden in derselben Transaktion direkt in `audit_event` eingefügt. Dafür in `audit.ts` eine Hilfsfunktion `insertAuditEvent(tx: Tx, ctx: OrgContext, event: AuditEventInput): Promise<void>` ausgliedern, die `withAudit` selbst benutzt (kein doppelter Code) und hier für die zusätzlichen Events aufgerufen wird. Die Erwartung der Tests (`["document.created","evidence.linked"]` bei einer Verknüpfung) gilt damit.
3. `addDocumentVersion`: Dokument per `SELECT ... FOR UPDATE` sperren (gefiltert auf `id` UND `organizationId`; nicht gefunden: `ValidationError("Dokument nicht gefunden.")`), `max(version_number)` lesen, `+1` einfügen; das Sperren serialisiert gleichzeitige Uploads (lückenlose Nummern). Audit `document.version_added` mit `before: { versionNumber: alt }`, `after: { title, versionNumber, fileName, validUntil, criterionNumbers }` (alle Nummern, an die das Dokument verknüpft ist).
4. `linkEvidence`: Dokument org-gefiltert prüfen (sonst `ValidationError`), Kriterium prüfen, Doppelverknüpfung abfangen (`ValidationError("Dokument ist bereits verknüpft.")`, bevorzugt durch vorherige Prüfung innerhalb der Transaktion plus Unique-Constraint als Netz); Audit `evidence.linked` (`entityType: "evidence_link"`, `after: { title, criterionNumbers: [nummer] }`). `unlinkEvidence`: Zeile org-gefiltert laden und löschen (sonst `ValidationError`), Audit `evidence.unlinked` mit `before: { title, criterionNumbers: [nummer] }`, `after: null`.
5. Lesefunktionen: nie `content` selektieren ausser in `getVersionDownload` (explizite Spaltenlisten). Jede Query filtert `organizationId = ctx.organizationId` (auch Joins in der ON-Bedingung). `current`/`state` berechnen sich mit `isCurrent` und `zurichDate(now)`; die NEUESTE Version ist die mit der höchsten `versionNumber`. `listCriterionEvidence` sortiert Dokumente nach Titel, Versionen absteigend. `getEvidenceStates` liefert eine Map nur für Kriteriennummern mit mindestens einer Verknüpfung (Zustand über `evidenceStateOf` der neuesten Versionen).
6. `getVersionDownload` gibt `null` für unbekannte oder fremde Versionen zurück (nie eine Ausnahme mit Details).
7. Kein Service verändert `criterion_assessment`.

- [ ] **Step 3: audit-copy**

In `qm/src/domain/audit-copy.ts` Zweige für `document.created`, `document.version_added`, `evidence.linked`, `evidence.unlinked` ergänzen, exakt mit den Texten aus dem Test (Titel in «», Datum über `formatDate`); unvollständige oder falsch geformte Payloads fallen weiter auf den Eventtyp zurück. Die Payload-Auswertung über kleine, getypte Hilfsfunktionen (`asDoc(v: unknown)`), kein `any`.

- [ ] **Step 4: Historie nach Kriteriennummer**

`listCriterionHistory(ctx, number, assessmentId)` in `assessments.ts`: Bedingung wird `org AND ( (assessmentId nicht null AND entityType = 'criterion_assessment' AND entityId = assessmentId) OR jsonb_exists(after_json -> 'criterionNumbers', number) OR jsonb_exists(before_json -> 'criterionNumbers', number) )`. Die Funktion `jsonb_exists(jsonb, text)` statt des Operators `?` verwenden (Platzhalterkonflikt). Aufrufer (`criteria/[number]/page.tsx`, Tests) auf die neue Signatur umstellen; die bestehende Prüfung `audit.read` bleibt die erste Anweisung; die Historie wird auch angezeigt, wenn `assessmentId` noch `null` ist (Dokument-Events existieren bereits). Die Seite ruft sie deshalb ab, sobald `audit.read` erlaubt ist.

- [ ] **Step 5: Tests, Typecheck, Commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: alles grün.

```bash
git add qm/ && git commit -m "feat(qm): add tenant-scoped document services with versions, evidence links and audit"
```

---

### Task 3: Dashboard und Kriterienliste kennen den Nachweiszustand

**Files:**
- Modify: `qm/src/domain/dashboard.ts`, `qm/src/components/criteria/status-copy.ts`, `qm/src/components/dashboard/readiness-hero.tsx`, `qm/src/components/dashboard/action-center.tsx`, `qm/src/app/(app)/criteria/page.tsx`, `qm/src/domain/criteria-filter.ts`
- Test: `qm/src/domain/dashboard.test.ts`, `qm/src/domain/criteria-filter.test.ts` (Fälle ergänzen)

**Interfaces:**
- Consumes: `getEvidenceStates`, `summarizeEvidence`, `evidenceStateOf`.
- Produces:
  - `ActionItem` zusätzlich `href: string | null`; `source: "criterion" | "deadline" | "evidence"`.
  - `buildActionItems(criteria, deadlines, evidence: { stale: StaleEvidence[]; missingMet: number }, mode, now)` (neues Argument); `type StaleEvidence = { number: string; title: string; validUntil: string }`.
  - `DashboardData.evidence: { current: number; stale: number; missing: number }`.
  - `parseEvidenceFilter(value): "all" | EvidenceState`, `EVIDENCE_LABEL`, `EVIDENCE_TONE`.

Regeln (R26/R27): Zähler über anwendbare (nicht `not_applicable`) Pflichtkriterien im Verfahren. `stale`: pro Kriterium ein Action-Item `{ priority: "high", statusLabel: "Nachweis veraltet", dueDate: validUntil (Ablaufdatum der neuesten abgelaufenen Version, bei mehreren verknüpften Dokumenten das späteste), href: "/criteria/<nummer>", source: "evidence" }`. `missingMet`: Anzahl Pflichtkriterien mit Status `met` und Zustand `none`; bei `> 0` genau EIN Item `{ priority: "medium", topic: "N erfüllte Pflichtkriterien ohne Nachweis" (Singular bei 1), statusLabel: "Nachweis fehlt", dueDate: null, href: "/criteria?status=met&evidence=none", source: "evidence" }`. Kriterien- und Frist-Items bekommen `href` (`/criteria/<nummer>` bzw. `null`). Readiness bleibt unverändert.

- [ ] **Step 1: Failing tests**

An `qm/src/domain/dashboard.test.ts` ergänzen: (a) reine Tests für `buildActionItems` mit `stale` (ein Eintrag je Kriterium, Priorität hoch, Datum, href) und `missingMet` (genau ein gebündelter Eintrag, Singular/Plural, href mit Filter, Priorität mittel; bei 0 kein Eintrag), Sortierung (kritisch vor hoch vor mittel bleibt); (b) `getDashboard`-Integrationstest: Organisation A mit einem veralteten Dokument an einem Pflichtkriterium und einem erfüllten Pflichtkriterium ohne Nachweis liefert `evidence = { current, stale: 1, missing: ... }`, ein `source: "evidence"`-Item, und die Readiness-Stufe bleibt unverändert gegenüber demselben Zustand ohne Dokumente (Review Focus 4); Organisation B sieht weder Zähler noch Items. Alle bestehenden Assertions bleiben; Aufrufe von `buildActionItems` in bestehenden Tests bekommen das neue Argument `{ stale: [], missingMet: 0 }`.

An `qm/src/domain/criteria-filter.test.ts`: `parseEvidenceFilter("none"|"stale"|"current"|"all"|undefined|"x")`.

Run: `pnpm test`
Expected: FAIL.

- [ ] **Step 2: Implementation**

- `dashboard.ts`: in `getDashboard` zusätzlich `getEvidenceStates(ctx, now)` parallel laden; Zähler und Items wie oben bilden; `StaleEvidence.validUntil` braucht das späteste Ablaufdatum der neuesten Versionen: dafür `getEvidenceStates` zu `getEvidenceInfo(ctx, now): Promise<Map<string, { state: EvidenceState; latestValidUntil: string | null }>>` erweitern (Test aus Task 2 entsprechend anpassen, gleiche Strenge: `.get("7.3.10")` wird `{ state: "current", latestValidUntil: null }`; der Name `getEvidenceStates` bleibt als dünner Wrapper, wenn Aufrufer ihn schon nutzen).
- `criteria-filter.ts`: `parseEvidenceFilter`. `status-copy.ts`: `EVIDENCE_LABEL = { none: "Fehlt", stale: "Veraltet", current: "Aktuell" }`, `EVIDENCE_TONE` (`none`: gedämpft, `stale`: warning, `current`: success), beides client-sicher (nur Typ-Import aus `@/domain/evidence`).
- Kriterienliste: neue Spalte «Nachweis» (Textlabel; für `not_applicable` ein Strich), Filterleiste in zwei Gruppen («Stand» und «Nachweis»), beide per Link-Parametern kombinierbar (`?status=...&evidence=...`), jeder Link bewahrt den jeweils anderen Parameter; Zähler pro Filterwert; Leerzustand-Text.
- Hero: unter den Zählern eine zweite Gruppe «Nachweise» mit drei Werten «Aktuell», «Veraltet», «Fehlend» (Textlabels, `stale > 0` in der Warnfarbe). Action Center: Themenzelle wird zum Link, wenn `href` gesetzt ist (sichtbarer Fokus, Primärfarbe, unterstrichen bei Hover).

- [ ] **Step 3: Tests, Typecheck, Build, Commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: alles grün.

```bash
git add qm/ && git commit -m "feat(qm): show evidence state on dashboard, action center and criteria list without touching readiness"
```

---

### Task 4: Server Actions, Download-Handler und Upload-Limit

**Files:**
- Modify: `qm/next.config.ts`
- Create: `qm/src/app/(app)/criteria/[number]/evidence-input.ts`, `qm/src/app/(app)/criteria/[number]/evidence-actions.ts`, `qm/src/app/(app)/documents/versions/[versionId]/route.ts`
- Test: `qm/src/app/(app)/criteria/[number]/evidence-input.test.ts`

**Interfaces:**
- Produces:
  - `evidenceInput` Zod-Schemas: `uploadInput` (`number`, `title`, `validUntil?`, `file`), `versionInput` (`number`, `documentId` uuid, `validUntil?`, `file`), `linkInput` (`number`, `documentId` uuid), `unlinkInput` (`number`, `linkId` uuid); `parseFile(value: FormDataEntryValue | null): { name: string; bytes: Uint8Array } | null` (rein, `File`-ähnliches Objekt mit `name`, `size`, `arrayBuffer`) asynchron: `readFile(value): Promise<UploadInput | null>` mit Grössenvorprüfung `size <= MAX_FILE_BYTES` VOR dem Lesen.
  - Server Actions (`"use server"`): `uploadDocumentAction`, `addVersionAction`, `linkEvidenceAction`, `unlinkEvidenceAction`, jeweils `(prev: EvidenceFormState, formData: FormData) => Promise<EvidenceFormState>`, `type EvidenceFormState = { ok: boolean; message: string } | null`.
  - `GET /documents/versions/[versionId]`: liefert die Bytes mit `Content-Type` (gespeicherter MIME), `Content-Disposition: attachment; filename*=UTF-8''<url-kodiert>` plus ASCII-Rückfall, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`; 401 ohne Sitzung (Redirect nicht nötig, JSON-lose Antwort), 403 ohne Leserecht, 404 für unbekannte oder fremde Version; ungültige UUID: 404.

- [ ] **Step 1: Failing tests (Eingabeschemas)**

Create `qm/src/app/(app)/criteria/[number]/evidence-input.test.ts` mit Fällen: gültige und ungültige UUIDs, Titellänge (2 vs 3 Zeichen), `validUntil` leer erlaubt/ungültig abgelehnt (`isValidIsoDate`), unbekannte Felder werden entfernt, `readFile` lehnt ein zu grosses Objekt ab, ohne `arrayBuffer()` aufzurufen (Spy), liefert `null` für einen String-Eintrag oder eine leere Datei, und gibt `{ name, bytes }` für ein gültiges File-ähnliches Objekt zurück.

Run: `pnpm test src/app/(app)/criteria/[number]/evidence-input.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implementation**

`next.config.ts`: `experimental: { serverActions: { bodySizeLimit: "5mb" } }` ergänzen (Dateigrenze 4 MiB plus Formularüberhang). Hinweis im Commit: die Plattformgrenze von Vercel für Funktions-Bodies liegt bei rund 4.5 MB.

`evidence-actions.ts` (`"use server"`, exportiert nur async Funktionen und den Typ):

1. Reihenfolge in jeder Action: `formData` parsen (Zod, ungültig: allgemeine Meldung) → `requireOrgContextOrRedirect()` → `can(ctx.role, "document", "write")` sonst `{ ok: false, message: "Keine Berechtigung für diese Änderung." }` → Datei lesen (`readFile`) → Service aufrufen → `ValidationError` und `ForbiddenError` als Meldung zurückgeben, alles andere weiterwerfen → bei Erfolg `revalidatePath("/")`, `revalidatePath("/criteria")`, `revalidatePath(`/criteria/${encodeURIComponent(number)}`)`, `revalidatePath("/documents")`, `{ ok: true, message: "Gespeichert." }` (oder eine konkrete Meldung: «Dokument hochgeladen.», «Neue Version gespeichert.», «Nachweis verknüpft.», «Verknüpfung gelöst.»).
2. `uploadDocumentAction` legt Dokument plus Version 1 an und verknüpft es mit `number`; `addVersionAction` fügt eine Version hinzu (Dokument-ID kommt aus dem Formular, wird aber im Service gegen die Organisation geprüft); `linkEvidenceAction`, `unlinkEvidenceAction` rufen die Services.
3. Die Aktionen ändern nie `criterion_assessment`.

`route.ts` (Download): `requireOrgContext()` (nicht die Redirect-Variante) in try/catch: `UnauthorizedError` zu 401, `ForbiddenError` zu 403; `getVersionDownload(ctx, versionId)`; `null` zu 404; Antwort mit den oben genannten Headern. Dateiname im Header: `filename="<ASCII-Rückfall ohne Nicht-ASCII>"; filename*=UTF-8''<encodeURIComponent>`.

- [ ] **Step 3: Verifikation**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: grün.

Ende-zu-Ende per Headless-Chromium und `curl` (erst nach Task 5 vollständig; hier nur der Download-Handler): `pnpm seed:demo -- --yes-reset`, Dev-Server auf Port 3100; Version-ID aus der Datenbank lesen (`psql`); als Cookie des `owner` per `curl`: 200 mit korrekten Headern und identischen Bytes; mit den Cookies von `viewer`: 200; ohne Cookie: 401; mit einer Version-ID einer anderen Organisation (zweite Organisation per `psql` oder Test-Helfer anlegen): 404; `/documents/versions/nicht-eine-uuid`: 404. Das Seed liefert Dokumente erst in Task 6: bis dahin zwei Zeilen per Test-Skript oder `psql` anlegen und danach wieder `pnpm seed:demo -- --yes-reset` ausführen.

```bash
git add qm/ && git commit -m "feat(qm): add evidence server actions, upload limit and authorised download handler"
```

---

### Task 5: Oberfläche für Nachweise und Dokumente

**Files:**
- Create: `qm/src/app/(app)/criteria/[number]/evidence-section.tsx`, `qm/src/app/(app)/criteria/[number]/evidence-forms.tsx`, `qm/src/app/(app)/documents/page.tsx`
- Modify: `qm/src/app/(app)/criteria/[number]/page.tsx`, `qm/src/components/app-nav.tsx`

**Interfaces:**
- Consumes: Services und Actions aus Task 2 und 4, `EVIDENCE_LABEL`, `EVIDENCE_TONE`, `formatDate`, `formatDateTime`, `can`.

Vor dem ersten `.tsx`: `impeccable:impeccable` versuchen (sonst nach `DESIGN.md` arbeiten). Tokens statt Hex, Status immer mit Textlabel, Tabellen mit caption und th scope, sichtbarer Fokus, keine Em-Dashes. Client-Komponenten (`evidence-forms.tsx`) importieren nur Typen und die Actions; alle Daten kommen als Props. Formulare nutzen das Muster der Bewertungsform (manuelles `onSubmit` mit `preventDefault` und `startTransition`, damit Eingaben nach einem Fehler stehen bleiben; immer gerenderte `role="status"`/`role="alert"`-Absätze); Dateifelder werden nach Erfolg über einen Schlüssel zurückgesetzt.

- [ ] **Step 1: Sektion «Nachweise» auf der Kriteriumsseite**

`evidence-section.tsx` (Server-Komponente, nur in Suspense gerendert): Aufruf `listCriterionEvidence(ctx, number, now)` (`now` wird in der Seite NACH `requireOrgContextOrRedirect()` erzeugt und durchgereicht), plus `listLinkableDocuments` wenn schreibberechtigt. Inhalt:

1. Drei klar getrennte Anzeigen oben, jede mit Textlabel: «Nachweis» (Zustand `none`/`stale`/`current` als «Fehlt»/«Veraltet»/«Aktuell»), «Dokumente» (Anzahl verknüpft), «Kriterium» (Bewertungsstand aus `STATUS_LABEL`). Ist der Nachweis `current` und der Stand weder «Erfüllt» noch «Nicht anwendbar», erscheint ein ruhiger Hinweis: «Ein aktueller Nachweis liegt vor. Bitte den Stand prüfen und bei Bedarf unter «Bewertung» auf «Erfüllt» setzen.» (keine automatische Änderung, Ruling R26). Ist der Stand «Erfüllt» und der Nachweis `none` oder `stale`, ein Hinweis in der Warnfarbe: «Das Kriterium ist als erfüllt bewertet, aber es gibt keinen aktuellen Nachweis.»
2. Tabelle der verknüpften Dokumente: Titel, aktuelle Version («V2, konzept.pdf»), Gültig bis, Zustand (Textlabel), Download-Link (`/documents/versions/<id>`), «Versionen anzeigen» als `<details>` mit allen Versionen (Version, Datei, hochgeladen von, Zeitpunkt, Gültig bis, Download je Version), und für Schreibberechtigte: «Neue Version hochladen» (Formular mit Datei und «Gültig bis») und «Verknüpfung lösen» (Button mit Bestätigung im Formular selbst, keine `confirm()`-Dialoge).
3. Für Schreibberechtigte darunter: «Dokument hochladen» (Titel, Datei, Gültig bis) und, falls `listLinkableDocuments` etwas liefert, «Vorhandenes Dokument verknüpfen» (Auswahl und Button). Nicht schreibberechtigte Rollen sehen nur die Tabelle und die Downloads, plus den Satz «Mit Ihrer Rolle sind Nachweise schreibgeschützt.».
4. Leerzustand: «Für dieses Kriterium ist noch kein Dokument verknüpft.»

`page.tsx` bindet die Sektion unter «Bewertung» ein (eigene `<Suspense>`-Grenze, eigener Loader, kein wachsender Join). Die Historie nutzt die neue Signatur (Task 2) und zeigt Dokument-Events mit.

- [ ] **Step 2: Dokumentenliste und Navigation**

`documents/page.tsx` (Server, Suspense): Tabelle aller Dokumente der Organisation: Titel, aktuelle Version (Datei, Version), Gültig bis, Zustand (Textlabel), Anzahl Versionen, verknüpfte Kriterien als Links `/criteria/<nummer>`; Download-Link der aktuellen Version; Leerzustand; Rollen ohne Schreibrecht sehen dieselbe Liste. `app-nav.tsx`: Eintrag «Dokumente» (`/documents`) mit der Aktiv-Logik aus Plan 2. `proxy.ts`-Matcher um `/documents/:path*` ergänzen.

- [ ] **Step 3: Verifikation (Browser)**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. Danach mit Headless-Chromium (scrapling-venv, Vorlage im Scratchpad) gegen den Dev-Server (Port 3100): als `owner` auf `/criteria/6.3.2` ein PDF hochladen (kleine Testdatei aus Bytes `%PDF-1.4` plus Text, per Playwright `set_input_files` mit einer Datei im Scratchpad), Titel und Ablaufdatum in der Zukunft: Meldung «Dokument hochgeladen.», die Tabelle zeigt das Dokument mit «Aktuell», der Hinweis zum Stand erscheint (6.3.2 ist im Seed kritisch), der Download liefert die gleichen Bytes; neue Version hochladen: Versionenliste zeigt V2 und V1; Datei mit falscher Endung (`x.exe` oder PDF-Name mit PNG-Inhalt): Fehlermeldung, Titel und Datum bleiben im Formular stehen; als `viewer` (Cookie-Login): Tabelle und Download sichtbar, keine Formulare; als `editor`: Formulare sichtbar, Historie nicht; `/documents` listet das Dokument. Konsole leer, Dev-Log ohne `uncached data` und Hydration-Meldungen.

```bash
git add qm/ && git commit -m "feat(qm): add evidence section on the criterion page and a documents list"
```

---

### Task 6: Demo-Seed und Story-Abnahme

**Files:**
- Create: `qm/src/seed/demo-documents.ts`
- Modify: `qm/src/seed/demo.ts`, `qm/src/seed/demo.test.ts`

**Interfaces:**
- Consumes: `createDocument`, `addDocumentVersion`, `getDashboard`, `getEvidenceInfo`, `addDays`, `zurichDate`.
- Produces: `buildDemoPdf(title: string, lines: string[]): Uint8Array` (gültiges, minimales PDF mit sichtbarem «Demo»), `seedDemoDocuments(ctx, now)`.

Demo-Story (Daten relativ zu `now`, alles synthetisch, Texte enthalten «Demo»):

| Dokument | Verknüpft mit | Versionen |
|---|---|---|
| Hygienekonzept (Demo) | 7.3.10 | V1 gültig bis `heute - 30 Tage` (veraltet) |
| Organigramm (Demo) | 5.2.2 | V1 gültig bis `heute + 400 Tage` |
| Einsatzprotokoll-Vorlage (Demo) | 6.11, 6.11.1 | V1 ohne Ablaufdatum |
| Fahrzeugcheckliste (Demo) | 7.3.8 | V1 gültig bis `heute + 60 Tage`, V2 gültig bis `heute + 420 Tage` |
| Dienstplanung (Demo) | 7.3.1 | V1 gültig bis `heute + 200 Tage` |
| Notfallkonzept Hitze (Demo) | 7.3.9 | V1 gültig bis `heute - 5 Tage` (veraltet) |
| Weiterbildungsplan (Demo) | 7.7 | V1 gültig bis `heute + 300 Tage` |

6.3.2 (kritisch) bleibt bewusst OHNE Dokument: Es ist der Einstieg der Live-Story («Upload, aktuelle Version, Hinweis zum Stand, Bewertung setzen»). 7.3.10 ist die zweite Story («veralteter Nachweis ersetzen»). Alle Dokumente werden über die Services angelegt (auditiert), nicht über direkte Inserts. Verknüpfte Kriterien müssen im Katalog existieren (laut Fehler bei fehlender Nummer, wie bei den Overrides).

- [ ] **Step 1: Failing tests**

An `qm/src/seed/demo.test.ts` ergänzen: Nach `seedDemo({ catalog, now: NOW })` (fester Zeitpunkt) liefert `getDashboard`: `evidence.stale === 2`, `evidence.current >= 4`, Action-Items vom Typ `evidence` enthalten «Nachweis veraltet» für 7.3.10 und 7.3.9 und einen gebündelten Eintrag «… erfüllte Pflichtkriterien ohne Nachweis»; die Readiness bleibt `critical` mit unverändert zwei kritischen Pflichtkriterien (Review Focus 4); `listCriterionEvidence(ctx, "7.3.8", NOW)` hat zwei Versionen (V2 aktuell); `listCriterionEvidence(ctx, "6.3.2", NOW).state === "none"`; die Story-Schritte als Test: `addDocumentVersion` auf das Hygienekonzept mit Ablaufdatum in der Zukunft macht den Zustand von 7.3.10 `current`, entfernt das Evidence-Item «Nachweis veraltet» für 7.3.10 aus dem Action Center und lässt Status und Readiness unverändert; erst `setAssessmentStatus(ctx, id7310, "met")` senkt `readiness.mandatory.critical` von 2 auf 1.

Run: `pnpm test src/seed/demo.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implementation**

`demo-documents.ts`: `buildDemoPdf` baut ein minimales, gültiges PDF (Header `%PDF-1.4`, ein Katalog-, Seiten- und Seitenobjekt, ein Inhaltsstrom mit einer Textzeile in Helvetica, `xref` und `trailer` mit korrekten Byte-Offsets, damit gängige Betrachter es öffnen) und liefert Bytes unter 4 MiB (hier wenige hundert Bytes). Die Titel und Zeilen enthalten ausdrücklich «Demo» und keine realen Namen. `seedDemoDocuments(ctx, now)` legt die Tabelle oben über `createDocument`/`addDocumentVersion` an. `demo.ts` ruft es nach der Bewertungsstory (damit die Nummern existieren) mit dem Owner-Kontext und `now` auf; `now` kommt aus dem Parameter, nicht aus `new Date()` in der Fachlogik.

- [ ] **Step 3: Tests, Seed, Gesamtabnahme**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: alles grün.

Run: `pnpm seed:demo -- --yes-reset` und `docker compose exec db psql -U qm -d qm_dev -c "select d.title, count(v.*) as versionen from document d join document_version v on v.document_id = d.id group by 1 order by 1"`
Expected: sieben Dokumente, Fahrzeugcheckliste mit 2 Versionen.

Gesamtabnahme der Demo-Strecke per Headless-Chromium als `owner` (ein Skript, Screenshots auf dem Desktop, danach löschen): Dashboard zeigt «Veraltet 2» und den Action-Center-Eintrag «Nachweis veraltet» zu 7.3.10; auf `/criteria/7.3.10` neue Version hochladen (Ablaufdatum in der Zukunft): Nachweis «Aktuell», Hinweis «Ein aktueller Nachweis liegt vor...», Stand weiterhin «Kritisch»; Dashboard: «Veraltet» sinkt auf 1, der Eintrag verschwindet, Status und Readiness unverändert; Stand auf «Erfüllt» setzen: «Kritische Pflichtkriterien» sinkt auf 1; Verlauf der Kriteriumsseite zeigt Upload, neue Version und Statusänderung in der richtigen Reihenfolge. Danach erneut `pnpm seed:demo -- --yes-reset`.

```bash
git add qm/ && git commit -m "feat(qm): seed demo documents and verify the evidence story end to end"
```

---

## Abschluss Plan 4 (Definition of Done)

- `pnpm test`, `typecheck`, `lint`, `build` grün; Migration `0006` auf frischer Datenbank anwendbar.
- Dokumente werden versioniert, nie überschrieben (Trigger und Service), alte Versionen bleiben herunterladbar; Upload, Version, Verknüpfung und Lösen sind auditiert und erscheinen in der Kriterien-Historie.
- Mandantentrennung bis auf Datenbankebene (zusammengesetzte Fremdschlüssel) und im Download-Handler belegt.
- Die Oberfläche trennt «Dokument vorhanden», «Dokument aktuell» und «Kriterium erfüllt»; ein Upload verändert nie den Bewertungsstand oder die Readiness.
- Dashboard: Nachweiszähler, «Nachweis veraltet»-Einträge und ein gebündelter «ohne Nachweis»-Eintrag; Kriterienliste mit Nachweis-Spalte und Filter.
- Demo-Story durchgespielt: veralteter Nachweis, Upload, neue Version, Dashboard verändert, Bewertung bewusst gesetzt, Readiness verändert.
- Nichts gepusht ohne Freigabe.

## Self-Review (vom Plan-Autor durchgeführt)

- **Spec-Abdeckung:** Alle sechs Vorgaben von Henrik (Versionierung ohne Überschreiben, Tenant-Isolation, Audit für Upload/Version/Verknüpfung, keine magische Statusänderung, Dreiteilung der Anzeige, Reihenfolge) sind Tasks 1 bis 6 zugeordnet. Die Review-Risiken aus Plan 3 (Historie nur nach Assessment-ID, Dokumente org-weit mit Link-Tabelle, ActionItem mit `href` und offener Quelle, getrennte Loader) sind in Task 1 bis 3 und 5 gelöst.
- **Platzhalter-Scan:** keine. Task 2 und 4 beschreiben Services und Actions verbindlich über Eigenschaften und Tests statt über vollständigen Code, weil die Tests das Verhalten exakt festlegen; die reinen Module und das Schema sind vollständig ausformuliert.
- **Typkonsistenz:** `EvidenceState` (Task 1) in Task 2, 3, 5; `VersionView`/`EvidenceDoc` (Task 2) in Task 5; `ActionItem.href` (Task 3) in Task 5; `getEvidenceInfo` (Task 3) und `getEvidenceStates` (Task 2) benannt und als Wrapper beschrieben.
- **Bekannte Grenzen:** Datei-Bytes in Postgres (R24) und 4 MiB-Grenze (R25); kein Virenscan; kein Download-Audit; keine Freigabe (`approve`) von Dokumenten; Massnahmen folgen in Plan 5.
