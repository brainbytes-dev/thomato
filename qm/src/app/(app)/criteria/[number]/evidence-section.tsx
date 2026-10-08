import { EVIDENCE_LABEL, EVIDENCE_TONE, STATUS_LABEL, STATUS_TONE } from "@/components/criteria/status-copy";
import { EYEBROW, LINK_SUMMARY, SECTION_CARD, TD, TH } from "@/components/ui/styles";
import { formatBytes } from "@/components/criteria/file-check";
import type { AssessmentStatus } from "@/db/schema";
import { formatDate, formatDateTime } from "@/domain/dates";
import { listCriterionEvidence, listLinkableDocuments, type VersionView } from "@/domain/documents";
import { MAX_FILE_BYTES } from "@/domain/file-validation";
import type { OrgContext } from "@/domain/org-context";
import { can } from "@/domain/rights";
import { AddVersionForm, LinkDocumentForm, UnlinkForm, UnlinkNoticeScope, UploadDocumentForm } from "./evidence-forms";

const SUMMARY = LINK_SUMMARY;

function Download({ version, label, title }: { version: VersionView; label: string; title: string }) {
  return (
    <a
      href={`/documents/versions/${version.id}`}
      aria-label={`${title}, V${version.versionNumber} herunterladen`}
      className="text-primary underline"
    >
      {label}
    </a>
  );
}

function validUntilText(v: string | null): string {
  return v ? formatDate(v) : "ohne Ablaufdatum";
}

function Indicator({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-text-muted">{label}</dt>
      <dd className={`font-medium ${tone ?? ""}`}>{value}</dd>
    </div>
  );
}

