import { can, type Resource, type Role } from "./rights";

export type OrgContext = { organizationId: string; userId: string; role: Role };

export class UnauthorizedError extends Error {
  constructor(message = "Nicht angemeldet") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Keine Berechtigung") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertCan(ctx: OrgContext, resource: Resource, action: string): void {
  if (!can(ctx.role, resource, action)) {
    throw new ForbiddenError(`${ctx.role} darf ${resource}.${action} nicht`);
  }
}
