import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MeasureFilters } from "@/domain/measure-filter";
import type { OpenMeasureView } from "@/domain/measures";
import { MeasuresRegister, REGISTER_ROW_LIMIT } from "./measures-register";

const m = (over: Partial<OpenMeasureView>): OpenMeasureView => ({
  id: "id", criterionNumber: "7.3.10", criterionTitle: "Hygiene im Fahrzeug", title: "Hygieneschulung", description: null,
  ownerUserId: "u1", ownerName: "Anna Muster", dueDate: "2026-11-15", status: "open", completedAt: null,
  createdAt: new Date("2026-10-01T00:00:00Z"), days: 38, overdue: false, ...over,
});
const members = [{ userId: "u1", name: "Anna Muster" }, { userId: "u2", name: "Bruno Beispiel" }];
const ALL: MeasureFilters = { status: "all", owner: "all", query: "" };
const render = (rows: OpenMeasureView[], filters: MeasureFilters = ALL) =>
  renderToStaticMarkup(createElement(MeasuresRegister, { rows, members, filters }));
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
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toContain('href="/measures?status=overdue"');
    expect(html).toContain("seit 3 Tagen überfällig");
    expect(html).toContain("md:min-w-[860px]");
    expect(html).toContain("05.10.2026");
    expect(html).toContain('href="/criteria/7.3.10#measures-heading"');
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
    const html = render(rows, { status: "in_progress", owner: "all", query: "" });
    expect(html).toContain("Läuft gerade");
    expect(html).not.toContain("Überfällige Sache");
    expect(html).toContain("1 von 3 Massnahmen");
    const byQuery = render(rows, { status: "all", owner: "all", query: "SCHULUNGSKONZEPT" });
    expect(byQuery).toContain(">Fertig<");
    expect(byQuery).toContain("Zurücksetzen");
    expect(byQuery).toContain('value="SCHULUNGSKONZEPT"');
    expect(byQuery).toMatch(/Alle\s*<span[^>]*>1</);
  });

  it("keeps the other parameters in segment links and the hidden status field", () => {
    const html = render(rows, { status: "open", owner: "u2", query: "a b" });
    expect(html).toContain("/measures?status=done&amp;owner=u2&amp;q=a+b");
    expect(html).toContain('<input type="hidden" name="status" value="open"');
    expect(html).toMatch(/<option value="u2" selected/);
  });

  it("shows a calm no-hit state with a way back", () => {
    const html = render(rows, { status: "all", owner: "all", query: "zzz" });
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
});
