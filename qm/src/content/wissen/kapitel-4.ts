import type { WissenChapter } from "./types";

export const KAPITEL_4: WissenChapter = {
  slug: "4",
  number: "4",
  title: "Nach dem Verfahren",
  summary: "Wie lange die Anerkennung gilt und was danach gilt.",
  source: { source: "richtlinie", chapter: "Kap. 4", page: 9 },
  sections: [
    {
      id: "dauer",
      heading: "Wie lange die Anerkennung läuft",
      paragraphs: [
        "Eine Anerkennung dauert höchstens vier Jahre, gerechnet ab dem Ausstellungsdatum der Urkunde. Den Erneuerungsantrag reichen Sie schriftlich bei der Geschäftsstelle ein, spätestens ein halbes Jahr vor dem Ende.",
        "Fehlen bei Auflagen die Nachweise oder werden die Bestimmungen nicht eingehalten, entzieht der IVR die Anerkennung. Er informiert dann die Behörden und passt die Liste der anerkannten Dienste an. Auch das Recht, die Bezeichnung und das Q-Label an den Fahrzeugen zu führen, entfällt.",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 4.1", page: 9 }],
    },
    {
      id: "pflichten",
      heading: "Pflichten während der Geltung",
      paragraphs: [
        "Das Handbuch nennt als Gegenstück die Pflichten: Qualität laufend verbessern, Veränderungen, die die Einhaltung gefährden könnten, sofort melden und verlangte Nachweise fristgerecht liefern. Ein angekündigter Kontrollbesuch ist möglich.",
      ],
      refs: [{ source: "handbuch", chapter: "Kap. 4.1", page: 12 }],
    },
  ],
  backLinks: [{ label: "Zu den Fristen in der Übersicht", href: "/#deadlines-heading" }],
};
