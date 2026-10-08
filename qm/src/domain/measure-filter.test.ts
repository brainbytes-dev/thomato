import { describe, expect, it } from "vitest";
import {
  countMeasuresByPhase, countMeasuresByStatus, filterMeasures, measuresFilterHref, parseMeasureStatusFilter, parseOwnerFilter,
  parsePhaseFilter, parseQuery, QUERY_MAX,
} from "./measure-filter";

const row = (over: Partial<Parameters<typeof filterMeasures>[0][number]> = {}) => ({
  title: "Hygieneschulung", criterionNumber: "7.3.10", criterionTitle: "Hygiene im Fahrzeug", ownerUserId: "u1",
  ownerName: "Anna Muster", status: "open" as const, phase: "plan" as const, overdue: false, ...over,
});

describe("parsers", () => {
  it("falls back to all for unknown or odd status values", () => {
    for (const v of [undefined, "", "bogus", "OPEN", "ACTIVE", "active ", "__proto__", "overdue,open"]) expect(parseMeasureStatusFilter(v)).toBe("all");
    for (const v of ["overdue", "active", "open", "in_progress", "done"]) expect(parseMeasureStatusFilter(v)).toBe(v);
    expect(parseMeasureStatusFilter(["done", "open"])).toBe("done");
    expect(parseMeasureStatusFilter([])).toBe("all");
  });

  it("accepts only organisation members as owner", () => {
    const members = [{ userId: "u1" }, { userId: "u2" }];
    expect(parseOwnerFilter("u2", members)).toBe("u2");
    expect(parseOwnerFilter(["u1", "x"], members)).toBe("u1");
    for (const v of [undefined, "", "all", "u3", "U1", "u1 ", "' OR 1=1 --"]) expect(parseOwnerFilter(v, members)).toBe("all");
    expect(parseOwnerFilter("u1", [])).toBe("all");
  });

  it("trims and caps the query by code points", () => {
    expect(parseQuery("  büro  ")).toBe("büro");
    expect(parseQuery(undefined)).toBe("");
    expect(parseQuery(["a", "b"])).toBe("a");
    expect([...parseQuery("x".repeat(500))]).toHaveLength(QUERY_MAX);
    expect([...parseQuery("😀".repeat(500))]).toHaveLength(QUERY_MAX);
    expect(parseQuery("a".repeat(79) + " b")).toBe("a".repeat(79));
  });
});

describe("parsePhaseFilter", () => {
  it("accepts the four phases and falls back to all for anything else", () => {
    for (const v of ["plan", "do", "check", "act"]) expect(parsePhaseFilter(v)).toBe(v);
    for (const v of [undefined, "", "all", "bogus", "PLAN", "Act", "plan ", "act,do", "__proto__", "done"]) expect(parsePhaseFilter(v)).toBe("all");
    expect(parsePhaseFilter(["check", "do"])).toBe("check");
    expect(parsePhaseFilter([])).toBe("all");
  });
});

describe("filterMeasures", () => {
  const rows = [
    row({ title: "Büro aufräumen", ownerUserId: "u1" }),
    row({ title: "Schulung", criterionNumber: "6.3.2", criterionTitle: "Schulungskonzept", ownerUserId: "u2", ownerName: "Bruno Éclair", status: "done" }),
    row({ title: "Lager", ownerUserId: "u2", ownerName: "Bruno Éclair", status: "in_progress", overdue: true }),
  ];
  const f = (over: Partial<Parameters<typeof filterMeasures>[1]>) => filterMeasures(rows, { status: "all", owner: "all", query: "", phase: "all", ...over }).map((r) => r.title);

  it("finds umlauts case-insensitively and ignores accents but never maps ü to ue", () => {
    expect(f({ query: "büro" })).toEqual(["Büro aufräumen"]);
    expect(f({ query: "BÜRO" })).toEqual(["Büro aufräumen"]);
    expect(f({ query: "buro" })).toEqual(["Büro aufräumen"]);
    expect(f({ query: "buero" })).toEqual([]);
    expect(f({ query: "eclair" })).toEqual(["Schulung", "Lager"]);
  });

  it("searches title, criterion number, criterion title and owner", () => {
    expect(f({ query: "6.3.2" })).toEqual(["Schulung"]);
    expect(f({ query: "konzept" })).toEqual(["Schulung"]);
    expect(f({ query: "anna" })).toEqual(["Büro aufräumen", ]);
  });

  it("treats special characters literally and never throws", () => {
    for (const q of ["%", "_", "\\", "(", "[a-", ".*", "'; DROP TABLE measure; --", "\u0000", "😀"]) expect(f({ query: q })).toEqual([]);
  });

  it("combines status, owner and query", () => {
    expect(f({ status: "overdue" })).toEqual(["Lager"]);
    expect(f({ status: "active" })).toEqual(["Büro aufräumen", "Lager"]);
    expect(f({ status: "done", owner: "u2" })).toEqual(["Schulung"]);
    expect(f({ status: "open", owner: "u2" })).toEqual([]);
    expect(f({ owner: "u2", query: "lag" })).toEqual(["Lager"]);
  });
});

