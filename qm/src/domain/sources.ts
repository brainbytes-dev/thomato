/**
 * Quellenverzeichnis: welche offiziellen Dokumente die Kriteriennummern tragen.
 * Die Prüfsumme gehört zur konkreten Dokumentausgabe, nicht zur URL. Ersetzt 144.ch das PDF
 * unter derselben URL, schlägt `pnpm sources:check` Alarm, und die Seitenzuordnung
 * (source-pages.ts) gilt als ungeprüft, bis sie neu erzeugt und kontrolliert wurde.
 * Kein Dokumenttext im Repo, nur Verweise.
 */
export const SOURCE_IDS = ["richtlinie", "handbuch"] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

export type Source = {
  id: SourceId;
  kind: "richtlinie" | "handbuch";
  title: string;
  /** Ausgabe als Text, wie sie in der Oberfläche steht. */
  edition: string;
  /** Kurzform für die Quellenzeile. */
  shortLabel: string;
  language: "DE";
  url: string;
  sha256: string;
  pageCount: number;
};

export const SOURCES: Readonly<Record<SourceId, Source>> = {
  richtlinie: {
    id: "richtlinie",
    kind: "richtlinie",
    title: "Richtlinien zur Anerkennung von Rettungsdiensten",
    edition: "08/2025, Version 2022",
    shortLabel: "Richtlinie 08/2025",
    language: "DE",
    url: "https://www.144.ch/wp-content/uploads/2025/08/Richtlinien-zur-Anerkennung-von-Rettungsdiensten-DE.pdf",
    sha256: "8eaa0c3a2ac02209e4a39d01d2c4baff5d501f35b0b99c61be6d04a5a9bb300c",
    pageCount: 25,
  },
  handbuch: {
    id: "handbuch",
    kind: "handbuch",
    title: "Handbuch für die Vorbereitung und Durchführung des Verfahrens zur Anerkennung der Rettungsdienste gemäss Richtlinien 2022",
    edition: "08/2025, Version 2022",
    shortLabel: "Handbuch (Ausgabe 08/2025)",
    language: "DE",
    url: "https://www.144.ch/wp-content/uploads/2025/08/Handbuch-Rettungsdienst-2022-DE.pdf",
    sha256: "99690f9839f37e44b4997c06b0983ae96dfaea977890998c2a9a42d9eaaecfaa",
    pageCount: 46,
  },
};

/** Link auf eine Seite im PDF (Browser-Viewer springt per #page=N). */
export function sourcePageUrl(id: SourceId, page: number): string {
  const s = SOURCES[id];
  if (!Number.isInteger(page) || page < 1 || page > s.pageCount) {
    throw new RangeError(`Seite ${page} liegt ausserhalb von ${s.shortLabel} (1 bis ${s.pageCount})`);
  }
  return `${s.url}#page=${page}`;
}