export async function EvidenceSection({
  ctx,
  number,
  status,
  now,
}: {
  ctx: OrgContext;
  number: string;
  status: AssessmentStatus;
  now: Date;
}) {
  const canWrite = can(ctx.role, "document", "write");
  const [{ docs, state }, linkable] = await Promise.all([
    listCriterionEvidence(ctx, number, now),
    canWrite ? listLinkableDocuments(ctx, number) : Promise.resolve([]),
  ]);
  const settled = status === "met" || status === "not_applicable";

  return (
    <section aria-labelledby="evidence-heading" className={SECTION_CARD}>
      <h2
        id="evidence-heading"
        tabIndex={-1}
        className={EYEBROW}
      >
        Nachweise
      </h2>

      <UnlinkNoticeScope>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
        <Indicator label="Nachweis" value={EVIDENCE_LABEL[state]} tone={EVIDENCE_TONE[state]} />
        <Indicator label="Dokumente" value={String(docs.length)} />
        <Indicator label="Kriterium" value={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />
      </dl>

      {state === "current" && !settled && (
        <p className="max-w-[70ch] text-text-muted">
          Ein aktueller Nachweis liegt vor. Bitte den Stand prüfen und bei Bedarf unter «Bewertung» auf «Erfüllt» setzen.
        </p>
      )}
      {status === "met" && state !== "current" && (
        <p className="max-w-[70ch] font-medium text-warning">
          Das Kriterium ist als erfüllt bewertet, aber es gibt keinen aktuellen Nachweis.
        </p>
      )}

      {docs.length === 0 ? (
        <p className="text-text-muted">Für dieses Kriterium ist noch kein Dokument verknüpft.</p>
      ) : (
        <div className="relative overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Mit diesem Kriterium verknüpfte Dokumente</caption>
            <thead className="bg-surface-subtle">
              <tr>
                <th scope="col" className={TH}>Titel</th>
                <th scope="col" className={TH}>Aktuelle Version</th>
                <th scope="col" className={TH}>Gültig bis</th>
                <th scope="col" className={TH}>Zustand</th>
                <th scope="col" className={TH}>Download</th>
              </tr>
            </thead>
            {docs.map((d) => (
              <tbody key={d.linkId} className="border-t border-border">
                <tr>
                  <th scope="row" className={`${TD} font-medium`}>{d.title}</th>
                  <td className={TD}>V{d.latest.versionNumber}, {d.latest.fileName}</td>
                  <td className={`${TD} whitespace-nowrap`}>{validUntilText(d.latest.validUntil)}</td>
                  <td className={`${TD} whitespace-nowrap font-medium ${EVIDENCE_TONE[d.state]}`}>
                    {EVIDENCE_LABEL[d.state]}
                  </td>
                  <td className={`${TD} whitespace-nowrap`}><Download version={d.latest} label="Herunterladen" title={d.title} /></td>
                </tr>
                <tr>
                  <td colSpan={5} className="px-4 pb-4">
                    <div className="flex flex-col gap-3">
                    <details>
                      <summary className={SUMMARY}>Versionen anzeigen</summary>
                      <div className="relative mt-2 overflow-x-auto rounded-lg border border-border">
                        <table className="w-full border-collapse text-left">
                          <caption className="sr-only">Alle Versionen von {d.title}, neueste zuerst</caption>
                          <thead className="bg-surface-subtle">
                            <tr>
                              <th scope="col" className={TH}>Version</th>
                              <th scope="col" className={TH}>Datei</th>
                              <th scope="col" className={TH}>Grösse</th>
                              <th scope="col" className={TH}>Hochgeladen von</th>
                              <th scope="col" className={TH}>Zeitpunkt</th>
                              <th scope="col" className={TH}>Gültig bis</th>
                              <th scope="col" className={TH}>Download</th>
                            </tr>
                          </thead>
                          <tbody>
                            {d.versions.map((v, i) => (
                              <tr key={v.id} className="border-t border-border">
                                <th scope="row" className={`${TD} whitespace-nowrap font-medium`}>
                                  V{v.versionNumber}
                                  {i === 0 ? (
                                    <span className="font-normal text-text-muted"> (neueste)</span>
                                  ) : (
                                    <span className="font-normal text-text-muted"> (ersetzt)</span>
                                  )}
                                </th>
                                <td className={TD}>{v.fileName}</td>
                                <td className={`${TD} whitespace-nowrap`}>{formatBytes(v.sizeBytes)}</td>
                                <td className={`${TD} whitespace-nowrap`}>{v.uploadedByName ?? "unbekannt"}</td>
                                <td className={`${TD} whitespace-nowrap`}>{formatDateTime(v.createdAt)}</td>
                                <td className={`${TD} whitespace-nowrap`}>{validUntilText(v.validUntil)}</td>
                                <td className={`${TD} whitespace-nowrap`}>
                                  <Download version={v} label={`V${v.versionNumber} herunterladen`} title={d.title} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                    {canWrite && (
                      <>
                        <details>
                          <summary className={SUMMARY}>Neue Version hochladen</summary>
                          <div className="mt-3">
                            <AddVersionForm number={number} documentId={d.documentId} maxBytes={MAX_FILE_BYTES} />
                          </div>
                        </details>
                        <UnlinkForm number={number} linkId={d.linkId} title={d.title} />
                      </>
                    )}
                    </div>
                  </td>
                </tr>
              </tbody>
            ))}
          </table>
        </div>
      )}

      {canWrite ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h3 className="type-body-emphasis">Dokument hochladen</h3>
            <p className="max-w-[70ch] text-text-muted">Das Dokument wird mit diesem Kriterium verknüpft. Die Bewertung ändert sich dadurch nicht.</p>
            <UploadDocumentForm number={number} maxBytes={MAX_FILE_BYTES} />
          </div>
          {linkable.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="type-body-emphasis">Vorhandenes Dokument verknüpfen</h3>
              <LinkDocumentForm number={number} options={linkable} />
            </div>
          )}
        </div>
      ) : (
        <p className="text-text-muted">Mit Ihrer Rolle sind Nachweise schreibgeschützt.</p>
      )}
      </UnlinkNoticeScope>
    </section>
  );
}
