import { KAPITEL_1 } from "./kapitel-1";
import { KAPITEL_2 } from "./kapitel-2";
import { KAPITEL_3 } from "./kapitel-3";
import { KAPITEL_4 } from "./kapitel-4";
import { KAPITEL_5 } from "./kapitel-5";
import { KAPITEL_9 } from "./kapitel-9";
import { KRITERIEN } from "./kriterien";
import type { WissenChapter, WissenSection } from "./types";

export * from "./config";
export type { WissenChapter, WissenLink, WissenRef, WissenSection } from "./types";

/** Reihenfolge der Richtlinie: 1 bis 5, dann die Kriterienkarte (6 bis 8), dann der Anhang (9). */
export const WISSEN_CHAPTERS: readonly WissenChapter[] = [
  KAPITEL_1,
  KAPITEL_2,
  KAPITEL_3,
  KAPITEL_4,
  KAPITEL_5,
  KRITERIEN,
  KAPITEL_9,
];

/** Gesamter eigener Text eines Abschnitts (Wortzählung, Suche, Overlap-Prüfung). */
export function sectionText(s: WissenSection): string {
  return [s.heading, ...s.paragraphs, ...(s.items ?? []), s.appNote ?? ""].join("\n");
}

export function wissenChapterBySlug(slug: string): WissenChapter | undefined {
  return WISSEN_CHAPTERS.find((c) => c.slug === slug);
}

export function isWissenSlug(slug: string): boolean {
  return wissenChapterBySlug(slug) !== undefined;
}

export function chapterLabel(c: WissenChapter): string {
  return c.slug === "kriterien" ? c.title : `${c.number} ${c.title}`;
}
