import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CriterionHeader } from "@/components/criteria/criterion-header";
import { HistoryTimeline } from "@/components/criteria/history-timeline";
import { Panel } from "@/components/criteria/panel";
import { StatusNotice } from "@/components/criteria/status-notice";
import { STATUS_LABEL, scopeLabel } from "@/components/criteria/status-copy";
import { ASSESSMENT_STATUSES } from "@/db/schema";
import { getAssessmentByNumber, listCriterionHistory } from "@/domain/assessments";
import { formatDate, formatDateTime } from "@/domain/dates";
import { listCriterionEvidence } from "@/domain/documents";
import { requireOrgContextOrRedirect } from "@/domain/request-context";
import { can } from "@/domain/rights";
import { AssessmentForm } from "./assessment-form";
import { EvidenceFacts, EvidenceRegistered, UploadCard } from "./evidence-section";
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
  const canWriteDocuments = can(ctx.role, "document", "write");
  const history =
    can(ctx.role, "audit", "read") ? await listCriterionHistory(ctx, number, detail.assessmentId) : null;
  // Ein Abruf für Arbeitsfläche und Seitenpanel: beide lesen dasselbe Versprechen.
  const evidence = listCriterionEvidence(ctx, detail.number, now);

  return (
    <>
      <CriterionHeader
        number={detail.number}
        title={detail.title}
        chapter={detail.chapter}
        status={detail.status}
        scope={scopeLabel(detail)}
        dueDateText={detail.dueDate ? formatDate(detail.dueDate) : "ohne Frist"}
        updatedAtText={detail.updatedAt ? formatDateTime(detail.updatedAt) : "noch nie"}
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-8">
          <StatusNotice
            status={detail.status}
            notApplicableReason={detail.notApplicableReason}
            standardVersionLabel={detail.standardVersionLabel}
            standardValidated={detail.standardValidated}
          />

          <Panel headingId="assess-heading" title="Bewertung">
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
          </Panel>

          {canWriteDocuments && <UploadCard number={detail.number} />}

          <Suspense fallback={<p className="text-text-muted">Nachweise werden geladen...</p>}>
            <EvidenceRegistered ctx={ctx} number={detail.number} status={detail.status} evidence={evidence} />
          </Suspense>
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:col-span-4">
          <Suspense fallback={<p className="text-text-muted">Nachweise werden geladen...</p>}>
            <EvidenceFacts status={detail.status} evidence={evidence} />
          </Suspense>

          <Suspense fallback={<p className="text-text-muted">Massnahmen werden geladen...</p>}>
            <MeasuresSection ctx={ctx} number={detail.number} now={now} />
          </Suspense>

          {history && <HistoryTimeline entries={history} />}
        </div>
      </div>
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
