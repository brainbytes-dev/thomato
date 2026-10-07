import { MEASURE_STATUS_LABEL } from "@/components/criteria/status-copy";
import { MEASURE_STATUSES } from "@/db/schema";
import { formatDate, formatDateTime } from "@/domain/dates";
import { listCriterionMeasures, listOrgMembers } from "@/domain/measures";
import type { OrgContext } from "@/domain/org-context";
import { can } from "@/domain/rights";
import { CreateMeasureForm, EditMeasureForm, MeasureNoticeScope, MeasureStatusForm } from "./measure-forms";

const TH = "whitespace-nowrap px-3 py-2";
const TD = "px-3 py-2 align-top";
const SUMMARY = "cursor-pointer font-medium text-primary underline";
const STATUS_OPTIONS = MEASURE_STATUSES.map((s) => ({ value: s, label: MEASURE_STATUS_LABEL[s] }));

export async function MeasuresSection({ ctx, number, now }: { ctx: OrgContext; number: string; now: Date }) {
  const canWrite = can(ctx.role, "measure", "write");
  const [measures, members] = await Promise.all([
    listCriterionMeasures(ctx, number, now),
    canWrite ? listOrgMembers(ctx) : Promise.resolve([]),
  ]);

  return (
    <section aria-labelledby="measures-heading" className="flex flex-col gap-4">
      <h2
        id="measures-heading"
        tabIndex={-1}
        className="text-xs font-semibold uppercase tracking-wide text-text-muted"
      >
        Massnahmen
      </h2>

      <MeasureNoticeScope>
        {measures.length === 0 ? (
          <p className="text-text-muted">Für dieses Kriterium gibt es noch keine Massnahme.</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Massnahmen zu diesem Kriterium</caption>
              <thead className="bg-surface-subtle text-text-muted">
                <tr>
                  <th scope="col" className={TH}>Massnahme</th>
                  <th scope="col" className={TH}>Verantwortliche</th>
                  <th scope="col" className={TH}>Frist</th>
                  <th scope="col" className={TH}>Status</th>
                  <th scope="col" className={TH}>Erledigt am</th>
                </tr>
              </thead>
              {measures.map((m) => (
                <tbody key={m.id} className="border-t border-border">
                  <tr>
                    <th scope="row" className={`${TD} max-w-md font-normal`}>
                      <span className="block font-bold">{m.title}</span>
                      {m.description && <span className="block whitespace-pre-line text-text-muted">{m.description}</span>}
                    </th>
                    <td className={TD}>{m.ownerName ?? "unbekannt"}</td>
                    <td className={`${TD} whitespace-nowrap`}>
                      {formatDate(m.dueDate)}
                      {m.overdue && <span className="font-medium text-critical"> (überfällig)</span>}
                    </td>
                    <td className={`${TD} whitespace-nowrap font-medium`}>{MEASURE_STATUS_LABEL[m.status]}</td>
                    <td className={`${TD} whitespace-nowrap`}>
                      {m.status === "done" && m.completedAt ? formatDateTime(m.completedAt) : ""}
                    </td>
                  </tr>
                  {canWrite && (
                    <tr>
                      <td colSpan={5} className="px-3 pb-3">
                        <div className="flex flex-col gap-3">
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
                              />
                            </div>
                          </details>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              ))}
            </table>
          </div>
        )}

        {canWrite ? (
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold">Massnahme anlegen</h3>
            <CreateMeasureForm number={number} members={members} defaultOwnerId={ctx.userId} />
          </div>
        ) : (
          <p className="text-text-muted">Mit Ihrer Rolle sind Massnahmen schreibgeschützt.</p>
        )}
      </MeasureNoticeScope>
    </section>
  );
}
