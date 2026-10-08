import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MeasureFilters } from "@/domain/measure-filter";
import type { PdcaFigures } from "@/domain/measure-pdca";
import type { OpenMeasureView } from "@/domain/measures";
import { MeasuresRegister, REGISTER_ROW_LIMIT } from "./measures-register";

const m = (over: Partial<OpenMeasureView>): OpenMeasureView => ({
  id: "id", criterionNumber: "7.3.10", criterionTitle: "Hygiene im Fahrzeug", title: "Hygieneschulung", description: null,
  ownerUserId: "u1", ownerName: "Anna Muster", dueDate: "2026-11-15", status: "open", phase: "plan", cycle: 1, completedAt: null,
  createdAt: new Date("2026-10-01T00:00:00Z"), days: 38, overdue: false, ...over,
});
const members = [{ userId: "u1", name: "Anna Muster" }, { userId: "u2", name: "Bruno Beispiel" }];
const ALL: MeasureFilters = { status: "all", phase: "all", owner: "all", query: "" };
const NONE: PdcaFigures = {
  total: 0, phases: { plan: 0, do: 0, check: 0, act: 0 }, effective: { percent: null, n: 0 }, averageDaysToClose: { days: null, n: 0 },
};
const render = (rows: OpenMeasureView[], filters: MeasureFilters = ALL, figures: PdcaFigures = NONE) =>
  renderToStaticMarkup(createElement(MeasuresRegister, { rows, members, filters, figures }));
const text = (html: string) => html.replace(/<[^>]+>/g, " ");

const rows = [
  m({ id: "1", title: "Überfällige Sache", overdue: true, days: -3, dueDate: "2026-10-05" }),
  m({ id: "2", title: "Läuft gerade", status: "in_progress", ownerUserId: "u2", ownerName: "Bruno Beispiel" }),
  m({ id: "3", title: "Fertig", status: "done", criterionNumber: "6.3.2", criterionTitle: "Schulungskonzept" }),
];

