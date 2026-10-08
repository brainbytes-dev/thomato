import { SOURCES, sourcePageUrl, type SourceId } from "./sources";
import { SOURCE_PAGES } from "./source-pages";

export type SourceReference = {
  sourceId: SourceId;
  /** Text der Quellenzeile ohne «Quelle:», zum Beispiel «Richtlinie 08/2025, Kap. 7.3.10, S. 15». */
  text: string;
  page: number;
  href: string;
};

/** Quellenangabe zu einer Katalognummer; null, wenn die Nummer nicht zugeordnet ist. */
export function sourceReferenceFor(number: string): SourceReference | null {
  const entry = SOURCE_PAGES[number];
  if (!entry) return null;
  const s = SOURCES[entry.source];
  return {
    sourceId: entry.source,
    text: `${s.shortLabel}, Kap. ${number}, S. ${entry.page}`,
    page: entry.page,
    href: sourcePageUrl(entry.source, entry.page),
  };
}

/** Anzeigename der Katalogkategorie. Die Datenwerte bleiben unverändert (Import, Fortschritt). */
export function chapterDisplayName(chapter: string): string {
  return chapter === "Antrag" ? "Dossier-Unterlagen" : chapter;
}

export type CriteriaGroup = { key: "dossier" | "6" | "7" | "8"; heading: string };

/** Gruppe einer Katalognummer nach Richtlinienkapitel; 5.2.x gehört zu den Dossier-Unterlagen. */
export function criteriaGroupOf(number: string): CriteriaGroup {
  if (number.startsWith("5.")) return { key: "dossier", heading: "Dossier-Unterlagen (Handbuch 5.2)" };
  if (number.startsWith("6")) return { key: "6", heading: "6 Strukturkriterien" };
  if (number.startsWith("7")) return { key: "7", heading: "7 Prozesskriterien" };
  return { key: "8", heading: "8 Ergebniskriterien" };
}
