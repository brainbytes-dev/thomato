import { notFound } from "next/navigation";
import { ChapterView } from "@/components/wissen/chapter-view";
import { WISSEN_CHAPTERS, WISSEN_DRAFT, wissenChapterBySlug } from "@/content/wissen";

export function generateStaticParams() {
  return WISSEN_CHAPTERS.map((c) => ({ kapitel: c.slug }));
}

export default async function WissenChapterPage({ params }: { params: Promise<{ kapitel: string }> }) {
  const { kapitel } = await params;
  const chapter = wissenChapterBySlug(kapitel);
  if (!chapter) notFound();
  return (
    <main>
      <ChapterView chapter={chapter} draft={WISSEN_DRAFT} />
    </main>
  );
}
