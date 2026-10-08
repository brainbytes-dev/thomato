import { CalendarClock, Plus, UserRound } from "lucide-react";
import { Panel } from "@/components/criteria/panel";
import { MEASURE_STATUS_BADGE, MEASURE_STATUS_LABEL } from "@/components/criteria/status-copy";
import { Badge } from "@/components/ui/badge";
import { LINK_SUMMARY } from "@/components/ui/styles";
import { MEASURE_STATUSES } from "@/db/schema";
import { formatDate, formatDateTime } from "@/domain/dates";
import { listCriterionMeasures, listOrgMembers, type MeasureView } from "@/domain/measures";
import type { OrgContext } from "@/domain/org-context";
import { can } from "@/domain/rights";
import { CreateMeasureForm, EditMeasureForm, MeasureNoticeScope, MeasureStatusForm, type MemberOption } from "./measure-forms";

const SUMMARY = LINK_SUMMARY;
const STATUS_OPTIONS = MEASURE_STATUSES.map((s) => ({ value: s, label: MEASURE_STATUS_LABEL[s] }));

export function MeasuresView({
  number,
  measures,
  members,
  canWrite,
  defaultOwnerId,
}: {
  number: string;
  measures: MeasureView[];
  members: MemberOption[];
  canWrite: boolean;
  defaultOwnerId: string;
}) {
  return (
    <Panel
      headingId="measures-heading"
      title="Massnahmen"
      focusable
      aside={<span className="type-meta text-text-muted">{measures.length}</span>}
    >
      <MeasureNoticeScope>
        {measures.length === 0 ? (
          <p className="text-text-muted">Für dieses Kriterium gibt es noch keine Massnahme.</p>
        ) : (
          <ul aria-label="Massnahmen zu diesem Kriterium" className="flex flex-col gap-3">
            {measures.map((m) => (
              <li key={m.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface-subtle p-3">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="type-body-emphasis min-w-0 break-words">{m.title}</p>
                    <Badge tone={MEASURE_STATUS_BADGE[m.status]} dot>{MEASURE_STATUS_LABEL[m.status]}</Badge>
                  </div>
                  {m.description && (
                    <p className="type-meta whitespace-pre-line break-words text-text-muted">{m.description}</p>
                  )}
                  <dl className="type-meta flex flex-col gap-1 text-text-muted">
                    <div className="flex items-center gap-2">
                      <UserRound aria-hidden="true" className="size-3.5 shrink-0" />
                      <dt className="sr-only">Verantwortliche Person</dt>
                      <dd>{m.ownerName ?? "unbekannt"}</dd>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2">
                      <CalendarClock aria-hidden="true" className="size-3.5 shrink-0" />
                      <dt>Frist</dt>
                      <dd className="type-meta-mono text-text">{formatDate(m.dueDate)}</dd>
                      {m.overdue && <dd className="font-semibold text-critical">(überfällig)</dd>}
                    </div>
                    {m.status === "done" && m.completedAt && (
                      <div className="flex flex-wrap items-center gap-x-2 pl-[22px]">
                        <dt>Erledigt am</dt>
                        <dd className="type-meta-mono text-text">{formatDateTime(m.completedAt)}</dd>
                      </div>
                    )}
                  </dl>
                </div>
                {canWrite && (
                  <div className="flex flex-col gap-3 border-t border-border pt-3">
                    <MeasureStatusForm
                      number={number}
                      measureId={m.id}
                      title={m.title}
                      status={m.status}
                      options={STATUS_OPTIONS}
                    />
                    <details>
                      <summary className={SUMMARY}>
                        Bearbeiten<span className="sr-only"> von «{m.title}»</span>
                      </summary>
                      <div className="mt-3">
                        <EditMeasureForm
                          key={`${m.title}|${m.description}|${m.ownerUserId}|${m.dueDate}`}
                          number={number}
                          measureId={m.id}
                          title={m.title}
                          description={m.description}
                          ownerUserId={m.ownerUserId}
                          dueDate={m.dueDate}
                          members={members}
                          ownerName={m.ownerName}
                        />
                      </div>
                    </details>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {canWrite ? (
          <details className="group rounded-lg border-2 border-dashed border-field-border open:border-solid open:border-border">
            <summary className="type-label flex min-h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-md px-3 py-2 text-primary hover:bg-surface-subtle [&::-webkit-details-marker]:hidden">
              <Plus aria-hidden="true" className="size-4" />
              Massnahme erfassen
            </summary>
            <div className="border-t border-border p-3">
              <CreateMeasureForm number={number} members={members} defaultOwnerId={defaultOwnerId} />
            </div>
          </details>
        ) : (
          <p className="text-text-muted">Mit Ihrer Rolle sind Massnahmen schreibgeschützt.</p>
        )}
      </MeasureNoticeScope>
    </Panel>
  );
}

export async function MeasuresSection({ ctx, number, now }: { ctx: OrgContext; number: string; now: Date }) {
  const canWrite = can(ctx.role, "measure", "write");
  const [measures, members] = await Promise.all([
    listCriterionMeasures(ctx, number, now),
    canWrite ? listOrgMembers(ctx) : Promise.resolve([]),
  ]);
  return (
    <MeasuresView number={number} measures={measures} members={members} canWrite={canWrite} defaultOwnerId={ctx.userId} />
  );
}