describe("phase filter", () => {
  const rows = [
    row({ title: "A", phase: "plan" }),
    row({ title: "B", phase: "do", status: "in_progress", ownerUserId: "u2" }),
    row({ title: "C", phase: "check", status: "in_progress", overdue: true }),
    row({ title: "D", phase: "act", status: "in_progress" }),
    row({ title: "E", phase: "act", status: "done" }),
  ];
  const f = (over: Partial<Parameters<typeof filterMeasures>[1]>) => filterMeasures(rows, { status: "all", owner: "all", query: "", phase: "all", ...over }).map((r) => r.title);

  it("filters by phase and combines with status, owner and query", () => {
    expect(f({})).toEqual(["A", "B", "C", "D", "E"]);
    expect(f({ phase: "act" })).toEqual(["D", "E"]);
    expect(f({ phase: "act", status: "done" })).toEqual(["E"]);
    expect(f({ phase: "act", status: "active" })).toEqual(["D"]);
    expect(f({ phase: "check", status: "overdue" })).toEqual(["C"]);
    expect(f({ phase: "do", owner: "u2" })).toEqual(["B"]);
    expect(f({ phase: "do", owner: "u1" })).toEqual([]);
    expect(f({ phase: "plan", query: "a" })).toEqual(["A"]);
  });

  it("counts per phase with done measures under act and a separate done figure", () => {
    expect(countMeasuresByPhase(rows)).toEqual({ plan: 1, do: 1, check: 1, act: 2, actDone: 1, all: 5 });
    expect(countMeasuresByPhase([])).toEqual({ plan: 0, do: 0, check: 0, act: 0, actDone: 0, all: 0 });
  });

  it("phase counts sum to the total and status counts stay independent of the phase", () => {
    const c = countMeasuresByPhase(rows);
    expect(c.plan + c.do + c.check + c.act).toBe(c.all);
    expect(countMeasuresByStatus(rows).all).toBe(5);
  });
});

describe("counts and hrefs", () => {
  it("counts per status and overdue", () => {
    expect(countMeasuresByStatus([row(), row({ overdue: true }), row({ status: "done" }), row({ status: "in_progress" })])).toEqual({
      open: 2, in_progress: 1, done: 1, overdue: 1, all: 4,
    });
  });

  it("omits all and empty values and encodes the query", () => {
    expect(measuresFilterHref({})).toBe("/measures");
    expect(measuresFilterHref({ status: "all", owner: "all", query: "" })).toBe("/measures");
    expect(measuresFilterHref({ status: "overdue" })).toBe("/measures?status=overdue");
    expect(measuresFilterHref({ status: "active" })).toBe("/measures?status=active");
    expect(measuresFilterHref({ status: "open", owner: "u1", query: "a&b ü" })).toBe("/measures?status=open&owner=u1&q=a%26b+%C3%BC");
    expect(measuresFilterHref({ phase: "check" })).toBe("/measures?phase=check");
    expect(measuresFilterHref({ phase: "all" })).toBe("/measures");
    expect(measuresFilterHref({ status: "done", phase: "act", owner: "u1", query: "x" })).toBe("/measures?status=done&phase=act&owner=u1&q=x");
  });
});
