import type { WissenChapter } from "./types";

export const KAPITEL_2: WissenChapter = {
  slug: "2",
  number: "2",
  title: "Anerkennungsverfahren",
  summary: "Antrag, Prüfung, Expertenbesuch, Entscheid und Kosten in zeitlicher Reihenfolge.",
  source: { source: "richtlinie", chapter: "Kap. 2", page: 7 },
  sections: [
    {
      id: "ablauf",
      heading: "Ablauf und Fristen",
      paragraphs: [
        "Den Antrag stellen Sie elektronisch bei der Geschäftsstelle des IVR, sobald alle Muss-Kriterien, die verlangte Zahl gewählter Kriterien und ein vollständiges Dossier vorliegen. Die Geschäftsstelle prüft das Dossier innert eines Monats auf Vollständigkeit; fehlende Unterlagen sollten Sie innert drei Monaten nachliefern.",
        "Ist das Dossier vollständig, wird der Besuchstermin binnen höchstens drei Monaten abgemacht. Die kantonale Behörde wird gleichzeitig angefragt und kann einen Beobachter benennen. Die Unterlagen werden vertraulich behandelt.",
      ],
      refs: [
        { source: "handbuch", chapter: "Kap. 1.5", page: 8 },
        { source: "handbuch", chapter: "Kap. 2.3", page: 9 },
      ],
    },
    {
      id: "instanz",
      heading: "Wer anerkennt",
      paragraphs: [
        "Der IVR handelt als Anerkennungsinstanz im Rahmen der Qualitätssicherung nach der Krankenversicherungsverordnung. Fachlich zuständig ist die vom Vorstand eingesetzte Fachgruppe für Rettungs- und Patiententransportdienste.",
        "Ein anerkannter Dienst gilt auch für Sekundäreinsätze und Patiententransporte, wenn Sie diese Tätigkeit im Verfahren klar angegeben haben.",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 2.1", page: 7 }],
    },
    {
      id: "besuch",
      heading: "Der Besuch",
      paragraphs: [
        "Zwei unabhängige Fachleute des IVR, eine Notärztin oder ein Notarzt und eine Rettungssanitäterin oder ein Rettungssanitäter HF, besuchen Ihren Dienst. Sie dürfen weder bei Ihnen gearbeitet haben noch befangen sein. Dabei sind auch die Geschäftsstelle und, als Gast, die kantonale Behörde möglich.",
        "Geprüft wird, wie die Kriterien im Betrieb umgesetzt sind, im Gespräch mit ärztlicher Leitung, Leitung Rettungsdienst und Qualitätsverantwortlichen. Der Besuch dauert in der Regel einen Tag.",
      ],
      refs: [
        { source: "richtlinie", chapter: "Kap. 2.2", page: 7 },
        { source: "handbuch", chapter: "Kap. 2.3", page: 10 },
      ],
    },
    {
      id: "entscheid",
      heading: "Bericht und Entscheid",
      paragraphs: [
        "Die Experten entscheiden nicht selbst. Sie schreiben einen Bericht mit einer Empfehlung, den Sie vor dem Entscheid kommentieren dürfen. Entschieden wird durch die Geschäftsstelle gemeinsam mit dem Vorsitz der Fachgruppe.",
        "Möglich sind drei Ausgänge: Anerkennung, Anerkennung mit Auflagen oder Ablehnung. Bei Auflagen erfüllen Sie diese innerhalb eines Jahres und reichen die Nachweise ohne Aufforderung ein; die Urkunde gilt dann höchstens ein Jahr.",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 2.3", page: 8 }],
    },
    {
      id: "kosten",
      heading: "Kosten",
      paragraphs: [
        "Für das Verfahren fällt eine Gebühr an, die Prüfung von Auflagen kann zusätzlich kosten. Die aktuellen Tarife veröffentlicht der IVR auf seiner Website.",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 2.4", page: 8 }],
    },
  ],
  backLinks: [
    { label: "Zu den Fristen in der Übersicht", href: "/#deadlines-heading" },
    { label: "Zur Kriterienliste", href: "/criteria" },
  ],
};
