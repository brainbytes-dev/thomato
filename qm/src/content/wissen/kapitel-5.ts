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
      paragraphs: ["Entscheidend ist, ob die Erneuerung bei Ablauf der Anerkennung begonnen hat. Einzelheiten: Richtlinie Kap. 5, S. 10."],
      items: [
        "sonst: Entzug, Meldung an die Behörden",
        "neuer Antrag: frühestens nach einem Jahr",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 5", page: 10 }],
    },
    {
      id: "berichte",
      heading: "Zusätzliche Unterlagen",
      paragraphs: ["Während der Geltung reichen Sie jährlich einen Qualitätsbericht ein; bei der Erneuerung ergänzen diese Berichte und eine kurze Vorher-nachher-Übersicht das Dossier. Einzelheiten: Richtlinie Kap. 5, S. 10, und Kriterium 7.1, S. 14."],
      refs: [
        { source: "richtlinie", chapter: "Kap. 5", page: 10 },
        { source: "richtlinie", chapter: "Kap. 7.1", page: 14 },
      ],
    },
    {
      id: "kreislauf",
      heading: "Schwerpunkt der Erneuerung",
      paragraphs: ["Im Vordergrund steht Ihre Entwicklung seit der letzten Anerkennung, einschliesslich nachgemessener Wirkung von Massnahmen. Was darzustellen ist: Richtlinie Kap. 5, S. 10."],
      refs: [{ source: "richtlinie", chapter: "Kap. 5", page: 10 }],
    },
  ],
  backLinks: [
    { label: "Zu den Fristen in der Übersicht", href: DEADLINES_HREF },
    { label: "Zu den Massnahmen", href: "/measures" },
    { label: "Zur Kriterienliste", href: "/criteria" },
  ],
};
