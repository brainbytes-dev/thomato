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
      paragraphs: [
        "Gegen einen Entscheid über die Anerkennung oder deren Erneuerung können Sie Rekurs einlegen. Die Frist beträgt 30 Tage ab Zustellung. Die Eingabe richten Sie schriftlich und begründet an den Vorstand des IVR.",
        "Das Verfahren regelt ein eigenes Reglement des IVR über die Rechtspflege in Anerkennungsverfahren. Halten Sie das Zustelldatum fest, denn ab da läuft die Frist.",
      ],
    },
  ],
  backLinks: [{ label: "Zur Übersicht mit den Fristen", href: "/#deadlines-heading" }],
};
