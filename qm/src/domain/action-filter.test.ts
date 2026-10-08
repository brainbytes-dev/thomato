import { describe, expect, it } from "vitest";
import { countByActionFilter, matchesActionFilter } from "./action-filter";
import type { ActionItem } from "./dashboard";

type Probe = Pick<ActionItem, "priority" | "source">;
const items: Probe[] = [
  { priority: "critical", source: "criterion" },
  { priority: "critical", source: "deadline" },
  { priority: "high", source: "measure" },
  { priority: "high", source: "evidence" },
  { priority: "medium", source: "evidence" },
  { priority: "medium", source: "criterion" },
];

describe("action filter", () => {
  it("matches the categories", () => {
    expect(items.filter((i) => matchesActionFilter(i, "critical"))).toHaveLength(2);
    expect(items.filter((i) => matchesActionFilter(i, "deadline")).map((i) => i.source)).toEqual(["deadline", "measure"]);
    expect(items.filter((i) => matchesActionFilter(i, "evidence"))).toHaveLength(2);
    expect(items.filter((i) => matchesActionFilter(i, "all"))).toHaveLength(6);
  });

  it("counts every category, with overlap allowed", () => {
    expect(countByActionFilter(items)).toEqual({ all: 6, critical: 2, deadline: 2, evidence: 2 });
    expect(countByActionFilter([])).toEqual({ all: 0, critical: 0, deadline: 0, evidence: 0 });
  });
});
