import { addDays, zurichDate } from "@/domain/dates";
import { addDocumentVersion, createDocument } from "@/domain/documents";
import type { OrgContext } from "@/domain/org-context";

function pdfEscape(text: string): string {
  return text.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, "?");
}

/**
 * Minimales, gültiges PDF (eine Seite, Helvetica) mit korrekten xref-Offsets.
 * Deterministisch: kein Zeitstempel, keine ID, keine Zufallswerte.
 */
export function buildDemoPdf(title: string, lines: string[]): Uint8Array {
  const text = [
    "BT",
    "/F1 20 Tf",
    "72 760 Td",
    "24 TL",
    `(${pdfEscape(title)}) Tj`,
    "/F1 12 Tf",
    ...lines.flatMap((line) => ["T*", `(${pdfEscape(line)}) Tj`]),
    "ET",
  ].join("\n");
  const stream = Buffer.from(text, "latin1");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream.toString("latin1")}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}

type DemoVersion = { validInDays: number | null };
type DemoDocument = { title: string; criteria: string[]; versions: DemoVersion[] };

const DEMO_DOCUMENTS: DemoDocument[] = [
  { title: "Hygienekonzept (Demo)", criteria: ["7.3.10"], versions: [{ validInDays: -30 }] },
  { title: "Organigramm (Demo)", criteria: ["5.2.2"], versions: [{ validInDays: 400 }] },
  { title: "Einsatzprotokoll-Vorlage (Demo)", criteria: ["6.11", "6.11.1"], versions: [{ validInDays: null }] },
  { title: "Fahrzeugcheckliste (Demo)", criteria: ["7.3.8"], versions: [{ validInDays: 60 }, { validInDays: 420 }] },
  { title: "Dienstplanung (Demo)", criteria: ["7.3.1"], versions: [{ validInDays: 200 }] },
  { title: "Notfallkonzept Hitze (Demo)", criteria: ["7.3.9"], versions: [{ validInDays: -5 }] },
  { title: "Weiterbildungsplan (Demo)", criteria: ["7.7"], versions: [{ validInDays: 300 }] },
];

function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(demo\)/, "demo")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Legt die Demo-Dokumente über die auditierten Services an. Daten relativ zu `now`. */
export async function seedDemoDocuments(ctx: OrgContext, now: Date): Promise<void> {
  const today = zurichDate(now);
  for (const doc of DEMO_DOCUMENTS) {
    let documentId: string | null = null;
    for (const [i, v] of doc.versions.entries()) {
      const version = i + 1;
      const file = {
        name: `${slug(doc.title)}-v${version}.pdf`,
        bytes: buildDemoPdf(doc.title, [
          `Version ${version}`,
          "Dies ist ein Demo-Dokument mit erfundenem Inhalt.",
          "Keine realen Personen oder Organisationen.",
        ]),
      };
      const validUntil = v.validInDays === null ? null : addDays(today, v.validInDays);
      if (documentId === null) {
        const created = await createDocument(ctx, {
          title: doc.title,
          file,
          validUntil,
          criterionNumbers: doc.criteria,
        });
        documentId = created.documentId;
      } else {
        await addDocumentVersion(ctx, documentId, { file, validUntil });
      }
    }
  }
}
