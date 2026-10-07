import { describe, expect, it } from "vitest";
import { addDays, daysUntil, formatDate, monthsUntil, urgency, zurichDate } from "./dates";

describe("dates (Europe/Zurich)", () => {
  it("uses the Zurich calendar day, not UTC", () => {
    // 22:30 UTC am 07.10.2026 ist in Zürich (UTC+2) bereits der 08.10.
    expect(zurichDate(new Date("2026-10-07T22:30:00Z"))).toBe("2026-10-08");
    expect(daysUntil("2026-10-08", new Date("2026-10-07T22:30:00Z"))).toBe(0);
    expect(daysUntil("2026-10-09", new Date("2026-10-07T22:30:00Z"))).toBe(1);
  });
  it("counts negative days for overdue dates", () => {
    expect(daysUntil("2026-10-01", new Date("2026-10-07T10:00:00Z"))).toBe(-6);
  });
  it("derives urgency with a 30 day window", () => {
    expect(urgency(-1)).toBe("overdue");
    expect(urgency(0)).toBe("soon");
    expect(urgency(30)).toBe("soon");
    expect(urgency(31)).toBe("upcoming");
  });
  it("counts full months until a date and never goes negative", () => {
    const now = new Date("2026-10-07T10:00:00Z");
    expect(monthsUntil("2028-06-30", now)).toBe(20);
    expect(monthsUntil("2026-12-05", now)).toBe(1);
    expect(monthsUntil("2026-12-07", now)).toBe(2);
    expect(monthsUntil("2026-09-01", now)).toBe(0);
  });
  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("formats dates the Swiss way", () => {
    expect(formatDate("2026-10-07")).toBe("07.10.2026");
  });
});
