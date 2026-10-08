import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WISSEN_CHAPTERS, WISSEN_DISCLAIMER, WISSEN_DRAFT_LABEL } from "@/content/wissen";
import { hitExcerpt, parseWissenQuery, searchWissen } from "@/domain/wissen-search";
import { sourcePageUrl } from "@/domain/sources";
import { ChapterView } from "./chapter-view";
import { WissenOverview } from "./overview";

const chapter = (slug: string, draft = true) => {
  const c = WISSEN_CHAPTERS.find((x) => x.slug === slug);
  if (!c) throw new Error(slug);
  return renderToStaticMarkup(createElement(ChapterView, { chapter: c, draft }));
};
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");

describe("chapter pages", () => {
  for (const c of WISSEN_CHAPTERS) {
    it(`renders ${c.slug} with disclaimer, source line link, draft marker and back links`, () => {
      const html = chapter(c.slug);
      expect(text(html)).toContain(WISSEN_DISCLAIMER);
      expect(html).toContain(WISSEN_DRAFT_LABEL);
      expect(html).toContain("Quelle:");
      expect(html).toContain(`${sourcePageUrl(c.source.source, c.source.page)}`);
      expect(html).toContain('target="_blank"');
      for (const l of c.backLinks) expect(html).toContain(`href="${l.href}"`);
      expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });
  }

  it("hides the draft marker once the flag is off but keeps the disclaimer", () => {
    const html = chapter("3", false);
    expect(html).not.toContain(WISSEN_DRAFT_LABEL);
    expect(text(html)).toContain(WISSEN_DISCLAIMER);
  });

  it("shows the plain app note on the selection duty in chapter 1", () => {
    const html = text(chapter("1"));
    expect(html).toContain("nicht im Verfahren");
    expect(html).toContain("kein Richtlinientext");
  });

  it("links the criteria card page back to the criteria list", () => {
    expect(chapter("kriterien")).toContain('href="/criteria"');
  });

  it("describes the appendix without a table and links its pages", () => {
    const html = chapter("9");
    expect(html).not.toContain("<table");
    expect(html).toContain("#page=22");
    expect(html).toContain("#page=24");
  });
});

describe("overview", () => {
  const html = renderToStaticMarkup(createElement(WissenOverview, { query: "", draft: true }));
  it("lists all chapters with links and explains the numbering", () => {
    for (const c of WISSEN_CHAPTERS) expect(html).toContain(`href="/wissen/${c.slug}"`);
    expect(text(html)).toContain("Wissen deckt die Kapitel 1 bis 5 und den Anhang 9 ab");
    expect(text(html)).toContain("Kapitel 6 bis 8");
    expect(text(html)).toContain(WISSEN_DISCLAIMER);
    expect(html).toContain(WISSEN_DRAFT_LABEL);
    expect(html).toContain('role="search"');
  });

  it("shows hits for a matching query and links into the section", () => {
    const r = renderToStaticMarkup(createElement(WissenOverview, { query: "Rekurs", draft: true }));
    expect(r).toContain("mit Treffern");
    expect(r).toContain('href="/wissen/3"');
    expect(r).toContain('value="Rekurs"');
    expect(r).not.toContain("Kapitel der Richtlinie");
  });

  it("shows a clear empty state without hits", () => {
    const r = text(renderToStaticMarkup(createElement(WissenOverview, { query: "Zahnbürste", draft: true })));
    expect(r).toContain("Keine Treffer für «Zahnbürste»");
    expect(r).toContain("nicht die Richtlinie selbst");
  });

  it("treats special characters literally and escapes them", () => {
    const r = renderToStaticMarkup(createElement(WissenOverview, { query: '<b>"(.*)[', draft: true }));
    expect(r).not.toContain("<b>");
    expect(r).toContain("Keine Treffer");
  });
});

describe("search excerpt", () => {
  it("shows the text that contains the hit, not always the first paragraph", () => {
    const sec = WISSEN_CHAPTERS.find((c) => c.slug === "2")!.sections.find((s) => s.id === "besuch")!;
    const ex = hitExcerpt(sec, "Interessenkonflikt");
    expect(ex).toContain("Interessenkonflikt");
    expect(hitExcerpt(sec, "Gast")).toContain("Gast");
    expect(hitExcerpt(sec, "zzzz")).toBe(sec.paragraphs[0]);
  });
  it("finds hits in list items", () => {
    expect(searchWissen("Gegenüberstellung").map((h) => h.chapter.slug)).toContain("5");
  });
});

describe("search", () => {
  it("finds by title, number label and summary text, case and umlaut insensitive", () => {
    expect(searchWissen("rekurs").map((h) => h.chapter.slug)).toContain("3");
    expect(searchWissen("ERNEUERUNG").map((h) => h.chapter.slug)).toContain("5");
    expect(searchWissen("anhang").map((h) => h.chapter.slug)).toContain("9");
    expect(searchWissen("qualitatskreislauf").map((h) => h.chapter.slug)).toContain("5");
  });
  it("returns nothing for empty, unknown or regex-looking queries", () => {
    expect(searchWissen("")).toEqual([]);
    expect(searchWissen("   ")).toEqual([]);
    expect(searchWissen("zzzzqq")).toEqual([]);
    expect(searchWissen(".*")).toEqual([]);
    expect(searchWissen("[[")).toEqual([]);
  });
  it("parses the raw query: first value, trimmed, capped", () => {
    expect(parseWissenQuery(undefined)).toBe("");
    expect(parseWissenQuery(["  a ", "b"])).toBe("a");
    expect([...parseWissenQuery("x".repeat(500))].length).toBe(80);
  });
});
