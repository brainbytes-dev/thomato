import Link from "next/link";
import type { DashboardData } from "@/domain/dashboard";
import { SOON_DAYS } from "@/domain/dates";
import { describeExpiry } from "@/domain/expiry-copy";
import { naMandatoryNotice } from "@/domain/readiness-copy";
import { readinessSummary, type ReadinessStatus } from "@/domain/readiness";

const LABEL: Record<ReadinessStatus, string> = {
  ready: "Bereit",
  action_needed: "Handlungsbedarf",
  critical: "Kritisch",
  not_assessed: "Nicht bewertet",
};

const TONE: Record<ReadinessStatus, string> = {
  ready: "text-success",
  action_needed: "text-warning",
  critical: "text-critical",
  not_assessed: "text-text-muted",
};

const EXPIRY_TONE = { critical: "text-critical", normal: "", muted: "text-text-muted" } as const;

export function ReadinessHero({ data }: { data: DashboardData }) {
  const r = data.readiness;
  const expiry = describeExpiry(data.expiry);
  const naNotice = naMandatoryNotice(r.mandatory.notApplicable);
  return (
    <section aria-labelledby="readiness-heading" className="flex flex-col gap-4">
      <h2 id="readiness-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        Readiness
      </h2>
      <div>
        <p className={`text-3xl font-semibold ${TONE[r.status]}`}>{LABEL[r.status]}</p>
        <p className="mt-1">{readinessSummary(r)}</p>
        {naNotice && (
          <p className="mt-1">
            {naNotice}{" "}
            <Link href="/criteria?status=not_applicable" className="text-primary underline">
              Alle nicht anwendbaren Kriterien ansehen
            </Link>
          </p>
        )}
        {expiry.line && <p className="mt-1 font-medium text-critical">{expiry.line}</p>}
        {!r.basisValidated && (
          <p className="mt-1 text-text-muted">
            Interne Arbeitsbewertung auf Basis eines nicht validierten Katalogs (Entwurf). Keine Entscheidung des IVR.
          </p>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 border-t border-border pt-4 sm:grid-cols-3">
        <div>
          <dt className="text-text-muted">Dokumentationsstand</dt>
          <dd className="text-2xl font-semibold">{r.progressPercent === null ? "k. A." : `${r.progressPercent} %`}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Kriterien erfüllt</dt>
          <dd className="text-2xl font-semibold">{r.met} / {r.applicable}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Bis Ablauf der Anerkennung</dt>
          <dd className={`text-2xl font-semibold ${EXPIRY_TONE[expiry.tone]}`}>{expiry.stat}</dd>
        </div>
      </dl>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 border-t border-border pt-4 sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <dt className="text-text-muted">Kritische Pflichtkriterien</dt>
          <dd className="text-xl font-semibold text-critical">{r.mandatory.critical}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Offen</dt>
          <dd className="text-xl font-semibold text-warning">{r.mandatory.open}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Nicht bewertet</dt>
          <dd className="text-xl font-semibold">{r.mandatory.notAssessed}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Überfällige Fristen</dt>
          <dd className={`text-xl font-semibold ${data.overdueCount > 0 ? "text-critical" : ""}`}>
            {data.overdueCount}
          </dd>
        </div>
        <div>
          <dt className="text-text-muted">{`Fällig innerhalb von ${SOON_DAYS} Tagen (inkl. überfällig)`}</dt>
          <dd className="text-xl font-semibold">{data.soonCount}</dd>
        </div>
      </dl>
    </section>
  );
}
