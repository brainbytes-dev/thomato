import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { SourceLine } from "@/components/criteria/source-line";
import { SECTION_CARD } from "@/components/ui/styles";
import type { WissenChapter } from "@/content/wissen";
import { Disclaimer, DraftMarker } from "./disclaimer";
import { referenceFor } from "./refs";
import { LINK } from "./styles";

export function ChapterView({ chapter, draft }: { chapter: WissenChapter; draft: boolean }) {
  const multi = chapter.sections.length > 1;
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <p className="type-eyebrow text-text-muted">
          <Link href="/wissen" className={LINK}>Wissen</Link>
          {" / Kapitel "}
          {chapter.number}
        </p>
        <h1 className="type-headline-section">{chapter.slug === "kriterien" ? chapter.title : `${chapter.number} ${chapter.title}`}</h1>
        <p className="max-w-[70ch] text-text-muted">{chapter.summary}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <DraftMarker draft={draft} />
          <Disclaimer />
        </div>
        <SourceLine reference={referenceFor(chapter.source)} />
      </header>

      {chapter.slug === "kriterien" && (
        <Link
          href="/criteria"
          className="type-label flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-5 text-primary hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:p-6"
        >
          <span>Zur Kriterienliste mit Bewertung, Nachweisen und Massnahmen</span>
          <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
        </Link>
      )}

      <div className="flex flex-col gap-4">
        {chapter.sections.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`} className={`${SECTION_CARD} scroll-mt-20`}>
            <h2 id={`${s.id}-heading`} className="type-headline-sub">{s.heading}</h2>
            {s.paragraphs.map((p) => (
              <p key={p} className="max-w-[70ch]">{p}</p>
            ))}
            {s.appNote && (
              <p className="type-meta flex max-w-[70ch] items-start gap-2 rounded-lg border border-border bg-surface-subtle p-3 text-text">
                <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{s.appNote}</span>
              </p>
            )}
            {s.refs && s.refs.length > 0 && (
              <ul className="type-meta flex flex-col gap-1 text-text-muted" aria-label={multi ? `Quellen zu ${s.heading}` : "Weitere Quellen"}>
                {s.refs.map((r) => {
                  const ref = referenceFor(r);
                  return (
                    <li key={ref.href}>
                      Quelle:{" "}
                      <a href={ref.href} target="_blank" rel="noopener noreferrer" className={LINK}>
                        {ref.text}
                        <span className="sr-only"> (öffnet das PDF in einem neuen Tab)</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>

      <nav aria-label="Weiter in der App" className="flex flex-col gap-2">
        <h2 className="type-eyebrow text-text-muted">In der App</h2>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {chapter.backLinks.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className={`type-label inline-flex items-center gap-2 ${LINK}`}>
                {l.label}
                <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  );
}
