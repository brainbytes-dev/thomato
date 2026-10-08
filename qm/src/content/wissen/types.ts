import type { SourceId } from "@/domain/sources";

/** Verweis auf eine Stelle im offiziellen Dokument. Nur Kapitelangabe und Seite, kein Text. */
export type WissenRef = { source: SourceId; chapter: string; page: number };

export type WissenLink = { label: string; href: string };

export type WissenSection = {
  id: string;
  heading: string;
  /** Eigene Zusammenfassung, Absätze in Sie-Form. */
  paragraphs: readonly string[];
  /** Kurze Stichpunkte (Fristen, Ergebnisse), eigene Formulierung und eigene Reihenfolge. */
  items?: readonly string[];
  /** Hinweis der App (kein Richtlinientext), optisch abgesetzt. */
  appNote?: string;
  /** Zusätzliche Stellen im Dokument, zum Beispiel Handbuch oder eine Unterseite. */
  refs?: readonly WissenRef[];
};

export type WissenChapter = {
  /** URL-Segment unter /wissen. */
  slug: string;
  /** Nummer in der Richtlinie, zum Beispiel «1» oder «6 bis 8». */
  number: string;
  title: string;
  /** Ein Satz unter dem Titel und auf der Übersichtskarte. */
  summary: string;
  source: WissenRef;
  sections: readonly WissenSection[];
  /** Rücklinks in die App. */
  backLinks: readonly WissenLink[];
};
