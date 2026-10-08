/**
 * Prüft die Wissenstexte (src/content/wissen) gegen den Text der lokalen IVR-PDFs auf gemeinsame
 * Wortfolgen von sechs oder mehr Wörtern. Aufruf: pnpm wissen:check [richtlinie.pdf handbuch.pdf]
 * Ohne Argumente: Verzeichnis aus WISSEN_PDF_DIR bzw. dem dokumentierten Standardpfad unter $HOME,
 * die Dateien enden auf 8eaa0c3a.pdf (Richtlinie) und 99690f98.pdf (Handbuch).
 *
 * WICHTIG: Das ist ein technisches Warnsystem, KEINE juristische Freigabe. Es findet nur wörtliche
 * Übereinstimmungen. Paraphrasen, übernommene Gliederung, Aufzählungsreihenfolge und Satzbau erkennt es
 * nicht; dafür bleibt die Durchsicht durch Menschen nötig.
 *
 * Der PDF-Text wird mit pdftotext in einen temporären Ordner AUSSERHALB des Repos geschrieben und danach
 * gelöscht. Trefferfolgen erscheinen nur im Terminal und werden nie in eine Datei geschrieben.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { WISSEN_CHAPTERS } from "../src/content/wissen";

const RUN = 6;
const DEFAULT_DIR = path.join(homedir(), "IVR_NotebookLM_failed_attempt_20260919/01_Rettungsdienst/aktuell");
const PDFTOTEXT = existsSync("/opt/homebrew/bin/pdftotext") ? "/opt/homebrew/bin/pdftotext" : "pdftotext";

function resolvePdfs(args: string[]): string[] {
  if (args.length > 0) return args;
  const dir = process.env.WISSEN_PDF_DIR ?? DEFAULT_DIR;
  const files = readdirSync(dir);
  const pick = (suffix: string) => {
    const f = files.find((n) => n.endsWith(suffix));
    if (!f) throw new Error(`Kein PDF mit Endung ${suffix} in ${dir}`);
    return path.join(dir, f);
  };
  return [pick("8eaa0c3a.pdf"), pick("99690f98.pdf")];
}

/** Klein, ohne Silbentrennung am Zeilenende, nur Buchstaben und Ziffern, einfache Leerzeichen. */
export function normalizeWords(text: string): string[] {
  return text
    .replace(/-\s*\n\s*/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

export function gramSet(words: readonly string[], n: number): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i + n <= words.length; i += 1) set.add(words.slice(i, i + n).join(" "));
  return set;
}

/** Längste zusammenhängende Treffer (maximal erweitert) von mindestens n Wörtern. */
export function findRuns(words: readonly string[], grams: ReadonlySet<string>, n: number): string[] {
  const runs: string[] = [];
  let i = 0;
  while (i + n <= words.length) {
    if (grams.has(words.slice(i, i + n).join(" "))) {
      let end = i + n;
      while (end < words.length && grams.has(words.slice(end - n + 1, end + 1).join(" "))) end += 1;
      runs.push(words.slice(i, end).join(" "));
      i = end;
    } else {
      i += 1;
    }
  }
  return runs;
}

function main(): number {
  const pdfs = resolvePdfs(process.argv.slice(2));
  const tmp = mkdtempSync(path.join(tmpdir(), "qm-wissen-"));
  try {
    const all: string[] = [];
    for (const [i, pdf] of pdfs.entries()) {
      const out = path.join(tmp, `${i}.txt`);
      execFileSync(PDFTOTEXT, ["-layout", pdf, out]);
      all.push(...normalizeWords(readFileSync(out, "utf8")));
      console.log(`PDF ${i + 1}: ${path.basename(pdf)}`);
    }
    const grams = gramSet(all, RUN);
    let sections = 0;
    let hits = 0;
    for (const c of WISSEN_CHAPTERS) {
      const units = [
        { id: `${c.slug}/summary`, text: `${c.title} ${c.summary}` },
        ...c.sections.map((s) => ({ id: `${c.slug}/${s.id}`, text: [s.heading, ...s.paragraphs, s.appNote ?? ""].join("\n") })),
      ];
      for (const u of units) {
        sections += 1;
        const runs = findRuns(normalizeWords(u.text), grams, RUN);
        for (const r of runs) {
          hits += 1;
          console.log(`TREFFER ${u.id}: «${r}»`);
        }
      }
    }
    console.log(`Geprüfte Abschnitte: ${sections}, Treffer (${RUN}+ Wörter): ${hits}`);
    console.log("Hinweis: technisches Warnsystem, keine juristische Freigabe.");
    return hits === 0 ? 0 : 1;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename ?? "")) {
  process.exit(main());
}
