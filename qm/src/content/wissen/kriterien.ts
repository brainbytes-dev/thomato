import type { WissenChapter } from "./types";

export const KRITERIEN: WissenChapter = {
  slug: "kriterien",
  number: "6 bis 8",
  title: "Kriterien (Kapitel 6 bis 8)",
  summary: "Die drei Kriterienkapitel der Richtlinie finden Sie in der App unter Kriterien.",
  source: { source: "richtlinie", chapter: "Kap. 6 bis 8", page: 11 },
  sections: [
    {
      id: "kriterienkapitel",
      heading: "Wo die Kriterien stehen",
      paragraphs: [
        "Die Kapitel 6 bis 8 enthalten die eigentlichen Anforderungen, geordnet nach Strukturkriterien (6), Prozesskriterien (7) und Ergebniskriterien (8). Weil sie in der App bearbeitet werden, gibt es dazu keine Zusammenfassung, sondern die Kriterienliste mit Bewertung, Nachweisen und Massnahmen. Jede Zeile nennt Kapitel und Seite im PDF.",
      ],
      refs: [
        { source: "richtlinie", chapter: "Kap. 7", page: 14 },
        { source: "richtlinie", chapter: "Kap. 8", page: 19 },
      ],
    },
  ],
  backLinks: [{ label: "Zur Kriterienliste", href: "/criteria" }],
};
