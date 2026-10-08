import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { EYEBROW, SECTION_CARD, TABLE_WRAP, TD, TH } from "@/components/ui/styles";
import { STATUS_BADGE, STATUS_LABEL, scopeLabel } from "@/components/criteria/status-copy";
import { ASSESSMENT_STATUSES } from "@/db/schema";
import { getAssessmentByNumber, listCriterionHistory } from "@/domain/assessments";
import { describeAuditEvent } from "@/domain/audit-copy";
import { formatDate, formatDateTime } from "@/domain/dates";
import { requireOrgContextOrRedirect } from "@/domain/request-context";
import { can } from "@/domain/rights";
import { AssessmentForm } from "./assessment-form";
import { EvidenceSection } from "./evidence-section";
import { MeasuresSection } from "./measures-section";

async function Detail({ params }: { params: Promise<{ number: string }> }) {
  const { number: raw } = await params;
  let number: string;
  try {
    number = decodeURIComponent(raw);
  } catch {
    notFound();
  }
  const ctx = await requireOrgContextOrRedirect();
  const detail = await getAssessmentByNumber(ctx, number);
  if (!detail) notFound();
  const now = new Date();
  const canWrite = can(ctx.role, "assessment", "write");
  const history =
    can(ctx.role, "audit", "read") ? await listCriterionHistory(ctx, number, detail.assessmentId) : null;

  return (
    <>
      <header className="flex flex-col gap-2">
        <Link href="/criteria" className="type-label inline-flex h-9 items-center gap-2 self-start text-primary hover:underline">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Zurück zu den Kriterien
        </Link>
        <h1 className="type-headline-section max-w-[70ch]">
          <span className="font-mono">{detail.number}</span> {detail.title}
        </h1>
      </header>

      <section aria-labelledby="facts-heading" className={SECTION_CARD}>
        <h2 id="facts-heading" className={EYEBROW}>Angaben</h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <div><dt className="type-meta text-text-muted">Kapitel</dt><dd className="type-body">{detail.chapter}</dd></div>
          <div><dt className="type-meta text-text-muted">Pflicht im Verfahren</dt><dd className="type-body">{scopeLabel(detail)}</dd></div>
          <div>
            <dt className="type-meta text-text-muted">Standardversion</dt>
            <dd className="type-body">
              {detail.standardVersionLabel}
              {!detail.standardValidated && <span className="text-text-muted"> (nicht validiert)</span>}
            </dd>
          </div>
          <div>
            <dt className="type-meta text-text-muted">Stand</dt>
            <dd className="type-body"><Badge tone={STATUS_BADGE[detail.status]} dot>{STATUS_LABEL[detail.status]}</Badge></dd>
          </div>
          <div><dt className="type-meta text-text-muted">Frist</dt><dd className="type-body">{detail.dueDate ? formatDate(detail.dueDate) : "ohne Frist"}</dd></div>
          <div>
            <dt className="type-meta text-text-muted">Zuletzt geändert</dt>
            <dd className="type-body">{detail.updatedAt ? formatDateTime(detail.updatedAt) : "noch nie"}</dd>
          </div>
          {detail.status === "not_applicable" && (
            <div className="sm:col-span-2">
              <dt className="type-meta text-text-muted">Begründung «Nicht anwendbar»</dt>
              <dd className="type-body max-w-[70ch]">{detail.notApplicableReason}</dd>
            </div>
          )}
        </dl>
      </section>

      <section aria-labelledby="assess-heading" className={SECTION_CARD}>
        <h2 id="assess-heading" className={EYEBROW}>Bewertung</h2>
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

      <Suspense fallback={<p className="text-text-muted">Nachweise werden geladen...</p>}>
        <EvidenceSection ctx={ctx} number={detail.number} status={detail.status} now={now} />
      </Suspense>

      <Suspense fallback={<p className="text-text-muted">Massnahmen werden geladen...</p>}>
        <MeasuresSection ctx={ctx} number={detail.number} now={now} />
      </Suspense>

      {history && (
        <section aria-labelledby="history-heading" className={SECTION_CARD}>
          <h2 id="history-heading" className={EYEBROW}>Verlauf</h2>
          {history.length === 0 ? (
            <p className="text-text-muted">Noch keine Änderungen.</p>
          ) : (
            <div className={TABLE_WRAP}>
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Änderungsverlauf dieses Kriteriums</caption>
                <thead className="bg-surface-subtle">
                  <tr>
                    <th scope="col" className={TH}>Zeitpunkt</th>
                    <th scope="col" className={TH}>Person</th>
                    <th scope="col" className={TH}>Änderung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className={`${TD} whitespace-nowrap`}>{formatDateTime(h.createdAt)}</td>
                      <td className={`${TD} whitespace-nowrap`}>{h.actorName ?? "unbekannt"}</td>
                      <td className={TD}>{describeAuditEvent(h)}</td>
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
