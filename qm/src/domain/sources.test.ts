import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SOURCE_PAGES } from "./source-pages";
import { chapterDisplayName, criteriaGroupOf, sourceReferenceFor } from "./source-reference";
import { SOURCE_IDS, SOURCES, sourcePageUrl } from "./sources";

const catalog = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../../web/ivr/demo/kriterien.json"), "utf8"),
) as { nummer: string; kapitel: string }[];

describe("source registry", () => {
  it("has complete fields for every source", () => {
    for (const id of SOURCE_IDS) {
      const s = SOURCES[id];
      expect(s.id).toBe(id);
      expect(["richtlinie", "handbuch"]).toContain(s.kind);
      expect(s.title.length).toBeGreaterThan(5);
      expect(s.edition).toMatch(/08\/2025/);
      expect(s.shortLabel.length).toBeGreaterThan(3);
      expect(s.language).toBe("DE");
      expect(s.url).toMatch(/^https:\/\/www\.144\.ch\/wp-content\/uploads\/2025\/08\/.+\.pdf$/);
      expect(s.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(Number.isInteger(s.pageCount) && s.pageCount > 0).toBe(true);
    }
  });

  it("builds page links and rejects pages outside the document", () => {
    expect(sourcePageUrl("richtlinie", 15)).toBe(`${SOURCES.richtlinie.url}#page=15`);
    expect(() => sourcePageUrl("richtlinie", 0)).toThrow(RangeError);
    expect(() => sourcePageUrl("richtlinie", 26)).toThrow(RangeError);
    expect(() => sourcePageUrl("handbuch", 1.5)).toThrow(RangeError);
  });
});

describe("source page mapping", () => {
  const numbers = catalog.map((r) => r.nummer);

  it("maps every catalog number exactly once and nothing else", () => {
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(Object.keys(SOURCE_PAGES).sort()).toEqual([...numbers].sort());
  });

  it("keeps pages within the page count of the mapped source", () => {
    for (const [n, e] of Object.entries(SOURCE_PAGES)) {
      expect(e.page, n).toBeGreaterThanOrEqual(1);
      expect(e.page, n).toBeLessThanOrEqual(SOURCES[e.source].pageCount);
    }
  });

  it("assigns the dossier documents to the handbook and all criteria to the guideline", () => {
    for (const n of numbers) {
      expect(SOURCE_PAGES[n].source, n).toBe(n.startsWith("5.2.") ? "handbuch" : "richtlinie");
    }
  });

  it("matches the verified spot checks", () => {
    expect(SOURCE_PAGES["6.1"]).toEqual({ source: "richtlinie", page: 11 });
    expect(SOURCE_PAGES["7.3.10"]).toEqual({ source: "richtlinie", page: 15 });
    expect(SOURCE_PAGES["7.4.1"]).toEqual({ source: "richtlinie", page: 17 });
    expect(SOURCE_PAGES["8.5"]).toEqual({ source: "richtlinie", page: 20 });
    expect(SOURCE_PAGES["5.2.1"]).toEqual({ source: "handbuch", page: 13 });
    expect(SOURCE_PAGES["5.2.2"]).toEqual({ source: "handbuch", page: 13 });
    expect(SOURCE_PAGES["5.2.3"]).toEqual({ source: "handbuch", page: 14 });
    expect(SOURCE_PAGES["5.2.4"]).toEqual({ source: "handbuch", page: 14 });
  });

  it("never decreases page numbers along the guideline order", () => {
    const pages = numbers.filter((n) => !n.startsWith("5.")).map((n) => SOURCE_PAGES[n].page);
    expect(pages).toEqual([...pages].sort((a, b) => a - b));
  });
});

describe("source references", () => {
  it("formats the guideline line and link", () => {
    expect(sourceReferenceFor("7.3.10")).toEqual({
      sourceId: "richtlinie",
      text: "Richtlinie 08/2025, Kap. 7.3.10, S. 15",
      page: 15,
      href: `${SOURCES.richtlinie.url}#page=15`,
    });
  });
  it("formats the handbook line", () => {
    expect(sourceReferenceFor("5.2.1")?.text).toBe("Handbuch (Ausgabe 08/2025), Kap. 5.2.1, S. 13");
  });
  it("returns null for unknown numbers", () => {
    expect(sourceReferenceFor("99.9")).toBeNull();
  });
});

describe("display names", () => {
  it("shows the data value «Antrag» as «Dossier-Unterlagen» and leaves the others", () => {
    expect(chapterDisplayName("Antrag")).toBe("Dossier-Unterlagen");
    for (const k of ["Struktur", "Prozess", "Ergebnis"]) expect(chapterDisplayName(k)).toBe(k);
  });
  it("groups every catalog row by guideline chapter", () => {
    const heading = (n: string) => criteriaGroupOf(n).heading;
    expect(heading("5.2.3")).toBe("Dossier-Unterlagen (Handbuch 5.2)");
    expect(heading("6.11.2")).toBe("6 Strukturkriterien");
    expect(heading("7.10")).toBe("7 Prozesskriterien");
    expect(heading("8.1.5")).toBe("8 Ergebniskriterien");
    expect(criteriaGroupOf("9.1")).toEqual({ key: "other", heading: "Weitere Kriterien" });
    expect(criteriaGroupOf("5.1").key).toBe("other");
    expect(criteriaGroupOf("60.1").key).toBe("other");
    for (const r of catalog) {
      expect(criteriaGroupOf(r.nummer).key === "dossier").toBe(r.kapitel === "Antrag");
    }
  });
});
