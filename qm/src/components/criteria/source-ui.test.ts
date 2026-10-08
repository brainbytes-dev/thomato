import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChapterProgressTable } from "@/components/dashboard/chapter-progress";
import { sourceReferenceFor } from "@/domain/source-reference";
import { CriteriaLegend } from "./criteria-legend";
import { CriterionHeader } from "./criterion-header";

const header = (number: string, chapter: string) =>
  renderToStaticMarkup(
    createElement(CriterionHeader, {
      number, title: "T", chapter, status: "open", scope: "Muss", dueDateText: "ohne Frist", updatedAtText: "noch nie",
      source: sourceReferenceFor(number),
    }),
  );

describe("source line in the criterion header", () => {
  it("shows the guideline line with a new-tab link to the page", () => {
    const html = header("7.3.10", "Prozess");
    expect(html).toContain("Quelle:");
    expect(html).toContain("Richtlinie 08/2025, Kap. 7.3.10, S. 15");
    expect(html).toContain('href="https://www.144.ch/wp-content/uploads/2025/08/Richtlinien-zur-Anerkennung-von-Rettungsdiensten-DE.pdf#page=15"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it("shows the handbook line for the dossier documents", () => {
    const html = header("5.2.1", "Dossier-Unterlagen");
    expect(html).toContain("Handbuch (Ausgabe 08/2025), Kap. 5.2.1, S. 13");
    expect(html).toContain("Handbuch-Rettungsdienst-2022-DE.pdf#page=13");
  });
  it("renders without a source when none is given", () => {
    const html = renderToStaticMarkup(
      createElement(CriterionHeader, { number: "x", title: "T", chapter: "c", status: "open", scope: "Muss", dueDateText: "a", updatedAtText: "b" }),
    );
    expect(html).not.toContain("Quelle:");
  });
});

describe("criteria legend", () => {
  const html = renderToStaticMarkup(createElement(CriteriaLegend));
  it("explains Muss, Soll and Auswahl and points to the knowledge area", () => {
    for (const t of ["Muss", "Soll", "Auswahl", "Mindestanzahl", "Bereich Wissen"]) expect(html).toContain(t);
  });
  it("renders no link while the knowledge area does not exist", () => {
    expect(html).not.toContain("<a ");
  });
});

describe("display name for the data chapter", () => {
  it("shows «Dossier-Unterlagen» instead of «Antrag» on the dashboard chapter cards", () => {
    const html = renderToStaticMarkup(
      createElement(ChapterProgressTable, {
        chapters: [
          { chapter: "Antrag", met: 1, applicable: 2, percent: 50 },
          { chapter: "Struktur", met: 2, applicable: 2, percent: 100 },
        ],
      }),
    );
    expect(html).toContain("Dossier-Unterlagen");
    expect(html).not.toContain("Antrag");
    expect(html).toContain("Struktur");
  });
});
