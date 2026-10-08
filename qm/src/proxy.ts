import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { isWissenSlug } from "@/content/wissen";
import { criterionExistsMemoized } from "@/domain/criterion-lookup";
import { measureProvablyMissing } from "@/domain/measure-lookup";

const CRITERION_PATH = /^\/criteria\/([^/]+)\/?$/;
const MEASURE_PATH = /^\/measures\/([^/]+)\/?$/;
const WISSEN_PATH = /^\/wissen\/(.+?)\/?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Fällt die Katalogabfrage aus (Datenbank kurz weg), geht die Anfrage weiter: Die Seite prüft ohnehin selbst
// und der Proxy soll nie wegen einer Datenbankstörung jede Kriterienseite mit 500 beantworten.
async function existsOrAssume(raw: string): Promise<boolean> {
  try {
    return await criterionExistsMemoized(raw);
  } catch {
    return true;
  }
}

// Eigenes Zeitlimit: Ist die Datenbank überlastet, soll die Seite nicht bis zum Pool-Timeout im Proxy hängen.
const LOOKUP_TIMEOUT_MS = 1500;

async function missingOrAssumeFound(cookie: string, id: string): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), LOOKUP_TIMEOUT_MS);
  });
  try {
    return await Promise.race([measureProvablyMissing(cookie, id), timeout]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function proxy(request: NextRequest) {
  // Unbekannte oder ungültige Kriteriumsnummern bekommen hier schon den echten Status 404 (R51): Hinter der
  // Suspense-Grenze der Seite hat die Antwort bereits mit 200 zu streamen begonnen. Der Katalog ist global und
  // enthält keine Mandantendaten, die Prüfung verrät also nur, dass eine Nummer nicht im Katalog steht.
  const match = CRITERION_PATH.exec(request.nextUrl.pathname);
  if (match && !(await existsOrAssume(match[1]))) {
    return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
  }
  // Massnahmen-IDs sind UUIDs: Alles andere ist nie gültig und bekommt schon hier den echten 404. Ob eine gültige ID
  // zur eigenen Organisation gehört, weiss nur die Seite (mit Sitzung); sie antwortet für fremde und unbekannte IDs gleich.
  const measure = MEASURE_PATH.exec(request.nextUrl.pathname);
  if (measure && !UUID.test(measure[1])) {
    return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
  }
  // Wissensseiten sind statisch: Ein unbekanntes Kapitel bekommt den echten 404, auch ohne Sitzung (kein Mandantenbezug).
  const wissen = WISSEN_PATH.exec(request.nextUrl.pathname);
  if (wissen) {
    let slug = wissen[1];
    try {
      slug = decodeURIComponent(slug);
    } catch {
      // Ungültige Kodierung: bleibt unbekannt.
    }
    if (!isWissenSlug(slug)) return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
  }
  // Nur ein schneller Cookie-Check. Die eigentliche Prüfung macht requireOrgContext() serverseitig.
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  // Echter 404 (R55) für unbekannte und fremde Massnahmen: Hinter der Suspense-Grenze der Seite wäre es ein 200.
  // Entschieden wird nur, wenn die Datenbank beweist, dass die ID in der aktiven Organisation der Sitzung fehlt
  // (Token aus dem Cookie, Signatur ungeprüft, siehe measure-lookup). Unbekannte oder abgelaufene Sitzung und jeder
  // Datenbankfehler gehen normal weiter; die Seite bleibt die Instanz für Sitzung und Mandant und antwortet nie mit 500 vom Proxy.
  if (measure && (await missingOrAssumeFound(sessionCookie, measure[1]))) {
    return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/", "/criteria/:path*", "/measures/:path*", "/documents/:path*", "/wissen/:path*"] };
