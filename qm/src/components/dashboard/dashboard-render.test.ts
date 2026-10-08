import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ActionItem, DashboardData } from "@/domain/dashboard";
import { computeReadiness } from "@/domain/readiness";
import { ActionCenter } from "./action-center";
import { ReadinessHero } from "./readiness-hero";

const item = (over: Partial<ActionItem>): ActionItem => ({
  key: "k", priority: "medium", criterionNumber: null, topic: "t", title: "Titel", reference: "7.3.10 · Prozess",
  ownerName: null, dueDate: null, dueInDays: null, statusLabel: "Offen", href: "/criteria/7.3.10", source: "criterion", ...over,
});

describe("ActionCenter render", () => {
  const html = renderToStaticMarkup(
    createElement(ActionCenter, {
      total: 12,
      items: [
        item({ key: "a", priority: "critical", title: "Hygiene", ownerName: null, dueDate: "2026-10-01", dueInDays: -6, statusLabel: "Kritisch" }),
        item({ key: "b", priority: "high", title: "Schulung", ownerName: "Anna Muster", source: "measure", dueDate: "2026-10-20", dueInDays: 13, statusLabel: "Massnahme fällig in 13 Tagen" }),
        item({ key: "c", priority: "medium", title: "Frist X", source: "deadline", href: null }),
      ],
    }),
  );

  it("shows the segmented filter with counts and aria-pressed", () => {
    for (const label of ["Alle", "Kritisch", "Fristen", "Nachweise"]) expect(html).toContain(label);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(3);
  });

  it("renders owner, mono date, overdue emphasis and an open link only where a target exists", () => {
    expect(html).toContain("Anna Muster");
    expect(html).toContain("01.10.2026");
    expect(html).toMatch(/font-semibold text-critical[^>]*>01\.10\.2026/);
    expect(html.match(/>Öffnen</g)).toHaveLength(2);
    expect(html).toContain("min-w-[960px]");
  });

  it("keeps the truncation note", () => {
    expect(html).toContain("3 von 12 Punkten");
  });

  it("uses no hex colours or em dashes", () => {
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html.replace(/<[^>]+>/g, " ")).not.toMatch(/[—–]/);
  });
});

describe("ReadinessHero render", () => {
  const readiness = computeReadiness([], "accreditation", false);
  const data: DashboardData = {
    readiness: { ...readiness, status: "critical", progressPercent: 40, applicable: 10, met: 4, mandatory: { total: 8, met: 3, critical: 2, open: 1, notAssessed: 2, notApplicable: 1 } },
    actions: [], deadlines: [], chapters: [],
    evidence: { current: 1, stale: 2, missing: 3 },
    measures: { open: 4, overdue: 1 },
    expiry: { kind: "months", months: 20 },
    overdueCount: 1,
    soonCount: 5,
  };
  const html = renderToStaticMarkup(createElement(ReadinessHero, { data, asOf: "07.10.2026" }));

  it("keeps every figure and the draft notice, with the date in the header", () => {
    for (const text of ["Stand 07.10.2026", "Kritisch", "40 %", "4 / 10", "20 Monate", "Dokumentationsstand", "Kriterien erfüllt", "Bis Ablauf der Anerkennung",
      "Nachweise (anwendbare Pflichtkriterien)", "Massnahmen", "Offen", "Überfällig",
      "Interne Arbeitsbewertung auf Basis eines nicht validierten Katalogs (Entwurf). Keine Entscheidung des IVR.",
      "1 Pflichtkriterium als nicht anwendbar markiert", "Alle nicht anwendbaren Kriterien ansehen"]) {
      expect(html).toContain(text);
    }
  });

  it("renders the five summary badges as words with counts", () => {
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    for (const t of ["Kritisch 2", "Offen 1", "Nicht bewertet 2", "Überfällig 1", "Fällig in 30 Tagen 5"]) expect(text).toContain(t);
  });

  it("makes no IVR readiness claim in labels", () => {
    expect(html).not.toContain("IVR READINESS");
    expect(html).not.toContain("IVR-Anerkannt");
  });
});
