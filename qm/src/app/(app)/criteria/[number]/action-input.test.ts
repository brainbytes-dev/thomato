import { describe, expect, it } from "vitest";
import { assessmentInput, isStatusUnchanged } from "./action-input";

const base = { number: "7.3.10", status: "met" };

describe("assessmentInput", () => {
  it("accepts valid input", () => {
    expect(assessmentInput.safeParse({ ...base, reason: "x", dueDate: "2026-11-01" }).success).toBe(true);
  });
  it("rejects an unknown status", () => {
    expect(assessmentInput.safeParse({ ...base, status: "bogus" }).success).toBe(false);
  });
  it("rejects an over-long number", () => {
    expect(assessmentInput.safeParse({ ...base, number: "1".repeat(41) }).success).toBe(false);
  });
  it("rejects an impossible date", () => {
    expect(assessmentInput.safeParse({ ...base, dueDate: "2026-02-30" }).success).toBe(false);
  });
  it("accepts an empty date", () => {
    expect(assessmentInput.safeParse({ ...base, dueDate: "" }).success).toBe(true);
  });
  it("accepts a missing reason", () => {
    expect(assessmentInput.safeParse(base).success).toBe(true);
  });
  it("strips extra fields", () => {
    const r = assessmentInput.parse({ ...base, $ACTION_ID_x: "1", organizationId: "evil" });
    expect(Object.keys(r)).toEqual(["number", "status"]);
  });
});

describe("isStatusUnchanged", () => {
  const na = { status: "not_applicable", notApplicableReason: "Grund Grund Grund" };
  it("same non-n/a status is unchanged", () => {
    expect(isStatusUnchanged({ status: "met", notApplicableReason: null }, { status: "met", reason: "ignored" })).toBe(true);
  });
  it("n/a with identical trimmed reason is unchanged", () => {
    expect(isStatusUnchanged(na, { status: "not_applicable", reason: "  Grund Grund Grund " })).toBe(true);
  });
  it("n/a with changed reason is changed", () => {
    expect(isStatusUnchanged(na, { status: "not_applicable", reason: "Anderer Grund hier" })).toBe(false);
  });
  it("status change is changed", () => {
    expect(isStatusUnchanged(na, { status: "met" })).toBe(false);
  });
});
