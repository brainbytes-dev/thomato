import type { WissenRef } from "@/content/wissen";
import { SOURCES, sourcePageUrl } from "@/domain/sources";
import type { SourceReference } from "@/domain/source-reference";

/** Quellenangabe aus der Registry: Ausgabe, Kapitel, Seite und Link `...pdf#page=N`. */
export function referenceFor(ref: WissenRef): SourceReference {
  return {
    sourceId: ref.source,
    text: `${SOURCES[ref.source].shortLabel}, ${ref.chapter}, S. ${ref.page}`,
    page: ref.page,
    href: sourcePageUrl(ref.source, ref.page),
  };
}
