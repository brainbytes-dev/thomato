import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DeadlineList } from "./deadline-list";

describe("DeadlineList source pointer", () => {
  it("links the origin of the deadlines to the Wissen chapters 2, 4 and 5, with and without deadlines", () => {
    for (const deadlines of [[], [{ id: "d1", label: "Antrag einreichen", dueDate: "2026-10-28", days: 20, urgency: "soon" as const }]]) {
      const html = renderToStaticMarkup(createElement(DeadlineList, { deadlines: deadlines as never }));
      for (const slug of ["2", "4", "5"]) expect(html).toContain(`href="/wissen/${slug}"`);
      expect(html).toContain("Woher die Fristen kommen");
    }
  });
});
