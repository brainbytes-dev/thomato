import { FileText } from "lucide-react";
import { Panel } from "@/components/criteria/panel";
import {
  EVIDENCE_BADGE,
  EVIDENCE_LABEL,
  EVIDENCE_TONE,
  STATUS_LABEL,
  STATUS_TONE,
} from "@/components/criteria/status-copy";
import { formatBytes } from "@/components/criteria/file-check";
import { Badge } from "@/components/ui/badge";
import { LINK_SUMMARY, TD, TH } from "@/components/ui/styles";
import type { AssessmentStatus } from "@/db/schema";
import { formatDate, formatDateTime } from "@/domain/dates";
import { listLinkableDocuments, type EvidenceDoc, type VersionView } from "@/domain/documents";
import type { EvidenceState } from "@/domain/evidence";
import { MAX_FILE_BYTES } from "@/domain/file-validation";
import type { OrgContext } from "@/domain/org-context";
import { can } from "@/domain/rights";
import { AddVersionForm, LinkDocumentForm, UnlinkForm, UnlinkNoticeScope, UploadDocumentForm } from "./evidence-forms";

const SUMMARY = LINK_SUMMARY;

type Evidence = { docs: EvidenceDoc[]; state: EvidenceState };
type Linkable = { documentId: string; title: string }[];

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
    <div className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
      <dt className="text-text-muted">{label}</dt>
      <dd className={`font-medium ${tone ?? ""}`}>{value}</dd>
    </div>
  );
}

export function UploadCard({ number }: { number: string }) {
  return (
    <Panel headingId="upload-heading" title="Nachweis erfassen">
      <p className="max-w-[70ch] text-text-muted">
        Das Dokument wird mit diesem Kriterium verknüpft. Die Bewertung ändert sich dadurch nicht.
      </p>
      <UploadDocumentForm number={number} maxBytes={MAX_FILE_BYTES} />
    </Panel>
  );
}

export function EvidenceFactsView({ docs, state, status }: Evidence & { status: AssessmentStatus }) {
  return (
    <Panel headingId="evidence-facts-heading" title="Nachweis-Stand">
      <dl className="divide-y divide-border">
        <Indicator label="Nachweis" value={EVIDENCE_LABEL[state]} tone={EVIDENCE_TONE[state]} />
        <Indicator label="Dokumente" value={String(docs.length)} />
        <Indicator label="Stand" value={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />
      </dl>
    </Panel>
  );
}

export async function EvidenceFacts({ status, evidence }: { status: AssessmentStatus; evidence: Promise<Evidence> }) {
  const { docs, state } = await evidence;
  return <EvidenceFactsView docs={docs} state={state} status={status} />;
}

function VersionsTable({ d }: { d: EvidenceDoc }) {
  return (
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
              <td className={`${TD} whitespace-nowrap type-meta-mono`}>{formatDateTime(v.createdAt)}</td>
              <td className={`${TD} whitespace-nowrap`}>{validUntilText(v.validUntil)}</td>
              <td className={`${TD} whitespace-nowrap`}>
                <Download version={v} label={`V${v.versionNumber} herunterladen`} title={d.title} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EvidenceRegisteredView({
  number,
  status,
  docs,
  state,
  canWrite,
  linkable,
}: Evidence & { number: string; status: AssessmentStatus; canWrite: boolean; linkable: Linkable }) {
  const settled = status === "met" || status === "not_applicable";
  const count = `${docs.length} ${docs.length === 1 ? "Dokument" : "Dokumente"}`;

  return (
    <Panel
      headingId="evidence-heading"
      title="Registrierte Nachweise"
      focusable
      aside={<span className="type-meta text-text-muted">{count}</span>}
    >
      <UnlinkNoticeScope>
        {state === "current" && !settled && (
          <p className="max-w-[70ch] text-text-muted">
            Ein aktueller Nachweis liegt vor. Prüfen Sie den Stand und setzen Sie ihn bei Bedarf unter «Bewertung» auf «Erfüllt».
          </p>
        )}
        {status === "met" && state !== "current" && (
          <p className="max-w-[70ch] font-medium text-warning">
            Das Kriterium ist als erfüllt bewertet, aber es gibt keinen aktuellen Nachweis.
          </p>
        )}

        {docs.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-surface-subtle p-4 text-text-muted">
            <FileText aria-hidden="true" className="size-4 shrink-0" />
            Für dieses Kriterium ist noch kein Dokument verknüpft.
          </p>
        ) : (
          <div className="relative overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Mit diesem Kriterium verknüpfte Dokumente</caption>
              <thead className="bg-surface-subtle">
                <tr>
                  <th scope="col" className={TH}>Titel</th>
                  <th scope="col" className={TH}>Aktuelle Version</th>
                  <th scope="col" className={TH}>Gültig bis</th>
                  <th scope="col" className={TH}>Nachweis</th>
                  <th scope="col" className={TH}>Download</th>
                </tr>
              </thead>
              {docs.map((d) => (
                <tbody key={d.linkId} className="border-t border-border">
                  <tr>
                    <th scope="row" className={`${TD} font-medium`}>{d.title}</th>
                    <td className={TD}>V{d.latest.versionNumber}, {d.latest.fileName}</td>
                    <td className={`${TD} whitespace-nowrap`}>{validUntilText(d.latest.validUntil)}</td>
                    <td className={`${TD} whitespace-nowrap`}>
                      <Badge tone={EVIDENCE_BADGE[d.state]} dot>{EVIDENCE_LABEL[d.state]}</Badge>
                    </td>
                    <td className={`${TD} whitespace-nowrap`}><Download version={d.latest} label="Herunterladen" title={d.title} /></td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="px-4 pb-4">
                      <div className="flex flex-col gap-3">
                        <details>
                          <summary className={SUMMARY}>Versionen anzeigen</summary>
                          <VersionsTable d={d} />
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
          linkable.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <h3 className="type-body-emphasis">Vorhandenes Dokument verknüpfen</h3>
              <LinkDocumentForm number={number} options={linkable} />
            </div>
          )
        ) : (
          <p className="text-text-muted">Mit Ihrer Rolle sind Nachweise schreibgeschützt.</p>
        )}
      </UnlinkNoticeScope>
    </Panel>
  );
}

export async function EvidenceRegistered({
  ctx,
  number,
  status,
  evidence,
}: {
  ctx: OrgContext;
  number: string;
  status: AssessmentStatus;
  evidence: Promise<Evidence>;
}) {
  const canWrite = can(ctx.role, "document", "write");
  const [{ docs, state }, linkable] = await Promise.all([
    evidence,
    canWrite ? listLinkableDocuments(ctx, number) : Promise.resolve([]),
  ]);
  return (
    <EvidenceRegisteredView number={number} status={status} docs={docs} state={state} canWrite={canWrite} linkable={linkable} />
  );
}
