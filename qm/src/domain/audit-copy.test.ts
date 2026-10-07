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
  it("describes measure events", () => {
    const base = { title: "Hygieneschulung planen", criterionNumbers: ["7.3.10"] };
    expect(describeAuditEvent({ eventType: "measure.created", before: null, after: { ...base, ownerName: "Demo editor", dueDate: "2026-11-15", status: "open" } }))
      .toBe("Massnahme «Hygieneschulung planen» angelegt (verantwortlich: Demo editor, Frist 15.11.2026)");
    expect(describeAuditEvent({ eventType: "measure.status_changed", before: { ...base, status: "open", completedAt: null }, after: { ...base, status: "done", completedAt: "2026-10-08T10:00:00.000Z" } }))
      .toBe("Massnahme «Hygieneschulung planen»: Status von «Offen» zu «Erledigt»");
    expect(describeAuditEvent({ eventType: "measure.updated", before: { ...base, ownerName: "A", dueDate: "2026-11-15", description: null }, after: { ...base, ownerName: "B", dueDate: "2026-12-01", description: null } }))
      .toBe("Massnahme «Hygieneschulung planen» geändert (verantwortlich: A zu B, Frist 15.11.2026 zu 01.12.2026)");
    expect(describeAuditEvent({ eventType: "measure.status_changed", before: 1, after: null })).toBe("measure.status_changed");
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

describe("describeAuditEvent documents", () => {
  it("describes document and evidence events", () => {
    expect(describeAuditEvent({ eventType: "document.created", before: null, after: { title: "Hygienekonzept", versionNumber: 1, fileName: "h.pdf", criterionNumbers: ["7.3.10"] } }))
      .toBe("Dokument «Hygienekonzept» angelegt (Version 1, h.pdf)");
    expect(describeAuditEvent({ eventType: "document.version_added", before: { versionNumber: 1 }, after: { title: "Hygienekonzept", versionNumber: 2, fileName: "h2.pdf", validUntil: "2027-06-30", criterionNumbers: ["7.3.10"] } }))
      .toBe("Neue Version 2 von «Hygienekonzept» (h2.pdf), gültig bis 30.06.2027");
    expect(describeAuditEvent({ eventType: "document.version_added", before: { versionNumber: 1 }, after: { title: "Hygienekonzept", versionNumber: 2, fileName: "h2.pdf", validUntil: null, criterionNumbers: [] } }))
      .toBe("Neue Version 2 von «Hygienekonzept» (h2.pdf), ohne Ablaufdatum");
    expect(describeAuditEvent({ eventType: "evidence.linked", before: null, after: { title: "Hygienekonzept", criterionNumbers: ["7.3.10"] } }))
      .toBe("Nachweis «Hygienekonzept» verknüpft");
    expect(describeAuditEvent({ eventType: "evidence.unlinked", before: { title: "Hygienekonzept", criterionNumbers: ["7.3.10"] }, after: null }))
      .toBe("Nachweis «Hygienekonzept» gelöst");
  });
});
