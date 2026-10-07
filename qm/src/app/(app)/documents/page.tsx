import Link from "next/link";
import { Suspense } from "react";
import { EVIDENCE_LABEL, EVIDENCE_TONE } from "@/components/criteria/status-copy";
import { formatDate } from "@/domain/dates";
import { listDocuments } from "@/domain/documents";
import { requireOrgContextOrRedirect } from "@/domain/request-context";

const TH = "whitespace-nowrap px-3 py-2";
const TD = "px-3 py-2 align-top";

async function Documents() {
  const ctx = await requireOrgContextOrRedirect();
  const now = new Date();
  const rows = await listDocuments(ctx, now);
  return (
    <>
      <header>
        <h1 className="text-xl font-semibold">Dokumente</h1>
        <p className="max-w-3xl text-text-muted">
          Hochgeladen wird auf der Seite des jeweiligen Kriteriums. Ein Dokument ändert nie die Bewertung.
        </p>
      </header>
      {rows.length === 0 ? (
        <p className="text-text-muted">Es sind noch keine Dokumente vorhanden.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Alle Dokumente der Organisation</caption>
            <thead className="bg-surface-subtle text-text-muted">
              <tr>
                <th scope="col" className={TH}>Titel</th>
                <th scope="col" className={TH}>Aktuelle Version</th>
                <th scope="col" className={TH}>Gültig bis</th>
                <th scope="col" className={TH}>Zustand</th>
                <th scope="col" className={TH}>Versionen</th>
                <th scope="col" className={TH}>Kriterien</th>
                <th scope="col" className={TH}>Download</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.documentId} className="border-t border-border">
                  <th scope="row" className={`${TD} font-medium`}>{r.title}</th>
                  <td className={TD}>V{r.latest.versionNumber}, {r.latest.fileName}</td>
                  <td className={`${TD} whitespace-nowrap`}>{r.latest.validUntil ? formatDate(r.latest.validUntil) : "ohne Ablaufdatum"}</td>
                  <td className={`${TD} whitespace-nowrap font-medium ${EVIDENCE_TONE[r.state]}`}>{EVIDENCE_LABEL[r.state]}</td>
                  <td className={TD}>{r.versionCount}</td>
                  <td className={TD}>
                    {r.criteria.length === 0 ? (
                      <span className="text-text-muted">nicht verknüpft</span>
                    ) : (
                      <span className="flex flex-wrap gap-x-3">
                        {r.criteria.map((n) => (
                          <Link key={n} href={`/criteria/${encodeURIComponent(n)}`} className="font-mono text-primary underline">
                            {n}
                          </Link>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>
                    <a
                      href={`/documents/versions/${r.latest.id}`}
                      aria-label={`${r.title}, V${r.latest.versionNumber} herunterladen`}
                      className="text-primary underline"
                    >
                      Herunterladen
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function DocumentsPage() {
  return (
    <main className="flex flex-col gap-6">
      <Suspense fallback={<p className="text-text-muted">Dokumente werden geladen...</p>}>
        <Documents />
      </Suspense>
    </main>
  );
}
