import { Suspense } from "react";
import { WissenOverview } from "@/components/wissen/overview";
import { WISSEN_DRAFT } from "@/content/wissen";
import { parseWissenQuery } from "@/domain/wissen-search";

type SearchParams = Promise<{ q?: string | string[] }>;

async function Overview({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams;
  return <WissenOverview query={parseWissenQuery(q)} draft={WISSEN_DRAFT} />;
}

export default function WissenPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main>
      <Suspense fallback={<p className="text-text-muted">Wissen wird geladen...</p>}>
        <Overview searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
