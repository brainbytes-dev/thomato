import { describe, expect, it } from "vitest";
import { breadcrumbsFor, initialsOf } from "./breadcrumbs";

describe("breadcrumbsFor", () => {
  it("builds org / Übersicht for the dashboard", () => {
    expect(breadcrumbsFor("/", "Rettung Muster")).toEqual([{ label: "Rettung Muster" }, { label: "Übersicht" }]);
  });

  it("builds section crumbs", () => {
    expect(breadcrumbsFor("/criteria", "Org")).toEqual([{ label: "Org" }, { label: "Kriterien" }]);
    expect(breadcrumbsFor("/measures", "Org")).toEqual([{ label: "Org" }, { label: "Massnahmen" }]);
    expect(breadcrumbsFor("/documents", "Org")).toEqual([{ label: "Org" }, { label: "Dokumente" }]);
  });

  it("links the section on detail pages and decodes the criterion number", () => {
    expect(breadcrumbsFor("/criteria/7.3.10", "Org")).toEqual([
      { label: "Org" },
      { label: "Kriterien", href: "/criteria" },
      { label: "7.3.10" },
    ]);
    expect(breadcrumbsFor("/criteria/a%20b", "Org").at(-1)).toEqual({ label: "a b" });
    expect(breadcrumbsFor("/criteria/%E0%A4%A", "Org").at(-1)).toEqual({ label: "%E0%A4%A" });
  });

  it("builds Organisation / Wissen / Kapitel", () => {
    expect(breadcrumbsFor("/wissen", "Org")).toEqual([{ label: "Org" }, { label: "Wissen" }]);
    expect(breadcrumbsFor("/wissen/5", "Org")).toEqual([
      { label: "Org" },
      { label: "Wissen", href: "/wissen" },
      { label: "5 Erneuerung der Anerkennung" },
    ]);
    expect(breadcrumbsFor("/wissen/kriterien", "Org").at(-1)).toEqual({ label: "Kriterien (Kapitel 6 bis 8)" });
    expect(breadcrumbsFor("/wissen/unbekannt", "Org").at(-1)).toEqual({ label: "Kapitel" });
  });

  it("labels a measure detail page without showing the id", () => {
    expect(breadcrumbsFor("/measures/3f2b8c1e-5d4a-4e6b-9a7c-1b2c3d4e5f60", "Org")).toEqual([
      { label: "Org" },
      { label: "Massnahmen", href: "/measures" },
      { label: "Detail" },
    ]);
  });

  it("falls back to the organisation for unknown paths", () => {
    expect(breadcrumbsFor("/nope", "Org")).toEqual([{ label: "Org" }]);
  });
});

describe("initialsOf", () => {
  it("uses first and last word", () => {
    expect(initialsOf("Anna Beispiel")).toBe("AB");
    expect(initialsOf("anna maria beispiel")).toBe("AB");
    expect(initialsOf("Cher")).toBe("C");
    expect(initialsOf("  ")).toBe("?");
  });
});
