import { DEADLINES_HREF } from "./config";
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
      paragraphs: ["Gerechnet wird rückwärts vom Ablauf der vier Jahre:"],
      items: [
        "6 Monate vorher: Erneuerungsantrag bei der Geschäftsstelle",
        "4 Monate vorher: vollständiges Dossier eingereicht und Besuchstermin vereinbart",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 5", page: 10 }],
    },
    {
      id: "ablauf-ohne-start",
      heading: "Wenn die Frist verstreicht",
      paragraphs: [
        "Haben Sie nach Ablauf noch nicht begonnen, erlischt die Anerkennung durch Entzug und die Behörden erfahren davon. Ein neues Verfahren können Sie dann erst nach einem Jahr beantragen.",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 5", page: 10 }],
    },
    {
      id: "berichte",
      heading: "Zusätzliche Unterlagen",
      paragraphs: [
        "Zwischen den Anerkennungen senden Sie jährlich einen elektronischen Bericht zur Qualitätsentwicklung. Für die Erneuerung kommen zu den Dossierunterlagen aus Kapitel 1 zwei Dokumente dazu:",
      ],
      items: [
        "die jährlichen Qualitätsberichte (Kriterium 7.1)",
        "eine knappe Gegenüberstellung: früher und heute",
      ],
      refs: [
        { source: "richtlinie", chapter: "Kap. 5", page: 10 },
        { source: "richtlinie", chapter: "Kap. 7.1", page: 14 },
      ],
    },
    {
      id: "kreislauf",
      heading: "Qualitätskreislauf mit erneuter Messung",
      paragraphs: [
        "Zeigen Sie, was sich in vier Jahren verbessert hat, was noch offen ist und wohin Sie wollen. Eine zweite Messung muss belegen, dass eine Korrekturmassnahme gewirkt hat.",
        "Geprüft werden alle Punkte, am stärksten Prozess und Ergebnis. Vorbereitung, Verfahren und Rekurs laufen wie bei der ersten Anerkennung.",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 5", page: 10 }],
    },
  ],
  backLinks: [
    { label: "Zu den Fristen in der Übersicht", href: DEADLINES_HREF },
    { label: "Zu den Massnahmen", href: "/measures" },
    { label: "Zur Kriterienliste", href: "/criteria" },
  ],
};
