export const ROLES = ["owner", "qm_admin", "reviewer", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

// Einzige Quelle für Ressourcen und Aktionen; auth/permissions.ts leitet daraus das Better-Auth-Statement ab.
export const RESOURCE_ACTIONS = {
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  assessment: ["read", "write", "approve"],
  measure: ["read", "write", "approve"],
  document: ["read", "write", "approve"],
  audit: ["read"],
  deadline: ["read"],
} as const;

export type Resource = keyof typeof RESOURCE_ACTIONS;
export type ActionOf<R extends Resource> = (typeof RESOURCE_ACTIONS)[R][number];

export type Rights = { [R in Resource]?: readonly ActionOf<R>[] };

const READ_ALL = {
  assessment: ["read"],
  measure: ["read"],
  document: ["read"],
  deadline: ["read"],
} as const;

export const ROLE_RIGHTS = {
  owner: {
    organization: ["update", "delete"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    assessment: ["read", "write", "approve"],
    measure: ["read", "write", "approve"],
    document: ["read", "write", "approve"],
    audit: ["read"],
    deadline: ["read"],
  },
  qm_admin: {
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    assessment: ["read", "write", "approve"],
    measure: ["read", "write", "approve"],
    document: ["read", "write", "approve"],
    audit: ["read"],
    deadline: ["read"],
  },
  reviewer: {
    assessment: ["read", "write", "approve"],
    measure: ["read", "write", "approve"],
    document: ["read", "write", "approve"],
    deadline: ["read"],
  },
  editor: {
    assessment: ["read", "write"],
    measure: ["read", "write"],
    document: ["read", "write"],
    deadline: ["read"],
  },
  viewer: READ_ALL,
} as const satisfies Record<Role, Rights>;

export function can<R extends Resource>(role: Role, resource: R, action: ActionOf<R>): boolean {
  const allowed: readonly string[] | undefined = ROLE_RIGHTS[role][resource as keyof (typeof ROLE_RIGHTS)[Role]];
  return allowed?.includes(action) ?? false;
}
