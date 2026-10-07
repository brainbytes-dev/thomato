import { createAccessControl } from "better-auth/plugins/access";
import { ROLE_RIGHTS } from "@/domain/rights";

export const statement = {
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  assessment: ["read", "write", "approve"],
  measure: ["read", "write"],
  document: ["read", "write", "approve"],
} as const;

export const ac = createAccessControl(statement);

export const roles = {
  owner: ac.newRole(ROLE_RIGHTS.owner),
  qm_admin: ac.newRole(ROLE_RIGHTS.qm_admin),
  reviewer: ac.newRole(ROLE_RIGHTS.reviewer),
  editor: ac.newRole(ROLE_RIGHTS.editor),
  viewer: ac.newRole(ROLE_RIGHTS.viewer),
};
