import Link from "next/link";
import { KNOWLEDGE_AREA_READY, KNOWLEDGE_CRITERIA_HREF } from "@/domain/knowledge-area";

const ITEMS = [
  { term: "Muss", text: "Pflicht im Verfahren." },
  { term: "Soll", text: "Empfohlen, zählt nicht als Pflicht." },
  { term: "Auswahl", text: "Aus den Vorschlägen ist eine Mindestanzahl zu wählen (8.1, 8.2, 8.4)." },
] as const;

/** Erklärt die Pflichtstufen der Liste. Die Auswahlpflicht wird im Bereich Wissen erläutert. */
export function CriteriaLegend() {
  return (
    <section aria-labelledby="legend-heading" className="flex flex-col gap-2">
      <h2 id="legend-heading" className="type-eyebrow text-text-muted">Legende</h2>
      <dl className="type-meta grid gap-x-6 gap-y-1 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
        {ITEMS.map((i) => (
          <div key={i.term} className="flex flex-col">
            <dt className="type-label">{i.term}</dt>
            <dd className="max-w-[40ch] text-text-muted">{i.text}</dd>
          </div>
        ))}
      </dl>
      <p className="type-meta text-text-muted">
        Die Auswahlpflicht wird im Bereich Wissen erklärt.
        {KNOWLEDGE_AREA_READY && (
          <>
            {" "}
            <Link
              href={KNOWLEDGE_CRITERIA_HREF}
              className="text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Zu Kapitel 1
            </Link>
          </>
        )}
      </p>
    </section>
  );
}
