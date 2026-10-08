import { BookOpen } from "lucide-react";
import type { SourceReference } from "@/domain/source-reference";

/** «Quelle: Richtlinie 08/2025, Kap. 7.3.10, S. 15» mit Link auf die Seite im offiziellen PDF. */
export function SourceLine({ reference }: { reference: SourceReference }) {
  return (
    <p className="type-meta flex flex-wrap items-center gap-x-2 gap-y-1 text-text-muted">
      <BookOpen aria-hidden="true" className="size-4 shrink-0" />
      <span>Quelle:</span>
      <a
        href={reference.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {reference.text}
        <span className="sr-only"> (öffnet das PDF in einem neuen Tab)</span>
      </a>
    </p>
  );
}
