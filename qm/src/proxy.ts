import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  // Nur ein schneller Cookie-Check. Die eigentliche Prüfung macht requireOrgContext() serverseitig.
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/", "/criteria/:path*", "/documents/:path*"] };
