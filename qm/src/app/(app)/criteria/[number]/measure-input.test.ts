import { describe, expect, it } from "vitest";
import { createMeasureInput, statusInput, updateMeasureInput } from "./measure-input";

const UUID = "3f2b8c1e-5a4d-4e6f-8a7b-9c0d1e2f3a4b";
const OWNER = "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6";
const base = { number: "6.3.2", title: "Hygienekonzept aktualisieren", description: "", ownerUserId: OWNER, dueDate: "2026-12-31" };

describe("createMeasureInput", () => {
  it("accepts a valid input with an empty description", () => {
    expect(createMeasureInput.safeParse(base).success).toBe(true);
  });
  it("accepts a missing description", () => {
    const rest: Record<string, unknown> = { ...base };
    delete rest.description;
    expect(createMeasureInput.safeParse(rest).success).toBe(true);
  });
  it("limits the title to 3..120 code points after trimming", () => {
    expect(createMeasureInput.safeParse({ ...base, title: "abc" }).success).toBe(true);
    expect(createMeasureInput.safeParse({ ...base, title: "ab" }).success).toBe(false);
    expect(createMeasureInput.safeParse({ ...base, title: "  ab  " }).success).toBe(false);
    expect(createMeasureInput.safeParse({ ...base, title: "a".repeat(120) }).success).toBe(true);
    expect(createMeasureInput.safeParse({ ...base, title: "a".repeat(121) }).success).toBe(false);
  });
  it("counts code points, not UTF-16 units", () => {
    expect(createMeasureInput.safeParse({ ...base, title: "😀".repeat(120) }).success).toBe(true);
    expect(createMeasureInput.safeParse({ ...base, title: "😀".repeat(121) }).success).toBe(false);
  });
  it("limits the description to 1000 characters", () => {
    expect(createMeasureInput.safeParse({ ...base, description: "a".repeat(1000) }).success).toBe(true);
    expect(createMeasureInput.safeParse({ ...base, description: "a".repeat(1001) }).success).toBe(false);
  });
  it("rejects an impossible or empty due date", () => {
    expect(createMeasureInput.safeParse({ ...base, dueDate: "2026-02-30" }).success).toBe(false);
    expect(createMeasureInput.safeParse({ ...base, dueDate: "" }).success).toBe(false);
    expect(createMeasureInput.safeParse({ ...base, dueDate: "morgen" }).success).toBe(false);
  });
  it("accepts a Better Auth id that is not a UUID and bounds its length", () => {
    expect(createMeasureInput.safeParse({ ...base, ownerUserId: "x" }).success).toBe(true);
    expect(createMeasureInput.safeParse({ ...base, ownerUserId: "a".repeat(64) }).success).toBe(true);
    expect(createMeasureInput.safeParse({ ...base, ownerUserId: "a".repeat(65) }).success).toBe(false);
    expect(createMeasureInput.safeParse({ ...base, ownerUserId: "" }).success).toBe(false);
  });
  it("bounds the criterion number", () => {
    expect(createMeasureInput.safeParse({ ...base, number: "" }).success).toBe(false);
    expect(createMeasureInput.safeParse({ ...base, number: "1".repeat(41) }).success).toBe(false);
  });
  it("strips unknown fields", () => {
    const r = createMeasureInput.safeParse({ ...base, evil: "x" });
    expect(r.success && "evil" in r.data).toBe(false);
  });
});

describe("updateMeasureInput", () => {
  const upd = { number: "6.3.2", measureId: UUID, title: "Neuer Titel", description: "x", ownerUserId: OWNER, dueDate: "2026-12-31" };
  it("accepts a valid input and requires a uuid id", () => {
    expect(updateMeasureInput.safeParse(upd).success).toBe(true);
    expect(updateMeasureInput.safeParse({ ...upd, measureId: "nope" }).success).toBe(false);
  });
  it("applies the same field rules", () => {
    expect(updateMeasureInput.safeParse({ ...upd, title: "ab" }).success).toBe(false);
    expect(updateMeasureInput.safeParse({ ...upd, dueDate: "2026-13-01" }).success).toBe(false);
  });
  it("strips unknown fields", () => {
    const r = updateMeasureInput.safeParse({ ...upd, evil: "x" });
    expect(r.success && "evil" in r.data).toBe(false);
  });
});

describe("statusInput", () => {
  it("accepts the three statuses only", () => {
    for (const status of ["open", "in_progress", "done"]) {
      expect(statusInput.safeParse({ number: "6.3.2", measureId: UUID, status }).success).toBe(true);
    }
    expect(statusInput.safeParse({ number: "6.3.2", measureId: UUID, status: "closed" }).success).toBe(false);
    expect(statusInput.safeParse({ number: "6.3.2", measureId: UUID, status: "" }).success).toBe(false);
  });
  it("requires a uuid", () => {
    expect(statusInput.safeParse({ number: "6.3.2", measureId: "1", status: "done" }).success).toBe(false);
  });
});
