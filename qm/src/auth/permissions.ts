import { createAccessControl } from "better-auth/plugins/access";
import { RESOURCE_ACTIONS, ROLE_RIGHTS } from "@/domain/rights";

export const statement = RESOURCE_ACTIONS;

export const ac = createAccessControl(statement);

export const roles = {
  owner: ac.newRole(ROLE_RIGHTS.owner),
  qm_admin: ac.newRole(ROLE_RIGHTS.qm_admin),
  reviewer: ac.newRole(ROLE_RIGHTS.reviewer),
  editor: ac.newRole(ROLE_RIGHTS.editor),
  viewer: ac.newRole(ROLE_RIGHTS.viewer),
};
