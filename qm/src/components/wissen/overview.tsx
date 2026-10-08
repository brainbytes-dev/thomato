import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CARD } from "@/components/ui/badge";
import { chapterLabel, WISSEN_CHAPTERS, type WissenChapter } from "@/content/wissen";
import { searchWissen, type WissenHit } from "@/domain/wissen-search";
import { Disclaimer, DraftMarker } from "./disclaimer";
import { SearchForm } from "./search-form";
import { LINK } from "./styles";

function snippet(text: string): string {
  const chars = [...text];
  return chars.length <= 160 ? text : `${chars.slice(0, 160).join("").trimEnd()}...`;
}

function ChapterRow({ chapter }: { chapter: WissenChapter }) {
  return (
    <li>
      <Link
        href={`/wissen/${chapter.slug}`}
        className="flex items-start gap-4 px-4 py-4 hover:bg-surface-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:px-5"
      >
        <span className="type-meta-mono w-14 shrink-0 pt-0.5 text-text-muted">{chapter.number}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="type-body-emphasis">{chapter.title}</span>
          <span className="type-meta max-w-[70ch] text-text-muted">{chapter.summary}</span>
        </span>
        <ArrowRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-text-muted" />
      </Link>
    </li>
  );
}

function Results({ query, hits }: { query: string; hits: WissenHit[] }) {
  if (hits.length === 0) {
    return (
      <div className={`${CARD} flex flex-col gap-2 p-5 sm:p-6`} role="status">
        <p className="type-body-emphasis">Keine Treffer für «{query}».</p>
        <p className="text-text-muted">
          Die Suche umfasst nur die Zusammenfassungen in der App, nicht die Richtlinie selbst. Versuchen Sie einen kürzeren Begriff oder{" "}
          <Link href="/wissen" className={LINK}>zeigen Sie alle Kapitel an</Link>.
        </p>
      </div>
    );
  }
  return (
    <section aria-labelledby="results-heading" className={`${CARD} overflow-hidden`}>
      <h2 id="results-heading" className="type-eyebrow border-b border-border px-4 py-3 text-text-muted sm:px-5">
        {hits.length === 1 ? "1 Kapitel" : `${hits.length} Kapitel`} mit Treffern für «{query}»
      </h2>
      <ul className="divide-y divide-border">
        {hits.map((h) => (
          <li key={h.chapter.slug} className="flex flex-col gap-2 px-4 py-4 sm:px-5">
            <Link href={`/wissen/${h.chapter.slug}`} className={`type-body-emphasis self-start ${LINK}`}>
              {chapterLabel(h.chapter)}
            </Link>
            {h.sections.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {h.sections.map((s) => (
                  <li key={s.id} className="type-meta flex flex-col gap-0.5">
                    <Link href={`/wissen/${h.chapter.slug}#${s.id}`} className={`type-label self-start ${LINK}`}>{s.heading}</Link>
                    <span className="max-w-[70ch] text-text-muted">{snippet(s.paragraphs[0] ?? "")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="type-meta max-w-[70ch] text-text-muted">{h.chapter.summary}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function WissenOverview({ query, draft }: { query: string; draft: boolean }) {
  const searching = query !== "";
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="type-headline-section">Wissen</h1>
        <p className="max-w-[70ch] text-text-muted">
          Kurze Zusammenfassungen zum Verfahren: Vorbereitung, Anerkennung, Rekurs, Erneuerung und Anhang. Jede Seite nennt Kapitel und Seite im PDF.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <DraftMarker draft={draft} />
          <Disclaimer />
        </div>
      </header>
      <SearchForm query={query} />
      {searching ? (
        <Results query={query} hits={searchWissen(query)} />
      ) : (
        <>
          <section aria-labelledby="chapters-heading" className={`${CARD} overflow-hidden`}>
            <h2 id="chapters-heading" className="type-eyebrow border-b border-border px-4 py-3 text-text-muted sm:px-5">
              Kapitel der Richtlinie
            </h2>
            <ol className="divide-y divide-border">
              {WISSEN_CHAPTERS.map((c) => (
                <ChapterRow key={c.slug} chapter={c} />
              ))}
            </ol>
          </section>
          <p className="type-meta max-w-[70ch] text-text-muted">
            Zur Nummerierung: Wissen deckt die Kapitel 1 bis 5 und den Anhang 9 ab. Die Kapitel 6 bis 8 sind die Kriterien und stehen in der{" "}
            <Link href="/criteria" className={LINK}>Kriterienliste</Link>.
          </p>
        </>
      )}
    </div>
  );
}
