import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { STATUS_LABEL, STATUS_TONE, scopeLabel } from "@/components/criteria/status-copy";
import { ASSESSMENT_STATUSES } from "@/db/schema";
import { getAssessmentByNumber, listCriterionHistory } from "@/domain/assessments";
import { describeAuditEvent } from "@/domain/audit-copy";
import { formatDate, formatDateTime } from "@/domain/dates";
import { requireOrgContextOrRedirect } from "@/domain/request-context";
import { can } from "@/domain/rights";
import { AssessmentForm } from "./assessment-form";

async function Detail({ params }: { params: Promise<{ number: string }> }) {
  const { number: raw } = await params;
  const number = decodeURIComponent(raw);
  const ctx = await requireOrgContextOrRedirect();
  const detail = await getAssessmentByNumber(ctx, number);
  if (!detail) notFound();
  const canWrite = can(ctx.role, "assessment", "write");
  const history =
    can(ctx.role, "audit", "read") && detail.assessmentId
      ? await listCriterionHistory(ctx, detail.assessmentId)
      : null;

  return (
    <>
      <header className="flex flex-col gap-1">
        <Link href="/criteria" className="text-primary underline">Zurück zu den Kriterien</Link>
        <h1 className="text-xl font-semibold">
          <span className="font-mono">{detail.number}</span> {detail.title}
        </h1>
      </header>

      <section aria-labelledby="facts-heading" className="flex flex-col gap-3">
        <h2 id="facts-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">Angaben</h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <div><dt className="text-text-muted">Kapitel</dt><dd>{detail.chapter}</dd></div>
          <div><dt className="text-text-muted">Pflicht im Verfahren</dt><dd>{scopeLabel(detail)}</dd></div>
          <div>
            <dt className="text-text-muted">Standardversion</dt>
            <dd>
              {detail.standardVersionLabel}
              {!detail.standardValidated && <span className="text-text-muted"> (Entwurf, nicht validiert)</span>}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Stand</dt>
            <dd className={`font-medium ${STATUS_TONE[detail.status]}`}>{STATUS_LABEL[detail.status]}</dd>
          </div>
          <div><dt className="text-text-muted">Frist</dt><dd>{detail.dueDate ? formatDate(detail.dueDate) : "ohne Frist"}</dd></div>
          <div>
            <dt className="text-text-muted">Zuletzt geändert</dt>
            <dd>{detail.updatedAt ? formatDateTime(detail.updatedAt) : "noch nie"}</dd>
          </div>
          {detail.status === "not_applicable" && (
            <div className="sm:col-span-2">
              <dt className="text-text-muted">Begründung «Entfällt»</dt>
              <dd>{detail.notApplicableReason}</dd>
            </div>
          )}
        </dl>
      </section>

      <section aria-labelledby="assess-heading" className="flex flex-col gap-3">
        <h2 id="assess-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">Bewertung</h2>
        {canWrite ? (
          <AssessmentForm
            number={detail.number}
            status={detail.status}
            reason={detail.notApplicableReason}
            dueDate={detail.dueDate}
            statusOptions={ASSESSMENT_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          />
        ) : (
          <p className="text-text-muted">Mit Ihrer Rolle ist die Bewertung schreibgeschützt.</p>
        )}
      </section>

      {history && (
        <section aria-labelledby="history-heading" className="flex flex-col gap-3">
          <h2 id="history-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">Verlauf</h2>
          {history.length === 0 ? (
            <p className="text-text-muted">Noch keine Änderungen.</p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Änderungsverlauf dieses Kriteriums</caption>
                <thead className="bg-surface-subtle text-text-muted">
                  <tr>
                    <th scope="col" className="whitespace-nowrap px-3 py-2">Zeitpunkt</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-2">Person</th>
                    <th scope="col" className="px-3 py-2">Änderung</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2">{formatDateTime(h.createdAt)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{h.actorName ?? "unbekannt"}</td>
                      <td className="px-3 py-2">{describeAuditEvent(h)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

export default function CriterionPage({ params }: { params: Promise<{ number: string }> }) {
  return (
    <main className="flex flex-col gap-6">
      <Suspense fallback={<p className="text-text-muted">Kriterium wird geladen...</p>}>
        <Detail params={params} />
      </Suspense>
    </main>
  );
}
