import { describe, expect, it } from "vitest";
import { describeAuditEvent } from "./audit-copy";

describe("describeAuditEvent", () => {
  it("describes plain status changes", () => {
    expect(
      describeAuditEvent({ eventType: "criterion.status_changed", before: { status: "open", reason: null }, after: { status: "met", reason: null } }),
    ).toBe("Stand von «Offen» auf «Erfüllt»");
  });
  it("describes marking as not applicable with the reason", () => {
    expect(
      describeAuditEvent({
        eventType: "criterion.not_applicable_changed",
        before: { status: "open", reason: null },
        after: { status: "not_applicable", reason: "Kein Helikopter im Betrieb." },
      }),
    ).toBe("Stand von «Offen» auf «Nicht anwendbar», Begründung: Kein Helikopter im Betrieb.");
  });
  it("describes leaving not applicable and keeps the old reason", () => {
    expect(
      describeAuditEvent({
        eventType: "criterion.not_applicable_changed",
        before: { status: "not_applicable", reason: "Kein Helikopter im Betrieb." },
        after: { status: "open", reason: null },
      }),
    ).toBe("Stand von «Nicht anwendbar» auf «Offen», frühere Begründung: Kein Helikopter im Betrieb.");
  });
  it("describes due date changes", () => {
    expect(describeAuditEvent({ eventType: "criterion.due_date_changed", before: { dueDate: null }, after: { dueDate: "2026-11-15" } })).toBe("Frist gesetzt: 15.11.2026");
    expect(describeAuditEvent({ eventType: "criterion.due_date_changed", before: { dueDate: "2026-11-15" }, after: { dueDate: "2026-12-01" } })).toBe("Frist von 15.11.2026 auf 01.12.2026");
    expect(describeAuditEvent({ eventType: "criterion.due_date_changed", before: { dueDate: "2026-11-15" }, after: { dueDate: null } })).toBe("Frist entfernt (war 15.11.2026)");
  });
  it("describes measure events", () => {
    const base = { title: "Hygieneschulung planen", criterionNumbers: ["7.3.10"] };
    expect(describeAuditEvent({ eventType: "measure.created", before: null, after: { ...base, ownerName: "Demo editor", dueDate: "2026-11-15", status: "open" } }))
      .toBe("Massnahme «Hygieneschulung planen» angelegt (verantwortlich: Demo editor, Frist 15.11.2026)");
    expect(describeAuditEvent({ eventType: "measure.status_changed", before: { ...base, status: "open", completedAt: null }, after: { ...base, status: "done", completedAt: "2026-10-08T10:00:00.000Z" } }))
      .toBe("Massnahme «Hygieneschulung planen»: Status von «Offen» auf «Erledigt»");
    expect(describeAuditEvent({ eventType: "measure.updated", before: { ...base, ownerName: "A", dueDate: "2026-11-15", description: null }, after: { ...base, ownerName: "B", dueDate: "2026-12-01", description: null } }))
      .toBe("Massnahme «Hygieneschulung planen» geändert (verantwortlich: von A zu B, Frist von 15.11.2026 auf 01.12.2026)");
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
      .toBe("Verknüpfung mit «Hygienekonzept» gelöst");
  });
});

