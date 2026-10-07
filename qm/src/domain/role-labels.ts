import type { Role } from "./rights";

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Inhaber",
  qm_admin: "QM-Verantwortliche",
  reviewer: "Reviewer",
  editor: "Bearbeitung",
  viewer: "Lesezugriff",
};
