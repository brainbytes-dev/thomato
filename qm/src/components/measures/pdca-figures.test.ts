import { describe, expect, it } from "vitest";
import type { PdcaFigures } from "@/domain/measure-pdca";
import { describePdcaFigures, formatDays } from "./pdca-figures";

const base: PdcaFigures = {
  total: 0,
  phases: { plan: 0, do: 0, check: 0, act: 0 },
  effective: { percent: null, n: 0 },
  averageDaysToClose: { days: null, n: 0 },
};

describe("formatDays", () => {
  it("uses singular, drops a zero decimal and uses the decimal comma", () => {
    expect(formatDays(1)).toBe("1 Tag");
    expect(formatDays(21)).toBe("21 Tage");
    expect(formatDays(21.0)).toBe("21 Tage");
    expect(formatDays(12.5)).toBe("12,5 Tage");
    expect(formatDays(0)).toBe("0 Tage");
  });
});

describe("describePdcaFigures", () => {
  it("returns null for both figures at n = 0", () => {
    expect(describePdcaFigures(base)).toEqual({ effective: null, duration: null });
  });

  it("shows a figure with n from n = 1", () => {
    const d = describePdcaFigures({ ...base, effective: { percent: 100, n: 1 }, averageDaysToClose: { days: 21, n: 1 } });
    expect(d.effective).toEqual({ label: "Wirksam", value: "100 %", n: "n=1", text: "Wirksam: 100 % (n=1)" });
    expect(d.duration).toEqual({ label: "Ø Dauer bis Abschluss", value: "21 Tage", n: "n=1", text: "Ø Dauer bis Abschluss: 21 Tage (n=1)" });
  });

  it("handles a mixed state: one figure present, the other empty", () => {
    const d = describePdcaFigures({ ...base, effective: { percent: 67, n: 3 }, averageDaysToClose: { days: null, n: 0 } });
    expect(d.effective?.text).toBe("Wirksam: 67 % (n=3)");
    expect(d.duration).toBeNull();
  });

  it("never renders a number when the service reports n = 0, even with stray values", () => {
    expect(describePdcaFigures({ ...base, effective: { percent: 50, n: 0 } }).effective).toBeNull();
    expect(describePdcaFigures({ ...base, averageDaysToClose: { days: 3, n: 0 } }).duration).toBeNull();
  });
});
