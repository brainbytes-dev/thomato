import { DEADLINES_HREF } from "./config";
import type { WissenChapter } from "./types";

export const KAPITEL_2: WissenChapter = {
  slug: "2",
  number: "2",
  title: "Anerkennungsverfahren",
  summary: "Mögliche Ergebnisse, Fristen, Expertenbesuch und Kosten auf einen Blick.",
  source: { source: "richtlinie", chapter: "Kap. 2", page: 7 },
  sections: [
    {
      id: "entscheid",
      heading: "Mögliche Ergebnisse",
      paragraphs: ["Über die Anerkennung befinden Geschäftsstelle und Fachgruppenvorsitz, gestützt auf den Expertenbericht, zu dem Sie vorher Stellung nehmen können. Einzelheiten: Richtlinie Kap. 2.3, S. 8."],
      items: [
        "ja",
        "ja, mit Auflagen und einer Urkunde für höchstens ein Jahr",
        "nein",
      ],
      refs: [
        { source: "richtlinie", chapter: "Kap. 2.3", page: 8 },
        { source: "handbuch", chapter: "Kap. 2.5 und 2.6", page: 11 },
      ],
    },
    {
      id: "ablauf",
      heading: "Wichtige Fristen",
      paragraphs: ["Beantragt wird elektronisch bei der Geschäftsstelle, sobald Muss-Kriterien, Auswahlkriterien und Dossier vollständig sind."],
      items: [
        "Vollständigkeitsprüfung des Dossiers: innert 1 Monat",
        "Fehlende Unterlagen nachreichen: innert 3 Monaten",
        "Besuchstermin vereinbaren: innert längstens 3 Monaten, nachdem das Dossier als vollständig gilt",
        "Kanton: wird gleichzeitig angefragt und kann einen Beobachter benennen",
      ],
      refs: [
        { source: "richtlinie", chapter: "Kap. 2", page: 7 },
        { source: "handbuch", chapter: "Kap. 1.5", page: 8 },
        { source: "handbuch", chapter: "Kap. 2.3", page: 9 },
      ],
    },
    {
      id: "besuch",
      heading: "Der Besuch",
      paragraphs: ["Ein Besuchstag vor Ort mit zwei unabhängigen Fachexperten (Notarzt und Rettungssanitäter HF) sowie der Geschäftsstelle; der Kanton kann teilnehmen. Einzelheiten: Richtlinie Kap. 2.2, S. 7; Ablauf des Tages: Handbuch Kap. 2.2 und 2.3, S. 9 und 10."],
      refs: [
        { source: "handbuch", chapter: "Kap. 2.2", page: 9 },
        { source: "richtlinie", chapter: "Kap. 2.2", page: 7 },
        { source: "handbuch", chapter: "Kap. 2.3", page: 10 },
      ],
    },
    {
      id: "instanz",
      heading: "Zuständigkeit und Umfang",
      paragraphs: ["Der IVR anerkennt im Rahmen von Art. 77 KVV. Ob Sekundäreinsätze und Patiententransporte mit abgedeckt sind, hängt von Ihren Angaben im Verfahren ab; Einzelheiten: Richtlinie Kap. 2 und 2.1, S. 7."],
      refs: [{ source: "richtlinie", chapter: "Kap. 2 und 2.1", page: 7 }],
    },
    {
      id: "kosten",
      heading: "Kosten",
      paragraphs: ["Gebührenpflichtig, Tarife auf der IVR-Website. Einzelheiten: Richtlinie Kap. 2.4, S. 8."],
      refs: [{ source: "richtlinie", chapter: "Kap. 2.4", page: 8 }],
    },
  ],
  backLinks: [
    { label: "Zu den Fristen in der Übersicht", href: DEADLINES_HREF },
    { label: "Zur Kriterienliste", href: "/criteria" },
  ],
};
