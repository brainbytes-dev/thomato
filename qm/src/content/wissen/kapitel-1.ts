import type { WissenChapter } from "./types";

export const KAPITEL_1: WissenChapter = {
  slug: "1",
  number: "1",
  title: "Vorbereitung",
  summary: "Was Muss, Soll und Auswahl bedeuten und was in das Dossier gehört.",
  source: { source: "richtlinie", chapter: "Kap. 1", page: 5 },
  sections: [
    {
      id: "stufen",
      heading: "Muss, Soll und Auswahl",
      paragraphs: ["Jedes Kriterium trägt eine Stufe: Muss, Soll oder Auswahl. Einzelheiten: Richtlinie Kap. 1.1 bis 1.3, S. 5 und 6."],
      items: [
        "Muss: Voraussetzung für die Anerkennung",
        "Soll: Fortschritt in diese Richtung belegen",
        "Auswahl: Anzahl vorgegeben, Themen frei wählbar",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 1.1 und 1.2", page: 5 }],
    },
    {
      id: "auswahl",
      heading: "Auswahlpflicht in den Ergebniskriterien",
      paragraphs: ["Mindestens zu bearbeiten sind, jeweils für die erste Anerkennung und die Erneuerung:"],
      items: [
        "8.1 Prozessmonitoring: 2 von 5 Punkten, bei der Erneuerung 3 von 5",
        "8.2 Periodische Überprüfung: 1 Punkt, bei der Erneuerung ebenfalls 1",
        "8.4 Messdaten zu einer Indikatordiagnose: 1 Punkt, bei der Erneuerung 2",
      ],
      appNote:
        "Hinweis der App, kein Richtlinientext: Die App zählt 8.1, 8.2 und 8.4 derzeit nicht als Muss und zeigt sie als «nicht im Verfahren». Die Mindestanzahl wird abgebildet, sobald die Regel geklärt ist.",
      refs: [
        { source: "richtlinie", chapter: "Kap. 1.3", page: 6 },
        { source: "richtlinie", chapter: "Kap. 8", page: 19 },
      ],
    },
    {
      id: "dossier",
      heading: "Das Dossier",
      paragraphs: ["Zum Antrag gehört ein Dossier mit Grunddokumenten zu Ihrem Dienst und Belegen zu den Kriterien. Einzelheiten: Richtlinie Kap. 1.3, S. 6; Aufbau der Unterlagen: Handbuch Kap. 5.2, S. 13."],
      appNote: "In der App stehen die vier Unterlagen davor als «Dossier-Unterlagen» (5.2.1 bis 5.2.4) in der Kriterienliste, Quelle Handbuch 5.2.",
      refs: [
        { source: "richtlinie", chapter: "Kap. 1.3", page: 6 },
        { source: "handbuch", chapter: "Kap. 5.2", page: 13 },
      ],
    },
    {
      id: "sonderfaelle",
      heading: "Verbund und besondere Gegebenheiten",
      paragraphs: ["Möglich sind ein gemeinsamer Antrag mehrerer Dienste als regionaler Verbund und, auf Gesuch des Kantons, die Berücksichtigung besonderer regionaler Verhältnisse. Einzelheiten: Richtlinie Kap. 1, S. 5, und Kap. 1.3, S. 6."],
      refs: [
        { source: "richtlinie", chapter: "Kap. 1", page: 5 },
        { source: "richtlinie", chapter: "Kap. 1.3", page: 6 },
      ],
    },
    {
      id: "start",
      heading: "Organisatorischer Start",
      paragraphs: ["Im Betrieb trägt eine Person die Verantwortung für die Qualitätssicherung. Beratung durch die Geschäftsstelle und kostenpflichtige externe Unterstützung sind möglich; Einzelheiten: Richtlinie Kap. 1, S. 5."],
      refs: [{ source: "richtlinie", chapter: "Kap. 1", page: 5 }],
    },
  ],
  backLinks: [
    { label: "Zur Kriterienliste", href: "/criteria" },
    { label: "Zu den Dossier-Unterlagen (5.2.1)", href: "/criteria/5.2.1" },
  ],
};
