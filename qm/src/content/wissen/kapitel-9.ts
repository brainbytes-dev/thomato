import type { WissenChapter } from "./types";

export const KAPITEL_9: WissenChapter = {
  slug: "9",
  number: "9",
  title: "Anhang",
  summary: "Überblick über die Begriffe und Datensätze, auf die die Kriterien verweisen. Die Tabellen stehen nur im PDF.",
  source: { source: "richtlinie", chapter: "Kap. 9", page: 21 },
  sections: [
    {
      id: "einsaetze",
      heading: "Einsatzkategorien",
      paragraphs: [
        "P1 bis P3 betreffen die Erstversorgung am Einsatzort, S1 bis S4 medizinisch indizierte Verlegungen zwischen stationären Leistungserbringern. Innerhalb jeder Gruppe unterscheiden Dringlichkeit und Risiko. Die genauen Definitionen finden Sie im PDF.",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 9.1", page: 21 }],
    },
    {
      id: "personal",
      heading: "Personalkategorien",
      paragraphs: [
        "Das Personal ist in Kategorien von der diplomierten Rettungssanitäterin bis zum Fahrer eingeteilt. Der Anhang regelt auch, wie Personen in Ausbildung eingesetzt werden dürfen und welche Mindestbesetzung je Team gilt.",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 9.2", page: 21 }],
    },
    {
      id: "notarzt",
      heading: "Notarzt",
      paragraphs: [
        "Als Notarzt gilt, wer den entsprechenden Fähigkeitsausweis der Fachgesellschaft besitzt oder ihn gerade erwirbt. Für Dienstärzte gibt es eine Ausnahme, wenn ein kantonales oder regionales Programm sie einbindet.",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 9.3", page: 22 }],
    },
    {
      id: "fahrzeuge",
      heading: "Fahrzeuganforderungen",
      paragraphs: [
        "Die Anforderungen an Fahrzeuge stehen nicht im Anhang selbst. Er nennt die Bezugsquelle für die Normen und verweist für Auskünfte an die Geschäftsstelle.",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 9.4", page: 22 }],
    },
    {
      id: "basisdaten",
      heading: "Basisdatensatz",
      paragraphs: [
        "Der Basisdatensatz legt die Zeitpunkte fest, die für jeden Einsatz erfasst werden, von der Ereigniszeit über Notruf, Alarm und Eintreffen bis zur erneuten Einsatzbereitschaft. Er bildet die Grundlage für die Zeitauswertung.",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 9.5", page: 22 }],
    },
    {
      id: "ergaenzungsdaten",
      heading: "Ergänzungsdaten",
      paragraphs: [
        "Die Ergänzungsdaten beschreiben, was ein Einsatzprotokoll sonst enthalten soll: Auftrag, Angaben zur Person, medizinische Daten, Logistik und Übergabe. Im PDF ist je Block vermerkt, ob er Muss oder Soll ist.",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 9.6", page: 24 }],
    },
  ],
  backLinks: [{ label: "Zur Kriterienliste", href: "/criteria" }],
};
