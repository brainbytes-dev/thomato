import { can, type ActionOf, type Resource, type Role } from "./rights";

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

export function assertCan<R extends Resource>(ctx: OrgContext, resource: R, action: ActionOf<R>): void {
  if (!can(ctx.role, resource, action)) {
    throw new ForbiddenError(`${ctx.role} darf ${resource}.${action} nicht`);
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
