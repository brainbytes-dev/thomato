import Link from "next/link";
import { Suspense } from "react";
import { listAssessments } from "@/domain/assessments";
import { requireOrgContextOrRedirect } from "@/domain/request-context";
import { ASSESSMENT_STATUSES } from "@/db/schema";
import { countByStatus, parseStatusFilter, type StatusFilter } from "@/domain/criteria-filter";
import { scopeLabel, STATUS_LABEL, STATUS_TONE } from "@/components/criteria/status-copy";

type SearchParams = Promise<{ status?: string | string[] }>;

function filterHref(filter: StatusFilter): string {
  return filter === "all" ? "/criteria" : `/criteria?status=${filter}`;
}

async function CriteriaTable({ searchParams }: { searchParams: SearchParams }) {
  const { status } = await searchParams;
  const filter = parseStatusFilter(status);
  const ctx = await requireOrgContextOrRedirect();
  const all = await listAssessments(ctx);
  const counts = countByStatus(all);
  const rows = filter === "all" ? all : all.filter((r) => r.status === filter);
  const filters: { value: StatusFilter; label: string; count: number }[] = [
    { value: "all", label: "Alle", count: all.length },
    ...ASSESSMENT_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s], count: counts[s] })),
  ];
  return (
    <>
      <nav aria-label="Filter nach Stand">
        <ul className="flex flex-wrap gap-2">
          {filters.map((f) => {
            const active = f.value === filter;
            return (
              <li key={f.value}>
                <Link
                  href={filterHref(f.value)}
                  aria-current={active ? "true" : undefined}
                  className={`inline-block rounded-[var(--radius)] border px-3 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    active ? "border-primary bg-surface-subtle font-semibold underline" : "border-border hover:bg-surface-subtle"
                  }`}
                >
                  {f.label} ({f.count})
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Kriterien mit Bewertungsstand</caption>
          <thead className="bg-surface-subtle text-text-muted">
            <tr>
              <th scope="col" className="whitespace-nowrap px-3 py-2">Nr.</th>
              <th scope="col" className="px-3 py-2">Titel</th>
              <th scope="col" className="px-3 py-2">Kapitel</th>
              <th scope="col" className="whitespace-nowrap px-3 py-2">Pflicht</th>
              <th scope="col" className="px-3 py-2">Stand</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t border-border">
                <td colSpan={5} className="px-3 py-4 text-text-muted">Keine Kriterien mit diesem Stand.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.criterionId} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-3 py-2 font-mono">
                    <Link
                      href={`/criteria/${r.number}`}
                      className="text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {r.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.title}</td>
                  <td className="px-3 py-2">{r.chapter}</td>
                  <td className="whitespace-nowrap px-3 py-2">{scopeLabel(r)}</td>
                  <td className="px-3 py-2">
                    <span className={`whitespace-nowrap font-medium ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    {r.status === "not_applicable" && r.notApplicableReason && (
                      <p className="mt-1 text-text-muted">Begründung: {r.notApplicableReason}</p>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function CriteriaPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Kriterien</h1>
      <Suspense fallback={<p className="text-text-muted">Kriterien werden geladen...</p>}>
        <CriteriaTable searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
