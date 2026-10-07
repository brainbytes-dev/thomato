import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth/auth";
import { ForbiddenError, UnauthorizedError, type OrgContext } from "./org-context";
import { ROLES, type Role } from "./rights";

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Liest Session und aktive Mitgliedschaft aus dem Request. Nur in Server Components, Actions und Route Handlers. */
export const requireOrgContext = cache(async (): Promise<OrgContext> => {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session) throw new UnauthorizedError();
  const member = await auth.api.getActiveMember({ headers: h });
  if (!member || !isRole(member.role)) throw new ForbiddenError("Keine aktive Organisation");
  return { organizationId: member.organizationId, userId: session.user.id, role: member.role };
});

/** Wie requireOrgContext, leitet aber ohne Sitzung oder Mitgliedschaft auf /login um. Pro Request nur ein Lookup (React cache). */
export async function requireOrgContextOrRedirect(): Promise<OrgContext> {
  try {
    return await requireOrgContext();
  } catch (e) {
    if (e instanceof UnauthorizedError || e instanceof ForbiddenError) redirect("/login");
    throw e;
  }
}
