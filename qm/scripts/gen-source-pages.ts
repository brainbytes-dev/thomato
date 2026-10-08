/**
 * Erzeugt src/domain/source-pages.ts aus den lokalen offiziellen PDFs.
 *
 * Aufruf: pnpm sources:gen [--dir <PDF-Ordner>]   (oder Umgebungsvariable SOURCE_PDF_DIR)
 * Die PDFs liegen bewusst ausserhalb des Repos. Das Skript bricht ab, wenn die SHA-256 eines
 * PDFs nicht zur Registry (src/domain/sources.ts) passt: dann ist die Zuordnung ungeprüft.
 * Es liest nur Seitenzahlen und Nummern, es schreibt keinen Dokumenttext.
 *
 * Methode: `pdftotext -bbox-layout` liefert Wortpositionen. Eine Kriteriennummer ist ein Wort
 * ganz links in der Tabelle (Richtlinie Kap. 6 bis 8, Seiten 11 bis 20; Handbuch 5.2, eingerückt,
 * nach dem Inhaltsverzeichnis). Querverweise im Fliesstext stehen weiter rechts und fallen heraus.
 * 7.4.1 hat keine eigene Nummer; sie wird über die Bezeichnung (Katalogtitel) gesucht.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SOURCES, type SourceId } from "../src/domain/sources";

const CATALOG = path.resolve(import.meta.dirname, "../../web/ivr/demo/kriterien.json");
const OUT = path.resolve(import.meta.dirname, "../src/domain/source-pages.ts");
const DEFAULT_DIR = path.join(process.env.HOME ?? "", "IVR_NotebookLM_failed_attempt_20260919/01_Rettungsdienst/aktuell");
const PDFTOTEXT = process.env.PDFTOTEXT ?? "/opt/homebrew/bin/pdftotext";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const dir = arg("--dir") ?? process.env.SOURCE_PDF_DIR ?? DEFAULT_DIR;

function findPdf(id: SourceId): string {
  const prefix = SOURCES[id].sha256.slice(0, 8);
  const hit = readdirSync(dir).find((f) => f.endsWith(`_${prefix}.pdf`));
  if (!hit) throw new Error(`PDF für ${id} (…${prefix}.pdf) nicht in ${dir} gefunden`);
  return path.join(dir, hit);
}

function verifiedPdf(id: SourceId): string {
  const file = findPdf(id);
  const sha = createHash("sha256").update(readFileSync(file)).digest("hex");
  if (sha !== SOURCES[id].sha256) {
    throw new Error(`${id}: SHA-256 ${sha} weicht von der Registry ab. Zuordnung ungeprüft, nicht erzeugen.`);
  }
  return file;
}

type Word = { page: number; x: number; text: string };

function words(file: string): Word[] {
  const xml = execFileSync(PDFTOTEXT, ["-bbox-layout", file, "-"], { maxBuffer: 256 * 1024 * 1024 }).toString("utf8");
  const out: Word[] = [];
  let page = 0;
  for (const m of xml.matchAll(/<page |<word xMin="([\d.]+)"[^>]*>([^<]*)<\/word>/g)) {
    if (m[0] === "<page ") page += 1;
    else out.push({ page, x: Number(m[1]), text: m[2] });
  }
  return out;
}

type CatalogRow = { nummer: string; titel: string };
const catalog = JSON.parse(readFileSync(CATALOG, "utf8")) as CatalogRow[];
const numbers = catalog.map((r) => r.nummer);

const rw = words(verifiedPdf("richtlinie"));
const hw = words(verifiedPdf("handbuch"));

const result = new Map<string, { source: SourceId; page: number }>();

function record(n: string, source: SourceId, page: number) {
  if (result.has(n)) throw new Error(`${n}: mehrfach gefunden (Seite ${result.get(n)?.page} und ${page})`);
  result.set(n, { source, page });
}

// Richtlinie: Tabellenspalte «Nr.» ganz links, Kapitel 6 bis 8 auf den Seiten 11 bis 20.
for (const w of rw) {
  if (w.page >= 11 && w.page <= 20 && w.x < 70 && numbers.includes(w.text) && /^[678]\./.test(w.text)) {
    record(w.text, "richtlinie", w.page);
  }
}
// Handbuch 5.2.x: eingerückt (x ≈ 85), nach dem Inhaltsverzeichnis (Seite 3).
for (const w of hw) {
  if (w.page > 3 && w.x > 80 && w.x < 90 && /^5\.2\.[1-4]$/.test(w.text)) record(w.text, "handbuch", w.page);
}
// 7.4.1: Unterpunkt ohne eigene Nummer, gesucht über die Bezeichnung hinter der Zeile 7.4.
const sub = catalog.find((r) => r.nummer === "7.4.1");
if (sub) {
  const first = sub.titel.split(/\s+/)[0];
  const parent = result.get("7.4");
  const hit = rw.find(
    (w, i) =>
      w.page >= (parent?.page ?? 11) && w.page <= 20 && w.text === first &&
      rw.slice(i, i + sub.titel.split(/\s+/).length).map((x) => x.text).join(" ") === sub.titel,
  );
  if (!hit) throw new Error("7.4.1: Bezeichnung im Richtlinientext nicht gefunden");
  record("7.4.1", "richtlinie", hit.page);
}

const missing = numbers.filter((n) => !result.has(n));
const extra = [...result.keys()].filter((n) => !numbers.includes(n));
if (missing.length || extra.length) throw new Error(`Lücken: ${missing.join(", ")}; unbekannt: ${extra.join(", ")}`);

const lines = numbers.map((n) => {
  const e = result.get(n);
  return `  "${n}": { source: "${e?.source}", page: ${e?.page} },`;
});

const header = `/**
 * GENERIERT von scripts/gen-source-pages.ts (pnpm sources:gen). Nicht von Hand ändern.
 *
 * Zuordnung Katalognummer -> Quelle und Seite. Nur Nummern und Seitenzahlen, kein Dokumenttext.
 * Erzeugt aus: ${SOURCES.richtlinie.title}, ${SOURCES.richtlinie.edition}
 *   SHA-256 ${SOURCES.richtlinie.sha256}
 * und: Handbuch zum Verfahren, ${SOURCES.handbuch.edition}
 *   SHA-256 ${SOURCES.handbuch.sha256}
 * Seitenzahl = PDF-Seite = gedruckte Seitenzahl. 7.4.1 ist ein Unterpunkt ohne eigene Nummer
 * (Seite, auf der die Bezeichnung steht). Weicht die Prüfsumme eines PDFs ab (pnpm sources:check),
 * ist diese Zuordnung ungeprüft, bis sie neu erzeugt und kontrolliert wurde.
 */
import type { SourceId } from "./sources";

export const SOURCE_PAGES: Readonly<Record<string, { source: SourceId; page: number }>> = {
${lines.join("\n")}
};
`;
writeFileSync(OUT, header);
console.log(`source-pages.ts: ${result.size} Nummern geschrieben`);
