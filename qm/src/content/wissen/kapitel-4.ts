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
      paragraphs: ["Gültig höchstens vier Jahre ab Urkundendatum; zur Verlängerung siehe Kapitel 5. Wann der IVR die Anerkennung entzieht und welche Folgen das hat: Richtlinie Kap. 4.1, S. 9."],
      refs: [{ source: "richtlinie", chapter: "Kap. 4.1", page: 9 }],
    },
    {
      id: "pflichten",
      heading: "Pflichten während der Geltung",
      paragraphs: ["Auch nach dem Entscheid bestehen Pflichten, etwa Änderungen zu melden; der IVR kann einen Kontrollbesuch ansetzen. Einzelheiten: Handbuch Kap. 4.1, S. 12."],
      refs: [{ source: "handbuch", chapter: "Kap. 4.1", page: 12 }],
    },
  ],
  backLinks: [{ label: "Zu den Fristen in der Übersicht", href: DEADLINES_HREF }],
};
