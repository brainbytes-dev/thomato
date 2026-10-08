import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CriterionHeader } from "@/components/criteria/criterion-header";
import { HistoryTimeline } from "@/components/criteria/history-timeline";
import { StatusNotice } from "@/components/criteria/status-notice";
import type { EvidenceDoc, VersionView } from "@/domain/documents";
import type { MeasureView } from "@/domain/measures";
import { can, type Role } from "@/domain/rights";
import { EvidenceFactsView, EvidenceRegisteredView, UploadCard } from "./evidence-section";
import { MeasuresView } from "./measures-section";

const version = (over: Partial<VersionView> = {}): VersionView => ({
  id: "v1", versionNumber: 1, fileName: "hygiene.pdf", mimeType: "application/pdf", sizeBytes: 2048, sha256: "x",
  validUntil: "2026-01-01", uploadedByName: "Anna Muster", createdAt: new Date("2026-03-01T09:30:00Z"), current: false, ...over,
});

const doc = (over: Partial<EvidenceDoc> = {}): EvidenceDoc => ({
  documentId: "d1", linkId: "l1", title: "Hygienekonzept", latest: version(), versions: [version()], state: "stale", ...over,
});

const measure = (over: Partial<MeasureView> = {}): MeasureView => ({
  id: "m1", criterionNumber: "7.3.10", title: "Desinfektion schulen", description: null, ownerUserId: "u1",
  ownerName: "Beat Beispiel", dueDate: "2026-10-01", status: "open", completedAt: null,
  createdAt: new Date("2026-09-01T08:00:00Z"), days: -7, overdue: true, ...over,
});

const members = [{ userId: "u1", name: "Beat Beispiel" }];

const evidence = (canWrite: boolean, docs: EvidenceDoc[] = [doc()], linkable = [{ documentId: "d2", title: "Anderes" }]) =>
  renderToStaticMarkup(
    createElement(EvidenceRegisteredView, {
      number: "7.3.10", status: "critical", docs, state: docs.length === 0 ? "none" : "stale", canWrite, linkable,
    }),
  );

const measures = (canWrite: boolean, list: MeasureView[] = [measure()]) =>
  renderToStaticMarkup(
    createElement(MeasuresView, { number: "7.3.10", measures: list, members, canWrite, defaultOwnerId: "u1" }),
  );