describe("MeasuresRegister", () => {
  it("shows figures, filter segments with aria-current, search form and read-only table", () => {
    const html = render(rows);
    for (const w of ["Offen", "In Bearbeitung", "Überfällig", "Erledigt", "Alle", "Suchen", "Verantwortliche"]) expect(html).toContain(w);
    expect(html.match(/aria-current="true"/g)).toHaveLength(2); // Status «Alle» und Phase «Alle»
    expect(html).toContain('href="/measures?status=overdue"');
    expect(html).toContain("seit 3 Tagen überfällig");
    expect(html).toContain("md:min-w-[960px]");
    expect(html).toContain("05.10.2026");
    expect(html).toContain('href="/measures/1"');
    expect(html).toContain('href="/criteria/7.3.10"');
    expect(html).toContain("3 von 3 Massnahmen");
    expect(html).not.toContain("Zurücksetzen");
  });

  it("is read only: no write controls except the GET search form", () => {
    const html = render(rows);
    expect(html).not.toMatch(/<form[^>]*method="post"/i);
    expect(html.match(/<form/g)).toHaveLength(1);
    expect(html).toContain('method="get"');
    expect(html.match(/<button/g)).toHaveLength(1);
    for (const w of ["Anlegen", "Löschen", "Bearbeiten", "Als erledigt"]) expect(html).not.toContain(w);
  });

  it("filters by status, owner and query, counts follow search and owner", () => {
    const html = render(rows, { ...ALL, status: "in_progress" });
    expect(html).toContain("Läuft gerade");
    expect(html).not.toContain("Überfällige Sache");
    expect(html).toContain("1 von 3 Massnahmen");
    const byQuery = render(rows, { ...ALL, query: "SCHULUNGSKONZEPT" });
    expect(byQuery).toContain(">Fertig<");
    expect(byQuery).toContain("Zurücksetzen");
    expect(byQuery).toContain('value="SCHULUNGSKONZEPT"');
    expect(byQuery).toMatch(/Alle\s*<span[^>]*>1</);
  });

  it("keeps the other parameters in segment links and the hidden status field", () => {
    const html = render(rows, { ...ALL, status: "open", owner: "u2", query: "a b" });
    expect(html).toContain("/measures?status=done&amp;owner=u2&amp;q=a+b");
    expect(html).toContain('<input type="hidden" name="status" value="open"');
    expect(html).toMatch(/<option value="u2" selected/);
  });

  it("shows a removable chip for status=active without highlighting a tab", () => {
    const html = render(rows, { ...ALL, status: "active", query: "x" });
    expect(html).toContain("Offen und in Bearbeitung");
    expect(html).toContain('aria-label="Filter «Offen und in Bearbeitung» aufheben"');
    expect(html).toContain('href="/measures?q=x"');
    expect(html.match(/aria-current="true"/g)).toHaveLength(1); // nur Phase «Alle», kein Status-Tab
    const plain = render(rows, { ...ALL, status: "active" });
    expect(plain).toContain("2 von 3 Massnahmen");
    expect(render(rows)).not.toContain("Filter aufheben");
  });

  it("shows a calm no-hit state with a way back", () => {
    const html = render(rows, { ...ALL, query: "zzz" });
    expect(text(html)).toContain("Keine Massnahmen mit dieser Auswahl");
    expect(html).toContain('href="/measures"');
    expect(html).toContain("0 von 3 Massnahmen");
  });

  it("shows an organisation empty state pointing to the criteria", () => {
    const html = render([]);
    expect(text(html)).toContain("Massnahmen legen Sie auf der Seite eines Kriteriums an");
    expect(html).toContain('href="/criteria"');
    expect(html).not.toContain("<table");
  });

  it("caps the table at 200 rows with a visible hint", () => {
    const many = Array.from({ length: REGISTER_ROW_LIMIT + 5 }, (_, i) => m({ id: `m${i}`, title: `Titel ${i}` }));
    const html = render(many);
    expect(html.match(/<tr/g)).toHaveLength(REGISTER_ROW_LIMIT + 1);
    expect(text(html)).toContain("200 von 205 Massnahmen");
    expect(text(html)).toContain("ersten 200 von 205 Treffern");
  });

  it("escapes hostile text and uses no hex colours, em dashes or double hyphens", () => {
    const html = render([m({ title: "<img src=x onerror=alert(1)>", ownerName: null })]);
    expect(html).not.toContain("<img");
    expect(html).toContain("unbekannt");
    const q = render(rows, { ...ALL, query: '"><script>' });
    expect(q).not.toContain("<script>");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(text(render(rows))).not.toMatch(/[—–]|--/);
  });

  describe("PDCA", () => {
    const mixed = [
      m({ id: "p", title: "Geplant", phase: "plan" }),
      m({ id: "d", title: "Umsetzung", phase: "do", status: "in_progress" }),
      m({ id: "c", title: "Prüfung", phase: "check", status: "in_progress", cycle: 2 }),
      m({ id: "a", title: "Entscheid", phase: "act", status: "in_progress" }),
      m({ id: "x", title: "Abgeschlossene", phase: "act", status: "done" }),
    ];
    const figs: PdcaFigures = {
      total: 5, phases: { plan: 1, do: 1, check: 1, act: 2 }, effective: { percent: 67, n: 3 }, averageDaysToClose: { days: 12.5, n: 2 },
    };

    it("shows the Phase column with word and icon, the cycle only from cycle 2, and detail links", () => {
      const html = render(mixed);
      expect(html).toMatch(/<th[^>]*>Phase<\/th>/);
      expect(text(html)).toContain("Zyklus 2");
      expect(text(html).match(/Zyklus/g)).toHaveLength(2); // Zeile: Desktop plus mobile Liste
      expect(text(html)).toContain("Abgeschlossen");
      expect(html).toContain("lucide-search-check");
      for (const id of ["p", "d", "c", "a", "x"]) expect(html).toContain(`href="/measures/${id}"`);
      expect(html).toContain('href="/criteria/7.3.10"');
      expect(text(render([m({ cycle: 1 })]))).not.toContain("Zyklus");
    });

    it("shows the phase distribution as filter links with done separate from act", () => {
      const html = render(mixed);
      for (const ph of ["plan", "do", "check", "act"]) expect(html).toContain(`href="/measures?phase=${ph}"`);
      expect(html).toContain('aria-label="Act: 2, Liste filtern"');
      expect(html).toContain('aria-label="Davon abgeschlossen: 1, Liste filtern"');
      expect(text(html)).toContain("davon abgeschlossen");
    });

    it("filters by phase, highlights the phase tab and keeps the other parameters in links", () => {
      const html = render(mixed, { ...ALL, phase: "act" });
      expect(html).toContain("Entscheid");
      expect(html).toContain("Abgeschlossene");
      expect(html).not.toContain(">Geplant<");
      expect(text(html)).toContain("2 von 5 Massnahmen");
      expect(html.match(/aria-current="true"/g)).toHaveLength(2); // Status «Alle» und Phase «Act»
      expect(html).toContain('<input type="hidden" name="phase" value="act"');
      expect(html).toContain("/measures?status=overdue&amp;phase=act");
      expect(html).toContain("/measures?phase=check");
      expect(render(mixed)).not.toContain('name="phase"');
    });

    it("phase tab counts follow status, owner and search but not the phase itself", () => {
      const html = render(mixed, { ...ALL, status: "active", phase: "act" });
      const phaseNav = html.slice(html.indexOf('aria-label="Phase"'));
      expect(phaseNav).toMatch(/Alle\s*<span[^>]*>4</);
      expect(phaseNav).toMatch(/Act\s*<span[^>]*>1</);
      expect(phaseNav).toMatch(/Plan\s*<span[^>]*>1</);
    });

    it("shows both figures with n from n = 1", () => {
      const html = text(render(mixed, ALL, figs));
      expect(html).toContain("67 %");
      expect(html).toContain("(n=3)");
      expect(html).toContain("12,5 Tage");
      expect(html).toContain("(n=2)");
      const one = text(render(mixed, ALL, { ...figs, effective: { percent: 100, n: 1 }, averageDaysToClose: { days: 21, n: 1 } }));
      expect(one).toContain("100 %");
      expect(one).toContain("(n=1)");
      expect(one).toContain("21 Tage");
    });

    it("shows a calm empty sentence instead of numbers at n = 0 and for a single missing figure", () => {
      const html = text(render(mixed, ALL, NONE));
      expect(html).toContain("Noch keine Wirksamkeitsprüfung");
      expect(html).toContain("Noch keine abgeschlossene Massnahme");
      expect(html).not.toMatch(/\d+ %/);
      expect(html).not.toContain("n=");
      const half = text(render(mixed, ALL, { ...figs, averageDaysToClose: { days: null, n: 0 } }));
      expect(half).toContain("67 %");
      expect(half).toContain("Noch keine abgeschlossene Massnahme");
      expect(half).not.toContain("Noch keine Wirksamkeitsprüfung");
    });

    it("stays read only for owner and viewer alike (same markup, no write controls)", () => {
      const html = render(mixed, ALL, figs);
      expect(html.match(/<form/g)).toHaveLength(1);
      expect(html.match(/<button/g)).toHaveLength(1);
    });

    it("keeps the status figures equal to the row counts", () => {
      const html = render(mixed);
      expect(html).toContain('aria-label="Offen: 1, Liste filtern"');
      expect(html).toContain('aria-label="In Bearbeitung: 3, Liste filtern"');
      expect(html).toContain('aria-label="Erledigt: 1, Liste filtern"');
    });
  });
});
