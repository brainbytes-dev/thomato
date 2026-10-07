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
  it("viewer cannot write measures or documents", () => {
    expect(can("viewer", "measure", "write")).toBe(false);
    expect(can("viewer", "document", "write")).toBe(false);
  });
  it("reviewer cannot manage the organization", () => {
    expect(can("reviewer", "organization", "update")).toBe(false);
    expect(can("reviewer", "organization", "delete")).toBe(false);
  });
});

describe("audit and deadline rights", () => {
  it("only owner and qm_admin read the audit log", () => {
    expect(can("owner", "audit", "read")).toBe(true);
    expect(can("qm_admin", "audit", "read")).toBe(true);
    expect(can("reviewer", "audit", "read")).toBe(false);
    expect(can("editor", "audit", "read")).toBe(false);
    expect(can("viewer", "audit", "read")).toBe(false);
  });
  it("every role reads deadlines", () => {
    for (const role of ["owner", "qm_admin", "reviewer", "editor", "viewer"] as const) {
      expect(can(role, "deadline", "read")).toBe(true);
    }
  });
});
