import { describe, expect, it } from "vitest";
import { describeAuditEvent } from "./audit-copy";

describe("describeAuditEvent", () => {
  it("describes plain status changes", () => {
    expect(
      describeAuditEvent({ eventType: "criterion.status_changed", before: { status: "open", reason: null }, after: { status: "met", reason: null } }),
    ).toBe("Stand von «Offen» zu «Erfüllt»");
  });
  it("describes marking as not applicable with the reason", () => {
    expect(
      describeAuditEvent({
        eventType: "criterion.not_applicable_changed",
        before: { status: "open", reason: null },
        after: { status: "not_applicable", reason: "Kein Helikopter im Betrieb." },
      }),
    ).toBe("Stand von «Offen» zu «Nicht anwendbar», Begründung: Kein Helikopter im Betrieb.");
  });
  it("describes leaving not applicable and keeps the old reason", () => {
    expect(
      describeAuditEvent({
        eventType: "criterion.not_applicable_changed",
        before: { status: "not_applicable", reason: "Kein Helikopter im Betrieb." },
        after: { status: "open", reason: null },
      }),
    ).toBe("Stand von «Nicht anwendbar» zu «Offen», frühere Begründung: Kein Helikopter im Betrieb.");
  });
  it("describes due date changes", () => {
    expect(describeAuditEvent({ eventType: "criterion.due_date_changed", before: { dueDate: null }, after: { dueDate: "2026-11-15" } })).toBe("Frist gesetzt: 15.11.2026");
    expect(describeAuditEvent({ eventType: "criterion.due_date_changed", before: { dueDate: "2026-11-15" }, after: { dueDate: "2026-12-01" } })).toBe("Frist von 15.11.2026 zu 01.12.2026");
    expect(describeAuditEvent({ eventType: "criterion.due_date_changed", before: { dueDate: "2026-11-15" }, after: { dueDate: null } })).toBe("Frist entfernt (war 15.11.2026)");
  });
  it("falls back to the event type for unknown or malformed events", () => {
    expect(describeAuditEvent({ eventType: "x.y", before: null, after: null })).toBe("x.y");
    expect(describeAuditEvent({ eventType: "criterion.status_changed", before: 5, after: "kaputt" })).toBe("criterion.status_changed");
  });
});

describe("describeAuditEvent reason change", () => {
  it("describes a changed reason while staying not applicable", () => {
    expect(
      describeAuditEvent({
        eventType: "criterion.not_applicable_changed",
        before: { status: "not_applicable", reason: "Kein Helikopter im Betrieb." },
        after: { status: "not_applicable", reason: "Helikopter wird extern betrieben." },
      }),
    ).toBe("Begründung geändert von «Kein Helikopter im Betrieb.» zu «Helikopter wird extern betrieben.»");
  });
});
