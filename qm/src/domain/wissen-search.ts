import { chapterLabel, WISSEN_CHAPTERS, WISSEN_QUERY_MAX, type WissenChapter, type WissenSection } from "@/content/wissen";

type RawParam = string | string[] | undefined;

/** Erster Wert, getrimmt und auf WISSEN_QUERY_MAX Zeichen (Codepoints) begrenzt. */
export function parseWissenQuery(value: RawParam): string {
  const first = Array.isArray(value) ? value[0] : value;
  return [...(first ?? "").trim()].slice(0, WISSEN_QUERY_MAX).join("").trim();
}

/** Nur für den Vergleich: klein, NFKD, Combining Marks entfernt. */
function fold(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

export type WissenHit = {
  chapter: WissenChapter;
  /** Kapitelbezeichnung oder Kurztext passt. */
  chapterMatched: boolean;
  sections: WissenSection[];
};

function sectionText(s: WissenSection): string {
  return [s.heading, ...s.paragraphs, s.appNote ?? ""].join(" ");
}

/**
 * Einfache Teilstring-Suche (kein Regex, Sonderzeichen sind wörtlich) über Titel, Kapitelbezeichnung
 * und unsere eigenen Zusammenfassungen. Durchsucht nie Richtlinien- oder Handbuchtext.
 */
export function searchWissen(query: string, chapters: readonly WissenChapter[] = WISSEN_CHAPTERS): WissenHit[] {
  const needle = fold(query);
  if (needle === "") return [];
  const hits: WissenHit[] = [];
  for (const chapter of chapters) {
    const chapterMatched = [chapterLabel(chapter), chapter.title, chapter.summary, chapter.number].some((t) => fold(t).includes(needle));
    const sections = chapter.sections.filter((s) => fold(sectionText(s)).includes(needle));
    if (chapterMatched || sections.length > 0) hits.push({ chapter, chapterMatched, sections });
  }
  return hits;
}
