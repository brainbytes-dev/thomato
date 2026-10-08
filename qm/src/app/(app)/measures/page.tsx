import { Suspense } from "react";
import { MeasuresRegister } from "@/components/measures/measures-register";
import { parseMeasureStatusFilter, parseOwnerFilter, parseQuery } from "@/domain/measure-filter";
import { listAllMeasures, listOrgMembers } from "@/domain/measures";
import { requireOrgContextOrRedirect } from "@/domain/request-context";

type SearchParams = Promise<{ status?: string | string[]; owner?: string | string[]; q?: string | string[] }>;

async function Register({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const ctx = await requireOrgContextOrRedirect();
  const [rows, members] = await Promise.all([listAllMeasures(ctx, new Date()), listOrgMembers(ctx)]);
  const filters = {
    status: parseMeasureStatusFilter(params.status),
    owner: parseOwnerFilter(params.owner, members),
    query: parseQuery(params.q),
  };
  return <MeasuresRegister rows={rows} members={members} filters={filters} />;
}

export default function MeasuresPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="type-headline-section">Massnahmen</h1>
        <p className="max-w-[72ch] text-text-muted">
          Alle Massnahmen der Organisation über sämtliche Kriterien. Anlegen und Bearbeiten erfolgt auf der Seite des jeweiligen Kriteriums.
        </p>
      </div>
      <Suspense fallback={<p className="text-text-muted">Massnahmen werden geladen...</p>}>
        <Register searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
