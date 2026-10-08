import { DEADLINES_HREF } from "./config";
import type { WissenChapter } from "./types";

export const KAPITEL_4: WissenChapter = {
  slug: "4",
  number: "4",
  title: "Nach dem Verfahren",
  summary: "Wie lange die Anerkennung gilt und wann sie entfällt.",
  source: { source: "richtlinie", chapter: "Kap. 4", page: 9 },
  sections: [
    {
      id: "dauer",
      heading: "Wie lange die Anerkennung läuft",
      paragraphs: [
        "Eine Anerkennung dauert höchstens vier Jahre ab dem Datum der Urkunde. Wie Sie sie verlängern, steht in Kapitel 5.",
        "Sie entfällt, wenn Auflagen nicht nachgewiesen oder die Bestimmungen nicht eingehalten werden. Dann gilt:",
      ],
      items: [
        "Die zuständigen Behörden werden informiert.",
        "Der Dienst wird aus der Liste anerkannter Dienste genommen.",
        "Bezeichnung und Q-Label an den Fahrzeugen dürfen nicht mehr geführt werden.",
      ],
      refs: [{ source: "richtlinie", chapter: "Kap. 4.1", page: 9 }],
    },
    {
      id: "pflichten",
      heading: "Pflichten während der Geltung",
      paragraphs: [
        "Laut Handbuch müssen Sie die Qualität laufend verbessern, Veränderungen, die die Einhaltung gefährden könnten, sofort melden und verlangte Nachweise fristgerecht liefern. Ein angekündigter Kontrollbesuch ist möglich.",
      ],
      refs: [{ source: "handbuch", chapter: "Kap. 4.1", page: 12 }],
    },
  ],
  backLinks: [{ label: "Zu den Fristen in der Übersicht", href: DEADLINES_HREF }],
};
