import type { WissenChapter } from "./types";

export const KAPITEL_5: WissenChapter = {
  slug: "5",
  number: "5",
  title: "Erneuerung der Anerkennung",
  summary: "Fristen für Antrag und Dossier, jährliche Berichte und der Qualitätskreislauf.",
  source: { source: "richtlinie", chapter: "Kap. 5", page: 10 },
  sections: [
    {
      id: "fristen",
      heading: "Die zwei Fristen",
      paragraphs: [
        "Der Erneuerungsantrag geht spätestens sechs Monate vor Ablauf der vier Jahre an die Geschäftsstelle. Das vollständige Dossier und ein vereinbarter Besuchstermin müssen spätestens vier Monate vor Ablauf vorliegen.",
        "Ist der Prozess nach Ablauf noch nicht gestartet, entzieht der IVR die Anerkennung und informiert die Behörde. Einen neuen Antrag können Sie dann frühestens nach einem Jahr stellen.",
      ],
    },
    {
      id: "berichte",
      heading: "Jährliche Berichte",
      paragraphs: [
        "Zwischen den Anerkennungen senden Sie jedes Jahr einen elektronischen Bericht zur Qualitätsentwicklung (Kriterium 7.1). Diese Berichte sind die Grundlage, mit der der IVR beurteilt, wie sich Ihr Dienst über die Jahre entwickelt hat.",
        "Zur Erneuerung kommt zu den Unterlagen aus Kapitel 1 eine kurze Beschreibung der Entwicklung hinzu: früher, jetzt.",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 5 und 7.1", page: 10 }],
    },
    {
      id: "kreislauf",
      heading: "Qualitätskreislauf mit erneuter Messung",
      paragraphs: [
        "Bei der Erneuerung zählt die Entwicklung. Der IVR schaut alle Punkte an, legt aber besonderes Gewicht auf Prozess und Ergebnis. Sichtbar sein muss der ganze Kreislauf: Eine zweite Messung zeigt, ob eine Korrekturmassnahme gewirkt hat.",
        "Darzustellen sind Prozesse und ihre Entwicklung, Erkenntnisse und Ziele der vier Jahre, offene Schwachstellen und die künftige Ausrichtung. Die Regeln für Vorbereitung, Verfahren und Rekurs gelten wie bei der ersten Anerkennung.",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 5", page: 10 }],
    },
  ],
  backLinks: [
    { label: "Zu den Fristen in der Übersicht", href: "/#deadlines-heading" },
    { label: "Zu den Massnahmen", href: "/measures" },
    { label: "Zur Kriterienliste", href: "/criteria" },
  ],
};
