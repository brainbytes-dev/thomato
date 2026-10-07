export const ROLES = ["owner", "qm_admin", "reviewer", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export type Rights = Partial<Record<string, readonly string[]>>;

const READ_ALL = {
  assessment: ["read"],
  measure: ["read"],
  document: ["read"],
} as const;

export const ROLE_RIGHTS = {
  owner: {
    organization: ["update", "delete"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    assessment: ["read", "write", "approve"],
    measure: ["read", "write"],
    document: ["read", "write", "approve"],
  },
  qm_admin: {
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    assessment: ["read", "write", "approve"],
    measure: ["read", "write"],
    document: ["read", "write", "approve"],
  },
  reviewer: {
    assessment: ["read", "write", "approve"],
    measure: ["read", "write"],
    document: ["read", "write", "approve"],
  },
  editor: {
    assessment: ["read", "write"],
    measure: ["read", "write"],
    document: ["read", "write"],
  },
  viewer: READ_ALL,
} as const satisfies Record<Role, Rights>;

export type Resource = "organization" | "member" | "invitation" | "assessment" | "measure" | "document";

export function can(role: Role, resource: Resource, action: string): boolean {
  const rights: Rights = ROLE_RIGHTS[role];
  return rights[resource]?.includes(action) ?? false;
}
