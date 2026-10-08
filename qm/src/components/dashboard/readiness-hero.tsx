import Link from "next/link";
import { Badge, CARD, type BadgeTone } from "@/components/ui/badge";
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

const DOT: Record<ReadinessStatus, string> = {
  ready: "bg-success",
  action_needed: "bg-warning",
  critical: "bg-critical",
  not_assessed: "bg-text-muted",
};

const EXPIRY_TONE = { critical: "text-critical", normal: "", muted: "text-text-muted" } as const;

function expiryCaption(data: DashboardData): string {
  if (data.expiry === null) return "Kein Ablauftermin erfasst";
  return data.expiry.kind === "months" ? "Nächster Ablauftermin" : "Ablauftermin überschritten";
}

function Metric({ value, valueClass = "", label, children }: { value: string; valueClass?: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="flex flex-col gap-2">
        <span className={`type-display ${valueClass}`}>{value}</span>
        <span aria-hidden="true" className="type-meta text-text-muted">{label}</span>
        {children}
      </dd>
    </div>
  );
}

function Bar({ percent }: { percent: number | null }) {
  return (
    <div aria-hidden="true" className="h-[3px] w-full rounded-full bg-background">
      <div className="h-full rounded-full bg-primary" style={{ width: `${percent ?? 0}%` }} />
    </div>
  );
}

function MiniStat({ label, value, toneClass = "" }: { label: string; value: number; toneClass?: string }) {
  return (
    <div>
      <dt className="type-meta text-text-muted">{label}</dt>
      <dd className={`type-headline-sub tabular-nums ${toneClass}`}>{value}</dd>
    </div>
  );
}

export function ReadinessHero({ data, asOf }: { data: DashboardData; asOf: string }) {
  const r = data.readiness;
  const expiry = describeExpiry(data.expiry);
  const naNotice = naMandatoryNotice(r.mandatory.notApplicable);
  const criticalTone: BadgeTone = r.mandatory.critical > 0 ? "critical" : "neutral";
  const openTone: BadgeTone = r.mandatory.open > 0 ? "warning" : "neutral";
  const overdueTone: BadgeTone = data.overdueCount > 0 ? "critical" : "neutral";
  const soonTone: BadgeTone = data.soonCount > 0 ? "warning" : "neutral";
  return (
    <section aria-labelledby="readiness-heading" className={`${CARD} flex flex-col gap-6 p-5 sm:p-7`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="readiness-heading" className="type-eyebrow text-text-muted">Readiness</h2>
        <p className="type-meta-mono uppercase text-text-muted">Stand {asOf}</p>
      </div>

      <div>
        <p className={`type-display flex items-center gap-3 ${TONE[r.status]}`}>
          <span aria-hidden="true" className={`size-3 shrink-0 rounded-[2px] ${DOT[r.status]}`} />
          {LABEL[r.status]}
        </p>
        <p className="type-body-emphasis mt-2 max-w-[72ch]">{readinessSummary(r)}</p>
        {expiry.line && <p className="type-body-emphasis mt-1 text-critical">{expiry.line}</p>}
      </div>

      <dl className="grid grid-cols-1 items-start gap-6 border-t border-border pt-6 md:grid-cols-3 md:gap-8">
        <Metric
          value={r.progressPercent === null ? "k. A." : `${r.progressPercent} %`}
          label="Dokumentationsstand"
        >
          <Bar percent={r.progressPercent} />
        </Metric>
        <Metric value={`${r.met} / ${r.applicable}`} label="Kriterien erfüllt">
          <Bar percent={r.applicable === 0 ? null : (r.met * 100) / r.applicable} />
        </Metric>
        <Metric value={expiry.stat} valueClass={EXPIRY_TONE[expiry.tone]} label="Bis Ablauf der Anerkennung">
          <p className={`type-meta ${expiry.tone === "critical" ? "font-semibold text-critical" : "text-text-muted"}`}>
            {expiryCaption(data)}
          </p>
        </Metric>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border pt-6">
        <ul aria-label="Zusammenfassung" className="flex flex-wrap items-center gap-2">
          <li><Badge tone={criticalTone} upper title="Kritische Pflichtkriterien">Kritisch <span className="tabular-nums">{r.mandatory.critical}</span></Badge></li>
          <li><Badge tone={openTone} upper title="Offene Pflichtkriterien">Offen <span className="tabular-nums">{r.mandatory.open}</span></Badge></li>
          <li><Badge tone="neutral" upper title="Nicht bewertete Pflichtkriterien">Nicht bewertet <span className="tabular-nums">{r.mandatory.notAssessed}</span></Badge></li>
          <li><Badge tone={overdueTone} upper title="Überfällige Fristen">Überfällig <span className="tabular-nums">{data.overdueCount}</span></Badge></li>
          <li>
            <Badge tone={soonTone} upper title={`Fällig innerhalb von ${SOON_DAYS} Tagen (inkl. überfällig)`}>
              Fällig in {SOON_DAYS} Tagen <span className="tabular-nums">{data.soonCount}</span>
            </Badge>
          </li>
        </ul>
        {naNotice && (
          <p className="type-meta text-text-muted">
            {naNotice}.{" "}
            <Link href="/criteria?status=not_applicable" className="text-primary underline">
              Alle nicht anwendbaren Kriterien ansehen
            </Link>
          </p>
        )}
      </div>

      <div className="grid gap-6 border-t border-border pt-6 md:grid-cols-2 md:gap-8">
        <div>
          <h3 className="type-eyebrow text-text-muted">Nachweise (anwendbare Pflichtkriterien)</h3>
          <dl className="mt-3 grid grid-cols-3 gap-4">
            <MiniStat label="Aktuell" value={data.evidence.current} />
            <MiniStat label="Veraltet" value={data.evidence.stale} toneClass={data.evidence.stale > 0 ? "text-warning" : ""} />
            <MiniStat label="Fehlend" value={data.evidence.missing} />
          </dl>
        </div>
        <div>
          <h3 className="type-eyebrow text-text-muted">Massnahmen</h3>
          <dl className="mt-3 grid grid-cols-2 gap-4">
            <MiniStat label="Offen" value={data.measures.open} />
            <MiniStat label="Überfällig" value={data.measures.overdue} toneClass={data.measures.overdue > 0 ? "text-critical" : ""} />
          </dl>
        </div>
      </div>

      {!r.basisValidated && (
        <p className="type-meta border-t border-border pt-4 text-text-muted">
          Interne Arbeitsbewertung auf Basis eines nicht validierten Katalogs (Entwurf). Keine Entscheidung des IVR.
        </p>
      )}
    </section>
  );
}
