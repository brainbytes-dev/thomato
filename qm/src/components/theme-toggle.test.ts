import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  const html = renderToStaticMarkup(createElement(ThemeToggle));

  it("renders three labelled buttons in a group", () => {
    expect(html).toContain('role="group"');
    for (const label of ["Hell", "Dunkel", "System"]) expect(html).toContain(`aria-label="${label}"`);
    expect(html.match(/<button/g)).toHaveLength(3);
  });

  it("marks exactly one option as pressed, System on the server", () => {
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="System"|aria-label="System"[^>]*aria-pressed="true"/);
  });

  it("uses no hex colours", () => {
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
