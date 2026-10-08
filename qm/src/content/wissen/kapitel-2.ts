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
      paragraphs: [
        "Die Geschäftsstelle und der Vorsitz der Fachgruppe entscheiden auf Grundlage des Expertenberichts. Die Experten selbst entscheiden nicht. Zum Bericht können Sie vorher Stellung nehmen.",
      ],
      items: [
        "Anerkennung erteilt",
        "Anerkennung mit Auflagen: Sie setzen diese innerhalb eines Jahres um, die Urkunde ist so lange befristet, und die Nachweise reichen Sie von sich aus ein",
        "Anerkennung nicht erteilt",
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
        { source: "handbuch", chapter: "Kap. 1.5 und 2.3", page: 8 },
      ],
    },
    {
      id: "besuch",
      heading: "Der Besuch",
      paragraphs: [
        "Zwei unabhängige Fachleute, vom IVR eingesetzt, kommen zu Ihnen: je eine Person aus präklinischer Notfallmedizin (Notarzt) und eine aus dem Rettungssanitätsdienst (HF). Sie dürfen nicht bei Ihnen gearbeitet haben und keinen Interessenkonflikt haben.",
        "Immer dabei ist eine Vertretung der Geschäftsstelle; die kantonale Behörde kann als Gast teilnehmen. Besprochen wird die Umsetzung der Kriterien mit ärztlicher Leitung, Leitung Rettungsdienst und Qualitätsverantwortlichen. Rechnen Sie mit einem Tag.",
      ],
      refs: [
        { source: "richtlinie", chapter: "Kap. 2.2", page: 7 },
        { source: "handbuch", chapter: "Kap. 2.3", page: 10 },
      ],
    },
    {
      id: "instanz",
      heading: "Zuständigkeit und Umfang",
      paragraphs: [
        "Der IVR wird als Anerkennungsinstanz für die Qualitätssicherung nach Art. 77 KVV tätig; fachlich zuständig ist die Fachgruppe Rettungs- und Patiententransportdienst.",
        "Die Anerkennung umfasst auch Sekundäreinsätze und Patiententransporte, sofern Sie diese im Verfahren und beim Besuch eindeutig angegeben haben.",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 2 und 2.1", page: 7 }],
    },
    {
      id: "kosten",
      heading: "Kosten",
      paragraphs: [
        "Das Verfahren ist gebührenpflichtig, die Prüfung von Auflagen kann zusätzlich kosten. Die Tarife veröffentlicht der IVR online.",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 2.4", page: 8 }],
    },
  ],
  backLinks: [
    { label: "Zu den Fristen in der Übersicht", href: DEADLINES_HREF },
    { label: "Zur Kriterienliste", href: "/criteria" },
  ],
};