describe("role visibility", () => {
  const roles: Role[] = ["owner", "qm_admin", "reviewer", "editor", "viewer"];
  it("shows the history only to roles with audit read", () => {
    expect(roles.filter((r) => can(r, "audit", "read")).sort()).toEqual(["owner", "qm_admin"]);
  });

  it("the page renders the history only behind the audit right", () => {
    const source = readFileSync(join(process.cwd(), "src/app/(app)/criteria/[number]/page.tsx"), "utf8");
    expect(source).toContain('can(ctx.role, "audit", "read")');
    expect(source).toMatch(/\{history && <HistoryTimeline/);
  });

  it("evidence forms appear with write rights only", () => {
    const writer = evidence(true);
    expect(writer).toContain("Neue Version hochladen");
    expect(writer).toContain('name="documentId"');
    expect(writer).toContain("Verknüpfung lösen");
    expect(writer).toContain("Vorhandenes Dokument verknüpfen");
    expect(writer).not.toContain("schreibgeschützt");

    const viewer = evidence(false);
    expect(viewer).toContain("Mit Ihrer Rolle sind Nachweise schreibgeschützt.");
    for (const text of ["Neue Version hochladen", "Verknüpfung lösen", "Vorhandenes Dokument verknüpfen", "<form"]) {
      expect(viewer).not.toContain(text);
    }
    expect(viewer).toContain("Versionen anzeigen");
    expect(viewer).toContain("Herunterladen");
  });

  it("the upload card carries the file zone and the real file input", () => {
    const html = renderToStaticMarkup(createElement(UploadCard, { number: "7.3.10" }));
    expect(html).toContain("Nachweis erfassen");
    expect(html).toContain('type="file"');
    expect(html).toContain("border-dashed");
    expect(html).toContain('name="title"');
    expect(html).toContain('name="validUntil"');
    expect(html).toContain("PDF, PNG, JPG, DOCX oder XLSX");
  });

  it("measure forms appear with write rights only", () => {
    const writer = measures(true);
    expect(writer).toContain("Massnahme erfassen");
    expect(writer).toContain("Status setzen");
    expect(writer).toContain("Änderungen speichern");
    expect(writer).toContain("<details");
    expect(writer).not.toContain("schreibgeschützt");

    const viewer = measures(false);
    expect(viewer).toContain("Mit Ihrer Rolle sind Massnahmen schreibgeschützt.");
    for (const text of ["Massnahme erfassen", "Status setzen", "Bearbeiten", "<form"]) {
      expect(viewer).not.toContain(text);
    }
    expect(viewer).toContain("Desinfektion schulen");
  });
});

describe("evidence card", () => {
  it("counts documents in the header and keeps the table columns", () => {
    const html = evidence(false, [doc(), doc({ documentId: "d2", linkId: "l2", title: "Zweites" })]);
    expect(html).toContain("2 Dokumente");
    for (const col of ["Titel", "Aktuelle Version", "Gültig bis", "Nachweis", "Download"]) expect(html).toContain(`>${col}<`);
    expect(html).not.toContain("Geprüft von");
    expect(evidence(false, [doc()])).toContain("1 Dokument<");
  });

  it("shows a calm empty state without a table", () => {
    const html = evidence(true, [], []);
    expect(html).toContain("0 Dokumente");
    expect(html).toContain("Für dieses Kriterium ist noch kein Dokument verknüpft.");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("Vorhandenes Dokument verknüpfen");
  });

  it("warns when a criterion is met without current evidence", () => {
    const html = renderToStaticMarkup(
      createElement(EvidenceRegisteredView, { number: "1", status: "met", docs: [], state: "none", canWrite: false, linkable: [] }),
    );
    expect(html).toContain("Das Kriterium ist als erfüllt bewertet, aber es gibt keinen aktuellen Nachweis.");
  });

  it("facts card shows evidence state, count and status", () => {
    const html = renderToStaticMarkup(createElement(EvidenceFactsView, { docs: [doc()], state: "stale", status: "critical" }));
    expect(html).toContain("Nachweis-Stand");
    expect(html).toContain("Veraltet");
    expect(html).toContain("Kritisch");
    expect(html).toMatch(/Dokumente<\/dt><dd[^>]*>1</);
  });
});

describe("measures card", () => {
  it("marks overdue with a word and shows owner, due date and status", () => {
    const html = measures(false);
    expect(html).toContain("(überfällig)");
    expect(html).toContain("Beat Beispiel");
    expect(html).toContain("01.10.2026");
    expect(html).toContain("Offen");
  });

  it("shows a calm empty state", () => {
    const html = measures(true, []);
    expect(html).toContain("Für dieses Kriterium gibt es noch keine Massnahme.");
    expect(html).not.toContain("<ul");
    expect(html).toContain("Massnahme erfassen");
  });
});

describe("history timeline", () => {
  const entry = (id: string, eventType: string, iso: string, actorName: string | null) => ({
    id, eventType, actorName, createdAt: new Date(iso), before: { status: "critical", reason: null }, after: { status: "met", reason: null },
  });

  it("renders a list, newest first as given, inside the labelled section", () => {
    const html = renderToStaticMarkup(
      createElement(HistoryTimeline, {
        entries: [
          entry("2", "criterion.status_changed", "2026-10-02T10:00:00Z", "Demo owner"),
          entry("1", "criterion.status_changed", "2026-10-01T10:00:00Z", null),
        ],
      }),
    );
    expect(html).toContain('<section aria-labelledby="history-heading"');
    expect(html).toContain('id="history-heading"');
    expect(html).toContain("<ol");
    expect(html).not.toContain("<table");
    expect(html.match(/<li/g)).toHaveLength(2);
    expect(html.indexOf("02.10.2026")).toBeLessThan(html.indexOf("01.10.2026"));
    expect(html).toContain("Stand von «Kritisch» auf «Erfüllt»");
    expect(html).toContain("Demo owner");
    expect(html).toContain("unbekannt");
  });

  it("shows an empty state", () => {
    const html = renderToStaticMarkup(createElement(HistoryTimeline, { entries: [] }));
    expect(html).toContain("Noch keine Änderungen.");
    expect(html).not.toContain("<ol");
  });
});

describe("header and notice", () => {
  const header = (over: Partial<Parameters<typeof CriterionHeader>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(CriterionHeader, {
        number: "7.3.10", title: "Hygiene", chapter: "7 Prozesse", status: "critical", scope: "Muss",
        dueDateText: "ohne Frist", updatedAtText: "noch nie", ...over,
      }),
    );

  it("shows back link, trail, badges, h1 and the two real meta fields only", () => {
    const html = header();
    expect(html).toContain("Zurück zu den Kriterien");
    expect(html).toContain('aria-label="Kriterienpfad"');
    expect(html).toContain("Kritisch");
    expect(html).toContain("Muss");
    expect(html).toMatch(/<h1[^>]*><span class="font-mono">7\.3\.10<\/span> Hygiene<\/h1>/);
    expect(html).toContain("Frist");
    expect(html).toContain("Zuletzt geändert");
    expect(html).not.toContain("Zuständig");
  });

  it("the critical notice is emphasised and the unvalidated catalog stays flagged", () => {
    const html = renderToStaticMarkup(
      createElement(StatusNotice, { status: "critical", notApplicableReason: null, standardVersionLabel: "Entwurf 1", standardValidated: false }),
    );
    expect(html).toContain("border-critical");
    expect(html).toContain("Dieses Kriterium ist als kritisch bewertet");
    expect(html).toContain("(nicht validiert)");
    const neutral = renderToStaticMarkup(
      createElement(StatusNotice, { status: "not_assessed", notApplicableReason: null, standardVersionLabel: "Entwurf 1", standardValidated: true }),
    );
    expect(neutral).not.toContain("border-critical");
    expect(neutral).not.toContain("nicht validiert");
  });

  it("shows the reason for not applicable", () => {
    const html = renderToStaticMarkup(
      createElement(StatusNotice, { status: "not_applicable", notApplicableReason: "Wird nicht angeboten", standardVersionLabel: "x", standardValidated: true }),
    );
    expect(html).toContain("Wird nicht angeboten");
  });
});

describe("client form files stay free of server modules", () => {
  it.each(["assessment-form.tsx", "evidence-forms.tsx", "measure-forms.tsx"])("%s", (file) => {
    const source = readFileSync(join(process.cwd(), "src/app/(app)/criteria/[number]", file), "utf8");
    expect(source).toContain('"use client"');
    const valueImports = source.split("\n").filter((l) => /^import\s/.test(l) && !/^import\s+type\s/.test(l));
    for (const line of valueImports) {
      expect(line).not.toMatch(/["']@\/db(\/[\w-]+)?["']/);
      expect(line).not.toMatch(/["']@\/domain\/(assessments|documents|measures|dashboard|deadlines)["']/);
    }
  });
});
