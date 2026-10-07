import { describe, expect, it } from "vitest";
import { evidenceStateOf, isCurrent, summarizeEvidence } from "./evidence";

describe("isCurrent", () => {
  it("is current without an expiry date and on the expiry day, stale the day after", () => {
    expect(isCurrent(null, "2026-10-08")).toBe(true);
    expect(isCurrent("2026-10-08", "2026-10-08")).toBe(true);
    expect(isCurrent("2026-10-07", "2026-10-08")).toBe(false);
    expect(isCurrent("2027-01-01", "2026-10-08")).toBe(true);
  });
});

describe("evidenceStateOf", () => {
  it("is none without documents, current if any latest version is current, stale otherwise", () => {
    expect(evidenceStateOf([], "2026-10-08")).toBe("none");
    expect(evidenceStateOf(["2026-01-01"], "2026-10-08")).toBe("stale");
    expect(evidenceStateOf(["2026-01-01", "2027-01-01"], "2026-10-08")).toBe("current");
    expect(evidenceStateOf([null], "2026-10-08")).toBe("current");
  });
});

describe("summarizeEvidence", () => {
  it("counts current, stale and missing", () => {
    expect(summarizeEvidence(["current", "stale", "none", "none", "current"])).toEqual({ current: 2, stale: 1, missing: 2 });
    expect(summarizeEvidence([])).toEqual({ current: 0, stale: 0, missing: 0 });
  });
});
