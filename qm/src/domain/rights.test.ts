import { describe, expect, it } from "vitest";
import { can } from "./rights";

describe("rights", () => {
  it("viewer reads but never writes", () => {
    expect(can("viewer", "assessment", "read")).toBe(true);
    expect(can("viewer", "assessment", "write")).toBe(false);
  });
  it("editor writes but does not approve", () => {
    expect(can("editor", "assessment", "write")).toBe(true);
    expect(can("editor", "document", "approve")).toBe(false);
  });
  it("reviewer approves", () => {
    expect(can("reviewer", "document", "approve")).toBe(true);
  });
  it("only owner manages the organization", () => {
    expect(can("owner", "organization", "delete")).toBe(true);
    expect(can("qm_admin", "organization", "delete")).toBe(false);
  });
  it("qm_admin manages members", () => {
    expect(can("qm_admin", "member", "update")).toBe(true);
    expect(can("reviewer", "member", "update")).toBe(false);
  });
});
