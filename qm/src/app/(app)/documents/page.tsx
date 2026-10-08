import Link from "next/link";
import { Suspense } from "react";
import { EVIDENCE_BADGE, EVIDENCE_LABEL } from "@/components/criteria/status-copy";
import { Badge, CARD } from "@/components/ui/badge";
import { TABLE_WRAP, TD, TH } from "@/components/ui/styles";
import { formatDate } from "@/domain/dates";
import { listDocuments } from "@/domain/documents";
import { requireOrgContextOrRedirect } from "@/domain/request-context";

async function Documents() {
  const ctx = await requireOrgContextOrRedirect();
  const now = new Date();
  const rows = await listDocuments(ctx, now);
  return (
    <>
      <header>
        <h1 className="type-headline-section">Dokumente</h1>
        <p className="mt-1 max-w-[70ch] text-text-muted">
          Dokumente laden Sie auf der Seite des jeweiligen Kriteriums hoch. Ein Dokument ändert die Bewertung nie.
        </p>
      </header>
      {rows.length === 0 ? (
        <p className={`${CARD} p-6 text-text-muted`}>Es sind noch keine Dokumente vorhanden.</p>
      ) : (
        <div className={`${CARD} p-3 sm:p-4`}>
        <div className={TABLE_WRAP}>
          <table className="w-full min-w-[900px] border-collapse text-left">
            <caption className="sr-only">Alle Dokumente der Organisation</caption>
            <thead className="bg-surface-subtle">
              <tr>
                <th scope="col" className={TH}>Titel</th>
                <th scope="col" className={TH}>Aktuelle Version</th>
                <th scope="col" className={TH}>Gültig bis</th>
                <th scope="col" className={TH}>Nachweis</th>
                <th scope="col" className={TH}>Versionen</th>
                <th scope="col" className={TH}>Kriterien</th>
                <th scope="col" className={TH}>Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.documentId} className="hover:bg-surface-subtle">
                  <th scope="row" className={`${TD} font-medium`}>{r.title}</th>
                  <td className={TD}>V{r.latest.versionNumber}, {r.latest.fileName}</td>
                  <td className={`${TD} whitespace-nowrap`}>{r.latest.validUntil ? formatDate(r.latest.validUntil) : "ohne Ablaufdatum"}</td>
                  <td className={`${TD} whitespace-nowrap`}><Badge tone={EVIDENCE_BADGE[r.state]}>{EVIDENCE_LABEL[r.state]}</Badge></td>
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
