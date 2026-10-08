/**
 * Prüft die offiziellen PDFs bei 144.ch: erreichbar, und stimmt die SHA-256 mit der Registry?
 * Nicht Teil von CI oder Tests (braucht Netz). Aufruf: pnpm sources:check
 * Weicht eine Prüfsumme ab, wurde das PDF unter derselben URL ersetzt: ALARM, Exit-Code 1.
 * Die Seitenzuordnung ist dann ungeprüft; neu erzeugen (pnpm sources:gen) und nachkontrollieren.
 * Downloads landen in einem temporären Ordner ausserhalb des Repos und werden danach gelöscht.
 */
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SOURCES } from "../src/domain/sources";

async function main(): Promise<number> {
  const dir = mkdtempSync(path.join(tmpdir(), "qm-sources-"));
  let alarms = 0;
  try {
    for (const s of Object.values(SOURCES)) {
      try {
        const head = await fetch(s.url, { method: "HEAD", redirect: "follow" });
        if (!head.ok) throw new Error(`HEAD ${head.status}`);
        const res = await fetch(s.url, { redirect: "follow" });
        if (!res.ok) throw new Error(`GET ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        writeFileSync(path.join(dir, `${s.id}.pdf`), buf);
        const sha = createHash("sha256").update(buf).digest("hex");
        if (sha === s.sha256) {
          console.log(`OK     ${s.id}: ${s.shortLabel}, Prüfsumme stimmt (${buf.length} Bytes)`);
        } else {
          alarms += 1;
          console.log(
            `ALARM  ${s.id}: Prüfsumme weicht ab.\n       erwartet ${s.sha256}\n       gefunden ${sha}\n` +
              "       Das PDF wurde unter derselben URL ersetzt. Seitenzuordnung neu erzeugen (pnpm sources:gen) und neu prüfen.",
          );
        }
      } catch (e) {
        alarms += 1;
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`ALARM  ${s.id}: nicht prüfbar (${msg}). URL: ${s.url}`);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return alarms === 0 ? 0 : 1;
}

main().then((code) => process.exit(code));
