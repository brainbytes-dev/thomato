import { DEADLINES_HREF } from "./config";
import type { WissenChapter } from "./types";

export const KAPITEL_3: WissenChapter = {
  slug: "3",
  number: "3",
  title: "Rekurs",
  summary: "Wie und binnen welcher Frist Sie einen Entscheid anfechten.",
  source: { source: "richtlinie", chapter: "Kap. 3", page: 9 },
  sections: [
    {
      id: "rekurs",
      heading: "Entscheid anfechten",
      paragraphs: ["Ein Rekurs ist gegen Anerkennungs- und Erneuerungsentscheide möglich."],
      items: [
        "Frist: 30 Tage ab Zustellung des Entscheids",
        "Form: schriftlich und begründet",
        "Adressat: Vorstand des IVR",
        "Verfahren: nach dem Reglement des IVR über die Rechtspflege in Anerkennungsverfahren",
      ],
      appNote: "Hinweis der App, kein Richtlinientext: Halten Sie das Zustelldatum fest, denn ab da läuft die Frist.",
    },
  ],
  backLinks: [{ label: "Zur Übersicht mit den Fristen", href: DEADLINES_HREF }],
};
