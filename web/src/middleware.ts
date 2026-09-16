import { NextResponse, type NextRequest } from "next/server";

/**
 * Baustellensperre vor dem Qualitätsmanagement-Tool.
 *
 * Michael am 16.09.2026: «kannst du vor die seite qualitätsmanagement tool
 * ein benutzer ivr und passwort ivr setzen bis das abgeklärt ist». Gemeint
 * ist die Frage, ob der Name des Interverbands im Produkt vorkommen darf.
 * Solange sie offen ist, soll die Seite nicht öffentlich stehen.
 *
 * Die Abfrage läuft hier und nicht im Browser: eine Abfrage im Browser käme
 * zu spät, die Seite wäre dann schon ausgeliefert und im Quelltext lesbar.
 * Routing Middleware ist eine Funktion der Plattform und läuft vor der
 * Auslieferung, auch bei statisch vorgerenderten Seiten.
 *
 * Gilt für die Produktseite und für alles darunter, also auch für die Demo
 * unter /qualitaetsmanagement-tool/demo. Die alte Adresse /ivr-anerkennung
 * leitet vorher um und landet damit ebenfalls hier.
 *
 * Zum Aufschalten wird diese Datei gelöscht und die Seite in die Sitemap
 * zurückgeholt, siehe app/sitemap.ts. Eine Datei weniger vergisst man nicht.
 */

// Benutzer und Passwort stehen in den Umgebungsvariablen, damit sie sich
// ohne Änderung am Code wechseln lassen. Der Rückfallwert ist der
// abgemachte: Die Sperre hält Suchmaschinen, Neugierige und weitergegebene
// Links draussen, mehr soll sie nicht.
const BENUTZER = process.env.QM_BENUTZER || "ivr";
const PASSWORT = process.env.QM_PASSWORT || "ivr";

// Der realm steht im Anmeldefenster des Browsers und gehört in reines
// ASCII: Umlaute werden im Kopf WWW-Authenticate prozentkodiert, und im
// Fenster stünde dann «in Abkl%C3%A4rung».
const BEREICH = "Qualitaetsmanagement-Tool, in Abklaerung";

/** Benutzer und Passwort aus dem Authorization-Kopf, oder null. */
function anmeldung(kopf: string | null) {
  if (!kopf?.startsWith("Basic ")) return null;
  let text: string;
  try {
    // atob liefert Bytes als Zeichen. Über Latin-1 zurück nach UTF-8,
    // sonst zerfällt ein Umlaut im Passwort.
    const roh = atob(kopf.slice(6));
    text = new TextDecoder().decode(
      Uint8Array.from(roh, (zeichen) => zeichen.charCodeAt(0)),
    );
  } catch {
    return null;
  }
  // Der Doppelpunkt trennt nur beim ersten Vorkommen; im Passwort darf
  // einer stehen.
  const trenner = text.indexOf(":");
  if (trenner < 0) return null;
  return { benutzer: text.slice(0, trenner), passwort: text.slice(trenner + 1) };
}

export function middleware(request: NextRequest) {
  const daten = anmeldung(request.headers.get("authorization"));

  if (daten?.benutzer === BENUTZER && daten.passwort === PASSWORT) {
    // Durchgelassen, aber nicht in den Suchindex: Wer das Passwort hat,
    // soll die Seite sehen dürfen, ohne dass sie dadurch öffentlich wird.
    const antwort = NextResponse.next();
    antwort.headers.set("X-Robots-Tag", "noindex, nofollow");
    return antwort;
  }

  return new NextResponse("Diese Seite ist noch nicht öffentlich.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${BEREICH}", charset="UTF-8"`,
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      // Weder Browser noch Netz sollen die Sperre zwischenspeichern; sonst
      // bleibt sie nach dem Aufschalten noch eine Weile stehen.
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: ["/qualitaetsmanagement-tool", "/qualitaetsmanagement-tool/:pfad*"],
};
