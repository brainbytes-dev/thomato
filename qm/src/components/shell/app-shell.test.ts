import { createElement, type ComponentProps, type FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

import { AppShell } from "./app-shell";

function render(path: string): string {
  pathname = path;
  return renderToStaticMarkup(
    createElement(
      AppShell as FunctionComponent<Omit<ComponentProps<typeof AppShell>, "children">>,
      { organizationName: "Rettung Muster", roleLabel: "Lesezugriff", userName: "Anna Beispiel" },
      createElement("p", null, "Inhalt"),
    ),
  );
}

describe("AppShell", () => {
  it("offers only the real navigation targets", () => {
    const html = render("/");
    for (const label of ["Übersicht", "Kriterien", "Massnahmen", "Dokumente"]) expect(html).toContain(label);
    for (const phantom of ["Betriebshandbuch", "Fälle", "Analysen", "Qualitätskreisläufe", "THOMATO", "IVR"]) {
      expect(html).not.toContain(phantom);
    }
  });

  it("marks the current section with aria-current", () => {
    const html = render("/criteria/7.3.10");
    expect(html).toMatch(/aria-current="page"[^>]*href="\/criteria"|href="\/criteria"[^>]*aria-current="page"/);
    expect(html.match(/aria-current="page"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("places Massnahmen between Kriterien and Dokumente and marks it current", () => {
    const html = render("/measures");
    expect(html.indexOf('href="/criteria"')).toBeLessThan(html.indexOf('href="/measures"'));
    expect(html.indexOf('href="/measures"')).toBeLessThan(html.indexOf('href="/documents"'));
    expect(html).toMatch(/aria-current="page"[^>]*href="\/measures"|href="\/measures"[^>]*aria-current="page"/);
  });

  it("renders breadcrumbs, org, role, user and sign-out", () => {
    const html = render("/criteria/7.3.10");
    expect(html).toContain("Rettung Muster");
    expect(html).toContain("7.3.10");
    expect(html).toContain("Lesezugriff");
    expect(html).toContain("Anna Beispiel");
    expect(html).toContain('aria-label="Abmelden"');
    expect(html).toContain("Inhalt");
  });

  it("has a closed mobile menu button wired to the sidebar and the theme toggle", () => {
    const html = render("/");
    expect(html).toMatch(/aria-label="Menü öffnen"/);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="app-sidebar"');
    expect(html).toContain('aria-label="Darstellung"');
  });

  it("uses no hex colours or em dashes", () => {
    const html = render("/");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html.replace(/<[^>]+>/g, " ")).not.toMatch(/[—–]/);
  });
});
