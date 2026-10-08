import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { AssessmentStatus } from "@/db/schema";
import { Panel } from "./panel";
import { STATUS_EXPLANATION, STATUS_LABEL } from "./status-copy";

const CALLOUT: Record<AssessmentStatus, string> = {
  critical: "border-critical bg-critical-tint text-text",
  open: "border-border bg-warning-tint text-text",
  met: "border-border bg-success-tint text-text",
  not_assessed: "border-border bg-surface-subtle text-text",
  not_applicable: "border-border bg-surface-subtle text-text",
};

const ICON_TONE: Record<AssessmentStatus, string> = {
  critical: "text-critical",
  open: "text-warning",
  met: "text-success",
  not_assessed: "text-text-muted",
  not_applicable: "text-text-muted",
};

function StatusIcon({ status }: { status: AssessmentStatus }) {
  const cls = `mt-0.5 size-5 shrink-0 ${ICON_TONE[status]}`;
  if (status === "critical" || status === "open") return <TriangleAlert aria-hidden="true" className={cls} />;
  if (status === "met") return <CircleCheck aria-hidden="true" className={cls} />;
  return <Info aria-hidden="true" className={cls} />;
}

export function StatusNotice({
  status,
  notApplicableReason,
  standardVersionLabel,
  standardValidated,
}: {
  status: AssessmentStatus;
  notApplicableReason: string | null;
  standardVersionLabel: string;
  standardValidated: boolean;
}) {
  return (
    <Panel headingId="facts-heading" title="Stand und Hinweise">
      <div className={`flex gap-3 rounded-lg border p-4 ${CALLOUT[status]}`}>
        <StatusIcon status={status} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="type-body-emphasis">{STATUS_LABEL[status]}</p>
          <p className="type-body max-w-[70ch]">{STATUS_EXPLANATION[status]}</p>
          {status === "not_applicable" && notApplicableReason && (
            <p className="type-body max-w-[70ch]">
              <span className="text-text-muted">Begründung für «nicht anwendbar»: </span>
              {notApplicableReason}
            </p>
          )}
        </div>
      </div>
      <p className="type-meta flex items-start gap-2 text-text-muted">
        <Info aria-hidden="true" className="mt-px size-4 shrink-0" />
        <span>
          Standardversion {standardVersionLabel}
          {!standardValidated && " (nicht validiert)"}
        </span>
      </p>
    </Panel>
  );
}
