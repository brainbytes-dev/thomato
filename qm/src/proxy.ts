import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { criterionExistsMemoized } from "@/domain/criterion-lookup";

const CRITERION_PATH = /^\/criteria\/([^/]+)\/?$/;

// Fällt die Katalogabfrage aus (Datenbank kurz weg), geht die Anfrage weiter: Die Seite prüft ohnehin selbst
// und der Proxy soll nie wegen einer Datenbankstörung jede Kriterienseite mit 500 beantworten.
async function existsOrAssume(raw: string): Promise<boolean> {
  try {
    return await criterionExistsMemoized(raw);
  } catch {
    return true;
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
  // Nur ein schneller Cookie-Check. Die eigentliche Prüfung macht requireOrgContext() serverseitig.
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/", "/criteria/:path*", "/measures/:path*", "/documents/:path*"] };
