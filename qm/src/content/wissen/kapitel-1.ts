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
      paragraphs: ["Jedes Kriterium hat eine von drei Stufen. Strukturen allein genügen nicht, das Gewicht liegt auf Prozess und Ergebnis."],
      items: [
        "Muss: gilt ohne Ausnahme.",
        "Soll: Sie zeigen, dass Sie darauf hinarbeiten, und halten Ihre Aktivitäten fest.",
        "Auswahl: Sie suchen sich aus mehreren Vorschlägen die verlangte Anzahl selbst aus.",
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
      paragraphs: ["Für den Antrag legen Sie ein Dossier an. Es besteht aus fünf Teilen:"],
      items: [
        "Jahresberichte der letzten zwei Jahre mit Einsatzstatistik",
        "Nachweise und Erläuterungen je Kriterium",
        "kurze Vorstellung Ihres Dienstes",
        "Organigramm",
        "Bewilligung der zuständigen Behörde",
      ],
      appNote: "In der App stehen die vier Unterlagen davor als «Dossier-Unterlagen» (5.2.1 bis 5.2.4) in der Kriterienliste, Quelle Handbuch 5.2.",
      refs: [
        { source: "richtlinie", chapter: "Kap. 1.3", page: 6 },
        { source: "handbuch", chapter: "Kap. 5.2", page: 13 },
      ],
    },
    {
      id: "sonderfaelle",
      heading: "Verbund und besondere Gegebenheiten",
      paragraphs: [
        "Ein regionaler Verbund kann die Anerkennung gemeinsam beantragen, wenn alle zusammen die Anforderungen erfüllen. Besondere Umstände, etwa dünne Besiedlung oder schwierige Topografie, macht die kantonale Aufsicht schriftlich beim IVR-Vorstand geltend. Dafür brauchen Sie ein Qualitätskonzept und eine Begründung.",
      ],
      refs: [
        { source: "richtlinie", chapter: "Kap. 1", page: 5 },
        { source: "richtlinie", chapter: "Kap. 1.3", page: 6 },
      ],
    },
    {
      id: "start",
      heading: "Organisatorischer Start",
      paragraphs: [
        "Bestimmen Sie eine Person für die Qualität und holen Sie das Team früh ab: Qualität entsteht im Alltag. Die Geschäftsstelle des IVR berät auf Anfrage. Externe Beratung und ein Vor-Audit sind möglich und kostenpflichtig.",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 1", page: 5 }],
    },
  ],
  backLinks: [
    { label: "Zur Kriterienliste", href: "/criteria" },
    { label: "Zu den Dossier-Unterlagen (5.2.1)", href: "/criteria/5.2.1" },
  ],
};
