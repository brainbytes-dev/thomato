import type { ActionItem } from "./dashboard";

export const ACTION_FILTERS = ["all", "critical", "deadline", "evidence"] as const;
export type ActionFilter = (typeof ACTION_FILTERS)[number];

export const ACTION_FILTER_LABEL: Record<ActionFilter, string> = {
  all: "Alle",
  critical: "Kritisch",
  deadline: "Fristen",
  evidence: "Nachweise",
};

/** Kategorien dürfen sich überschneiden: eine überfällige Frist ist «Kritisch» und «Frist». */
export function matchesActionFilter(item: Pick<ActionItem, "priority" | "source">, filter: ActionFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "critical":
      return item.priority === "critical";
    case "deadline":
      return item.source === "deadline" || item.source === "measure";
    case "evidence":
      return item.source === "evidence";
  }
}

export function countByActionFilter(items: ReadonlyArray<Pick<ActionItem, "priority" | "source">>): Record<ActionFilter, number> {
  return Object.fromEntries(
    ACTION_FILTERS.map((f) => [f, items.filter((i) => matchesActionFilter(i, f)).length]),
  ) as Record<ActionFilter, number>;
}