describe("describeAuditEvent PDCA", () => {
  const state = (over: Record<string, unknown>) => ({ title: "Hygienekonzept", phase: "plan", status: "open", cycle: 1, completedAt: null, criterionNumbers: ["7.3.10"], ...over });
  const step = (over: Record<string, unknown>) => ({ title: "Hygienekonzept", stepId: "s1", stepTitle: "Schulung durchführen", position: 1, done: false, criterionNumbers: ["7.3.10"], ...over });
  const d = (eventType: string, before: unknown, after: unknown) => describeAuditEvent({ eventType, before, after });

  it("describes phase changes with the phase names", () => {
    expect(d("measure.phase_changed", state({}), state({ phase: "do", status: "in_progress" })))
      .toBe("Massnahme «Hygienekonzept»: Phase von «Plan» auf «Do»");
    expect(d("measure.phase_changed", state({ phase: "do" }), state({ phase: "check", confirmedNoSteps: true })))
      .toBe("Massnahme «Hygienekonzept»: Phase von «Do» auf «Check» (ohne Checkliste bestätigt)");
  });

  it("describes checklist events", () => {
    expect(d("measure.step_added", null, step({}))).toBe("Schritt «Schulung durchführen» zur Checkliste hinzugefügt (Massnahme «Hygienekonzept»)");
    expect(d("measure.step_removed", step({}), null)).toBe("Schritt «Schulung durchführen» aus der Checkliste entfernt (Massnahme «Hygienekonzept»)");
    expect(d("measure.step_updated", step({}), step({ done: true, change: "done" }))).toBe("Schritt «Schulung durchführen» erledigt (Massnahme «Hygienekonzept»)");
    expect(d("measure.step_updated", step({ done: true }), step({ done: false, change: "undone" }))).toBe("Schritt «Schulung durchführen» wieder geöffnet (Massnahme «Hygienekonzept»)");
    expect(d("measure.step_updated", step({}), step({ stepTitle: "Schulung planen", change: "renamed" })))
      .toBe("Schritt «Schulung durchführen» umbenannt in «Schulung planen» (Massnahme «Hygienekonzept»)");
    expect(d("measure.step_updated", step({}), step({ position: 2, change: "moved" })))
      .toBe("Schritt «Schulung durchführen» von Position 1 auf 2 verschoben (Massnahme «Hygienekonzept»)");
  });

  it("describes the effectiveness review with cycle, result and note", () => {
    expect(d("measure.effectiveness_recorded", state({ phase: "check" }), state({ phase: "act", result: "partly", note: "Nur teilweise belegt", reviewId: "r1" })))
      .toBe("Wirksamkeit von «Hygienekonzept» bewertet (Zyklus 1): «teilweise wirksam», Notiz: Nur teilweise belegt");
    expect(d("measure.effectiveness_recorded", state({}), state({ cycle: 2, result: "effective", note: "Alles gut" })))
      .toBe("Wirksamkeit von «Hygienekonzept» bewertet (Zyklus 2): «wirksam», Notiz: Alles gut");
    expect(d("measure.effectiveness_recorded", state({}), state({ result: "not_effective", note: "Fall wiederholt" })))
      .toContain("«nicht wirksam»");
  });

  it("describes the Act decisions", () => {
    expect(d("measure.refined", state({ phase: "act" }), state({ phase: "do", previousResult: "partly" })))
      .toBe("Massnahme «Hygienekonzept» nachgeschärft (zurück in Phase «Do», Zyklus 1, letzte Bewertung «teilweise wirksam»)");
    expect(d("measure.cycle_started", state({ phase: "act" }), state({ phase: "plan", cycle: 2, previousResult: "not_effective" })))
      .toBe("Neuer Zyklus 2 für Massnahme «Hygienekonzept» gestartet (Phase «Plan», letzte Bewertung «nicht wirksam»)");
    expect(d("measure.closed", state({ phase: "act" }), state({ status: "done", result: "effective", reason: null, completedAt: "2026-10-08T10:00:00.000Z" })))
      .toBe("Massnahme «Hygienekonzept» abgeschlossen (letzte Bewertung «wirksam»)");
    expect(d("measure.closed", state({ phase: "act" }), state({ status: "done", result: "partly", reason: "Restrisiko ist akzeptiert", completedAt: "2026-10-08T10:00:00.000Z" })))
      .toBe("Massnahme «Hygienekonzept» abgeschlossen (letzte Bewertung «teilweise wirksam»), Begründung: Restrisiko ist akzeptiert");
    expect(d("measure.reopened", state({ status: "done", phase: "act" }), state({ phase: "do", status: "in_progress" })))
      .toBe("Massnahme «Hygienekonzept» wiedereröffnet (Phase «Do»)");
  });

  it("describes the effectiveness criterion on measure.updated and keeps old updates readable", () => {
    const p = (c: string | null) => ({ title: "Hygienekonzept", effectivenessCriterion: c, criterionNumbers: ["7.3.10"] });
    expect(d("measure.updated", p(null), p("Keine Wiederholung"))).toBe("Wirksamkeitskriterium von «Hygienekonzept» festgelegt: Keine Wiederholung");
    expect(d("measure.updated", p("Alt gültig"), p("Neu gültig"))).toBe("Wirksamkeitskriterium von «Hygienekonzept» geändert: von «Alt gültig» auf «Neu gültig»");
    expect(d("measure.updated", p("Alt gültig"), p(null))).toBe("Wirksamkeitskriterium von «Hygienekonzept» entfernt (war «Alt gültig»)");
    expect(d("measure.updated", { title: "A", ownerName: "X", dueDate: "2026-11-15" }, { title: "A", ownerName: "Y", dueDate: "2026-11-15" }))
      .toBe("Massnahme «A» geändert (verantwortlich: von X zu Y)");
  });

  it("keeps old status events readable and falls back to the event type for broken payloads", () => {
    expect(d("measure.status_changed", { title: "T", status: "open" }, { title: "T", status: "in_progress" })).toBe("Massnahme «T»: Status von «Offen» auf «In Bearbeitung»");
    for (const type of ["measure.phase_changed", "measure.step_added", "measure.step_updated", "measure.step_removed", "measure.effectiveness_recorded", "measure.refined", "measure.cycle_started", "measure.closed", "measure.reopened"]) {
      expect(d(type, null, null)).toBe(type);
      expect(d(type, "kaputt", 42)).toBe(type);
    }
  });
});
