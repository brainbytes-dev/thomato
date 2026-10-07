import { describe, expect, it } from "vitest";
import { describeExpiry } from "./expiry-copy";

describe("describeExpiry", () => {
  it("formats months with singular and plural", () => {
    expect(describeExpiry({ kind: "months", months: 1 })).toEqual({ stat: "1 Monat", tone: "normal", line: null });
    expect(describeExpiry({ kind: "months", months: 20 })).toEqual({ stat: "20 Monate", tone: "normal", line: null });
  });

  it("uses the dative after seit for expired states", () => {
    expect(describeExpiry({ kind: "expired", days: 1 })).toEqual({
      stat: "abgelaufen seit 1 Tag",
      tone: "critical",
      line: "Die Anerkennung ist seit 1 Tag abgelaufen.",
    });
    expect(describeExpiry({ kind: "expired", days: 10 })).toEqual({
      stat: "abgelaufen seit 10 Tagen",
      tone: "critical",
      line: "Die Anerkennung ist seit 10 Tagen abgelaufen.",
    });
  });

  it("shows k. A. without an expiry deadline", () => {
    expect(describeExpiry(null)).toEqual({ stat: "k. A.", tone: "muted", line: null });
  });
});
