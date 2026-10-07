import type { DashboardData } from "@/domain/dashboard";
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
  const open = r.mandatory.open + r.mandatory.notAssessed;
  return (
    <section aria-labelledby="readiness-heading" className="flex flex-col gap-4">
      <h2 id="readiness-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        Readiness
      </h2>
      <div>
        <p className={`text-3xl font-semibold ${TONE[r.status]}`}>{LABEL[r.status]}</p>
        <p className="mt-1">{readinessSummary(r)}</p>
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
            {data.monthsToExpiry === null ? "k. A." : `${data.monthsToExpiry} Monate`}
          </dd>
        </div>
      </dl>
      <ul className="flex flex-wrap gap-x-8 gap-y-2 border-t border-border pt-4">
        <li><span className="font-semibold text-critical">Kritisch {r.mandatory.critical}</span></li>
        <li><span className="font-semibold text-warning">Offen {open}</span></li>
        <li><span className="font-semibold">Fällig in 30 Tagen {data.soonCount}</span></li>
      </ul>
    </section>
  );
}
