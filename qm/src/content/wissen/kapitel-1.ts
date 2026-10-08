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
      paragraphs: [
        "Jedes Kriterium trägt eine von drei Stufen. Bei einem Muss gibt es keinen Spielraum: Der Dienst erfüllt es. Bei einem Soll genügt es, wenn der Dienst erkennbar in diese Richtung arbeitet und seine Bemühungen festhält. Bei einer Auswahl wählt der Dienst aus einem Angebot von Vorschlägen selbst aus, womit er sich befasst.",
        "Die Kriterienliste ist in Struktur, Prozess und Ergebnis gegliedert. Die IVR-Vorgaben gewichten Prozess und Ergebnis stärker, gute Strukturen allein genügen nicht.",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 1.1 und 1.2", page: 5 }],
    },
    {
      id: "auswahl",
      heading: "Auswahlpflicht in den Ergebniskriterien",
      paragraphs: [
        "Die Auswahl betrifft Kapitel 8: Beim Prozessmonitoring (8.1) wählen Sie zwei von fünf Punkten für die erste Anerkennung und drei von fünf für die Erneuerung. Bei der periodischen Überprüfung (8.2) ist mindestens ein Punkt zu bearbeiten. Bei den Messdaten zu einer Indikatordiagnose (8.4) ist es einer, bei der Erneuerung zwei.",
        "Der Vorteil für Ihren Dienst: Sie können in jedem Zeitabschnitt andere Fragestellungen untersuchen.",
      ],
      appNote:
        "Hinweis der App, kein Richtlinientext: Die App zählt 8.1, 8.2 und 8.4 derzeit nicht als Muss und zeigt sie als «nicht im Verfahren». Die Mindestanzahl wird erst nach Rückmeldung des IVR abgebildet.",
      refs: [{ source: "richtlinie", chapter: "Kap. 1.3", page: 6 }],
    },
    {
      id: "dossier",
      heading: "Das Dossier",
      paragraphs: [
        "Für den Antrag stellen Sie ein Dossier zusammen. Es enthält die Jahresberichte der letzten zwei Jahre mit Einsatzstatistik, eine kurze Vorstellung Ihres Dienstes, das Organigramm und die Bewilligung der zuständigen kantonalen Behörde. Dazu kommen Ausführungen und Belege zu den einzelnen Kriterien.",
        "In der App heissen die ersten vier Punkte «Dossier-Unterlagen» (5.2.1 bis 5.2.4) und stehen mit der Quelle Handbuch 5.2 in der Kriterienliste.",
      ],
      refs: [
        { source: "richtlinie", chapter: "Kap. 1.3", page: 6 },
        { source: "handbuch", chapter: "Kap. 5.2", page: 13 },
      ],
    },
    {
      id: "sonderfaelle",
      heading: "Verbund und besondere Gegebenheiten",
      paragraphs: [
        "Mehrere Rettungsdienste können die Anerkennung gemeinsam beantragen, wenn sie die Anforderungen zusammen erfüllen. Ausserdem kann die kantonale Aufsicht beim Vorstand des IVR schriftlich beantragen, dass besondere Umstände (kleine Bevölkerungszahl, schwierige Topografie) berücksichtigt werden. Das setzt ein Qualitätssicherungskonzept und eine nachvollziehbare Begründung voraus.",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 1 und 1.3", page: 5 }],
    },
    {
      id: "start",
      heading: "Organisatorischer Start",
      paragraphs: [
        "Ohne den Willen der Leitung und eine Person, die für Qualität zuständig ist, kommt kein Verfahren in Gang. Beziehen Sie das Team früh ein, denn die Vorgaben müssen im Alltag gelebt werden. Auf Anfrage berät die Geschäftsstelle des IVR; ein Vor-Audit oder externe Beratung ist möglich, kostet aber zusätzlich.",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 1", page: 5 }],
    },
  ],
  backLinks: [
    { label: "Zur Kriterienliste", href: "/criteria" },
    { label: "Zu den Dossier-Unterlagen (5.2.1)", href: "/criteria/5.2.1" },
  ],
};
