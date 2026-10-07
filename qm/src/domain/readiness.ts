import type { AssessmentStatus } from "@/db/schema";

export type ProcedureMode = "accreditation" | "renewal";
export type ReadinessStatus = "ready" | "action_needed" | "critical" | "not_assessed";

export type CriterionInput = {
  number: string;
  chapter: string;
  mandatoryAccreditation: boolean;
  shouldAccreditation: boolean;
  mandatoryRenewal: boolean;
  shouldRenewal: boolean;
  status: AssessmentStatus;
};

export type ReadinessResult = {
  status: ReadinessStatus;
  basisValidated: boolean;
  progressPercent: number | null;
  applicable: number;
  met: number;
  notApplicable: number;
  mandatory: { total: number; met: number; critical: number; open: number; notAssessed: number };
  shouldCritical: number;
  blockers: string[];
};

export function scopeOf(c: CriterionInput, mode: ProcedureMode): { mandatory: boolean; should: boolean } {
  return mode === "accreditation"
    ? { mandatory: c.mandatoryAccreditation, should: c.shouldAccreditation }
    : { mandatory: c.mandatoryRenewal, should: c.shouldRenewal };
}

export function computeReadiness(
  criteria: readonly CriterionInput[],
  mode: ProcedureMode,
  basisValidated: boolean,
): ReadinessResult {
  let applicable = 0;
  let met = 0;
  let notApplicable = 0;
  let notAssessed = 0;
  let shouldCritical = 0;
  const mandatory = { total: 0, met: 0, critical: 0, open: 0, notAssessed: 0 };
  const blockers: string[] = [];

  for (const c of criteria) {
    const scope = scopeOf(c, mode);
    if (!scope.mandatory && !scope.should) continue;
    if (c.status === "not_applicable") {
      notApplicable += 1;
      continue;
    }
    applicable += 1;
    if (c.status === "met") met += 1;
    if (c.status === "not_assessed") notAssessed += 1;
    if (scope.mandatory) {
      mandatory.total += 1;
      if (c.status === "met") mandatory.met += 1;
      else if (c.status === "critical") {
        mandatory.critical += 1;
        blockers.push(c.number);
      } else if (c.status === "open") mandatory.open += 1;
      else mandatory.notAssessed += 1;
    } else if (c.status === "critical") {
      shouldCritical += 1;
    }
  }

  let status: ReadinessStatus;
  if (applicable === 0 || notAssessed === applicable) status = "not_assessed";
  else if (mandatory.critical > 0) status = "critical";
  else if (mandatory.met < mandatory.total || shouldCritical > 0) status = "action_needed";
  else status = "ready";

  return {
    status,
    basisValidated,
    progressPercent: applicable === 0 ? null : Math.round((met / applicable) * 100),
    applicable,
    met,
    notApplicable,
    mandatory,
    shouldCritical,
    blockers,
  };
}

export function readinessSummary(r: ReadinessResult): string {
  if (r.status === "not_assessed") return "Noch kein Kriterium bewertet.";
  if (r.status === "critical") {
    const n = r.mandatory.critical;
    return n === 1
      ? "1 kritischer Punkt verhindert aktuell vollständige Readiness."
      : `${n} kritische Punkte verhindern aktuell vollständige Readiness.`;
  }
  if (r.status === "action_needed") {
    const k = r.mandatory.open + r.mandatory.notAssessed;
    if (k > 0) {
      return k === 1
        ? "1 Pflichtkriterium ist noch offen oder nicht bewertet."
        : `${k} Pflichtkriterien sind noch offen oder nicht bewertet.`;
    }
    return r.shouldCritical === 1
      ? "1 Soll-Kriterium ist kritisch."
      : `${r.shouldCritical} Soll-Kriterien sind kritisch.`;
  }
  return "Alle Pflichtkriterien sind erfüllt.";
}
