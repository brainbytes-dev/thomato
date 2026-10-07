import { describe, expect, it } from "vitest";
import { countByStatus, criteriaFilterHref, parseEvidenceFilter, parseScopeFilter, parseStatusFilter } from "./criteria-filter";

describe("parseStatusFilter", () => {
  it("accepts the known statuses and all, and falls back to all for anything else", () => {
    expect(parseStatusFilter("not_applicable")).toBe("not_applicable");
    expect(parseStatusFilter("critical")).toBe("critical");
    expect(parseStatusFilter("all")).toBe("all");
    expect(parseStatusFilter(undefined)).toBe("all");
    expect(parseStatusFilter("drop table")).toBe("all");
    expect(parseStatusFilter(["met", "open"])).toBe("met");
    expect(parseStatusFilter([])).toBe("all");
  });
});

describe("countByStatus", () => {
  it("counts every status including zero counts", () => {
    expect(countByStatus([{ status: "met" }, { status: "met" }, { status: "critical" }])).toEqual({
      not_assessed: 0, met: 2, open: 0, critical: 1, not_applicable: 0,
    });
  });
});

describe("parseEvidenceFilter", () => {
  it("accepts the evidence states and all, and falls back to all for anything else", () => {
    expect(parseEvidenceFilter("none")).toBe("none");
    expect(parseEvidenceFilter("stale")).toBe("stale");
    expect(parseEvidenceFilter("current")).toBe("current");
    expect(parseEvidenceFilter("all")).toBe("all");
    expect(parseEvidenceFilter(undefined)).toBe("all");
    expect(parseEvidenceFilter("x")).toBe("all");
    expect(parseEvidenceFilter(["stale", "none"])).toBe("stale");
  });
});

describe("parseScopeFilter", () => {
  it("returns mandatory only for that exact value", () => {
    expect(parseScopeFilter("mandatory")).toBe("mandatory");
    expect(parseScopeFilter(["mandatory", "all"])).toBe("mandatory");
    expect(parseScopeFilter(["x", "mandatory"])).toBe("all");
    expect(parseScopeFilter("Mandatory")).toBe("all");
    expect(parseScopeFilter("x")).toBe("all");
    expect(parseScopeFilter(undefined)).toBe("all");
  });
});

describe("criteriaFilterHref", () => {
  it("keeps all three parameters and omits the ones set to all", () => {
    expect(criteriaFilterHref("met", "none", "mandatory")).toBe("/criteria?status=met&evidence=none&scope=mandatory");
    expect(criteriaFilterHref("all", "stale", "mandatory")).toBe("/criteria?evidence=stale&scope=mandatory");
    expect(criteriaFilterHref("met", "none")).toBe("/criteria?status=met&evidence=none");
    expect(criteriaFilterHref("all", "all")).toBe("/criteria");
  });
});
