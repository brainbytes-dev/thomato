import { describe, expect, it } from "vitest";

describe("test runner", () => {
  it("runs against the test database url", () => {
    expect(process.env.DATABASE_URL).toContain("qm_test");
  });
});
