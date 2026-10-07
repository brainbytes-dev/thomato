import { headers } from "next/headers";
import { auth } from "@/auth/auth";
import { ForbiddenError, UnauthorizedError, type OrgContext } from "./org-context";
import { ROLES, type Role } from "./rights";

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Liest Session und aktive Mitgliedschaft aus dem Request. Nur in Server Components, Actions und Route Handlers. */
export async function requireOrgContext(): Promise<OrgContext> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session) throw new UnauthorizedError();
  const member = await auth.api.getActiveMember({ headers: h });
  if (!member || !isRole(member.role)) throw new ForbiddenError("Keine aktive Organisation");
  return { organizationId: member.organizationId, userId: session.user.id, role: member.role };
}
