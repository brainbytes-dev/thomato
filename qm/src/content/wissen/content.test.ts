import { describe, expect, it } from "vitest";
import { KNOWLEDGE_AREA_READY, KNOWLEDGE_CRITERIA_HREF } from "@/domain/knowledge-area";
import { SOURCES } from "@/domain/sources";
import {
  WISSEN_CHAPTERS,
  WISSEN_DISCLAIMER,
  WISSEN_DRAFT,
  WISSEN_DRAFT_LABEL,
  WISSEN_SECTION_WORD_LIMIT,
  isWissenSlug,
  sectionText,
  DEADLINES_HREF,
  type WissenRef,
} from ".";

const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
const allRefs = WISSEN_CHAPTERS.flatMap((c) => [c.source, ...c.sections.flatMap((s) => s.refs ?? [])]);

describe("wissen content config", () => {
  it("covers chapters 1 to 5, the criteria card and the appendix with unique slugs", () => {
    expect(WISSEN_CHAPTERS.map((c) => c.slug)).toEqual(["1", "2", "3", "4", "5", "kriterien", "9"]);
    expect(new Set(WISSEN_CHAPTERS.map((c) => c.slug)).size).toBe(WISSEN_CHAPTERS.length);
  });

  it("keeps the disclaimer and draft constants exact, draft on by default", () => {
    expect(WISSEN_DISCLAIMER).toBe("Zusammenfassung. Massgebend ist die offizielle IVR-Richtlinie.");
    expect(WISSEN_DRAFT_LABEL).toBe("Entwurf, fachlich noch zu prüfen");
    expect(WISSEN_DRAFT).toBe(true);
  });

  it("gives every chapter a source and every page number inside the registry's page count", () => {
    for (const c of WISSEN_CHAPTERS) {
      expect(c.source.source, c.slug).toBeTruthy();
      expect(c.source.chapter, c.slug).toMatch(/^Kap\. /);
    }
    for (const r of allRefs as WissenRef[]) {
      expect(Number.isInteger(r.page)).toBe(true);
      expect(r.page).toBeGreaterThanOrEqual(1);
      expect(r.page).toBeLessThanOrEqual(SOURCES[r.source].pageCount);
    }
  });

  it("keeps every section within the word limit and every section id unique per chapter", () => {
    for (const c of WISSEN_CHAPTERS) {
      expect(new Set(c.sections.map((s) => s.id)).size, c.slug).toBe(c.sections.length);
      for (const s of c.sections) {
        const n = words(sectionText(s));
        expect(n, `${c.slug}/${s.id}`).toBeLessThanOrEqual(WISSEN_SECTION_WORD_LIMIT);
        expect(s.paragraphs.length, `${c.slug}/${s.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("links back into the app from every chapter, deadlines from chapters 2, 4 and 5", () => {
    for (const c of WISSEN_CHAPTERS) expect(c.backLinks.length, c.slug).toBeGreaterThan(0);
    for (const slug of ["2", "4", "5"]) {
      expect(WISSEN_CHAPTERS.find((c) => c.slug === slug)?.backLinks.map((l) => l.href)).toContain(DEADLINES_HREF);
    }
    const k1 = WISSEN_CHAPTERS.find((c) => c.slug === "1");
    expect(k1?.backLinks.map((l) => l.href)).toContain("/criteria");
  });

  it("uses no em dashes, double hyphens or IVR claims", () => {
    const text = JSON.stringify(WISSEN_CHAPTERS);
    expect(text).not.toMatch(/[—–]|--/);
    expect(text).not.toMatch(/zertifiziert|vom IVR freigegeben|offizielle App/i);
    expect(text).not.toMatch(/ß/);
  });

  it("keeps the deadline anchor constant and a real app note for the practical tip in chapter 3", () => {
    expect(DEADLINES_HREF).toBe("/#deadlines-heading");
    const k3 = WISSEN_CHAPTERS.find((c) => c.slug === "3");
    expect(k3?.sections[0].appNote).toContain("Hinweis der App, kein Richtlinientext");
  });

  it("states the app note on the selection duty in chapter 1", () => {
    const s = WISSEN_CHAPTERS[0].sections.find((x) => x.id === "auswahl");
    expect(s?.appNote).toContain("nicht im Verfahren");
    expect(s?.appNote).toContain("8.1, 8.2 und 8.4");
  });

  it("marks the knowledge area ready and points the criteria legend at an existing slug", () => {
    expect(KNOWLEDGE_AREA_READY).toBe(true);
    const m = /^\/wissen\/([^/#]+)(#(.+))?$/.exec(KNOWLEDGE_CRITERIA_HREF);
    expect(m).not.toBeNull();
    expect(isWissenSlug(m![1])).toBe(true);
    if (m![3]) {
      const chapter = WISSEN_CHAPTERS.find((c) => c.slug === m![1]);
      expect(chapter?.sections.some((s) => s.id === m![3])).toBe(true);
    }
  });
});
