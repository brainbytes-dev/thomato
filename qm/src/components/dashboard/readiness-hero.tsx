import type { DashboardData } from "@/domain/dashboard";
import { formatDays, formatMonths, SOON_DAYS } from "@/domain/dates";
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

export function ReadinessHero({ data }: { data: DashboardData }) {
  const r = data.readiness;
  const expired = data.expiry?.kind === "expired" ? data.expiry : null;
  return (
    <section aria-labelledby="readiness-heading" className="flex flex-col gap-4">
      <h2 id="readiness-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        Readiness
      </h2>
      <div>
        <p className={`text-3xl font-semibold ${TONE[r.status]}`}>{LABEL[r.status]}</p>
        <p className="mt-1">{readinessSummary(r)}</p>
        {expired && (
          <p className="mt-1 font-medium text-critical">
            Die Anerkennung ist seit {formatDays(expired.days)} abgelaufen.
          </p>
        )}
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
          <dd className="text-2xl font-semibold">
            {data.expiry === null ? (
              "k. A."
            ) : data.expiry.kind === "months" ? (
              formatMonths(data.expiry.months)
            ) : (
              <span className="text-critical">abgelaufen seit {formatDays(data.expiry.days)}</span>
            )}
          </dd>
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
