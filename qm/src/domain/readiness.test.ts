import { describe, expect, it } from "vitest";
import type { AssessmentStatus } from "@/db/schema";
import { computeReadiness, percentOf, readinessSummary, type CriterionInput } from "./readiness";

let n = 0;
function crit(
  status: AssessmentStatus,
  opts: Partial<Omit<CriterionInput, "status">> = {},
): CriterionInput {
  n += 1;
  return {
    number: `c${n}`,
    chapter: "Prozess",
    mandatoryAccreditation: true,
    shouldAccreditation: false,
    mandatoryRenewal: true,
    shouldRenewal: false,
    status,
    ...opts,
  };
}
const should = (status: AssessmentStatus) =>
  crit(status, { mandatoryAccreditation: false, shouldAccreditation: true, mandatoryRenewal: false, shouldRenewal: true });

describe("computeReadiness", () => {
  it("is not_assessed for an empty list and for nothing assessed", () => {
    expect(computeReadiness([], "accreditation", false)).toMatchObject({ status: "not_assessed", progressPercent: null });
    const r = computeReadiness([crit("not_assessed"), crit("not_assessed")], "accreditation", false);
    expect(r.status).toBe("not_assessed");
    expect(r.progressPercent).toBe(0);
  });

  it("is ready only when every mandatory criterion is met", () => {
    const r = computeReadiness([crit("met"), crit("met"), should("not_assessed"), should("open")], "accreditation", false);
    expect(r.status).toBe("ready");
  });

  it("a mandatory critical criterion makes it critical even at 98 percent progress", () => {
    const list = [...Array.from({ length: 98 }, () => crit("met")), crit("critical"), crit("met")];
    const r = computeReadiness(list, "accreditation", false);
    expect(r.status).toBe("critical");
    expect(r.progressPercent).toBe(99);
    expect(r.blockers).toHaveLength(1);
  });

  it("a mandatory open criterion means action_needed, never ready", () => {
    expect(computeReadiness([crit("met"), crit("open")], "accreditation", false).status).toBe("action_needed");
  });

  it("a mandatory not_assessed criterion next to assessed ones means action_needed", () => {
    expect(computeReadiness([crit("met"), crit("not_assessed")], "accreditation", false).status).toBe("action_needed");
  });

  it("a critical should criterion prevents ready but is not critical", () => {
    const r = computeReadiness([crit("met"), should("critical")], "accreditation", false);
    expect(r.status).toBe("action_needed");
    expect(r.shouldCritical).toBe(1);
  });

  it("not_applicable criteria drop out of numerator and denominator", () => {
    const r = computeReadiness([crit("met"), crit("not_applicable")], "accreditation", false);
    expect(r.status).toBe("ready");
    expect(r.applicable).toBe(1);
    expect(r.notApplicable).toBe(1);
    expect(r.progressPercent).toBe(100);
  });

  it("ignores criteria outside the scope of the procedure", () => {
    const onlyRenewal = crit("critical", { mandatoryAccreditation: false, mandatoryRenewal: true });
    expect(computeReadiness([crit("met"), onlyRenewal], "accreditation", false).status).toBe("ready");
    expect(computeReadiness([crit("met"), onlyRenewal], "renewal", false).status).toBe("critical");
    const neither = crit("critical", { mandatoryAccreditation: false, mandatoryRenewal: false });
    expect(computeReadiness([neither], "accreditation", false).status).toBe("not_assessed");
  });

  it("passes the validation flag through and never derives ready from it", () => {
    expect(computeReadiness([crit("met")], "accreditation", false).basisValidated).toBe(false);
    expect(computeReadiness([crit("open")], "accreditation", true)).toMatchObject({ basisValidated: true, status: "action_needed" });
  });
});

describe("readinessSummary", () => {
  it("names the blocking points in German with correct singular and plural", () => {
    const one = computeReadiness([crit("met"), crit("critical")], "accreditation", false);
    expect(readinessSummary(one)).toBe("1 kritischer Punkt verhindert aktuell vollständige Readiness.");
    const two = computeReadiness([crit("critical"), crit("critical"), crit("met")], "accreditation", false);
    expect(readinessSummary(two)).toBe("2 kritische Punkte verhindern aktuell vollständige Readiness.");
    const open = computeReadiness([crit("met"), crit("open")], "accreditation", false);
    expect(readinessSummary(open)).toBe("1 Pflichtkriterium ist noch offen oder nicht bewertet.");
    const openMany = computeReadiness([crit("open"), crit("not_assessed"), crit("met")], "accreditation", false);
    expect(readinessSummary(openMany)).toBe("2 Pflichtkriterien sind noch offen oder nicht bewertet.");
    expect(readinessSummary(computeReadiness([crit("met")], "accreditation", false))).toBe("Alle Pflichtkriterien sind erfüllt.");
    expect(readinessSummary(computeReadiness([], "accreditation", false))).toBe(
      "Keine anwendbaren Kriterien im Geltungsbereich.",
    );
    expect(readinessSummary(computeReadiness([crit("not_applicable")], "accreditation", false))).toBe(
      "Keine anwendbaren Kriterien im Geltungsbereich.",
    );
    expect(readinessSummary(computeReadiness([crit("not_assessed"), crit("not_assessed")], "accreditation", false))).toBe(
      "Noch kein Kriterium bewertet.",
    );
    const shouldOnly = computeReadiness([crit("met"), should("critical")], "accreditation", false);
    expect(readinessSummary(shouldOnly)).toBe("1 Soll-Kriterium ist kritisch.");
    const openAndShould = computeReadiness([crit("met"), crit("open"), should("critical")], "accreditation", false);
    expect(readinessSummary(openAndShould)).toBe(
      "1 Pflichtkriterium ist noch offen oder nicht bewertet, zudem 1 Soll-Kriterium kritisch.",
    );
    const manyAndShould = computeReadiness(
      [crit("open"), crit("not_assessed"), should("critical"), should("critical"), crit("met")],
      "accreditation",
      false,
    );
    expect(readinessSummary(manyAndShould)).toBe(
      "2 Pflichtkriterien sind noch offen oder nicht bewertet, zudem 2 Soll-Kriterien kritisch.",
    );
  });
});

describe("progress rounding", () => {
  it("never shows 100 percent while a criterion is unmet", () => {
    const list = [...Array.from({ length: 199 }, () => crit("met")), crit("open")];
    const r = computeReadiness(list, "accreditation", false);
    expect(r.progressPercent).toBe(99);
    expect(r.status).toBe("action_needed");
  });

  it("percentOf rounds down and is exact for integer boundaries", () => {
    expect(percentOf(100, 100)).toBe(100);
    expect(percentOf(29, 100)).toBe(29);
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(2, 3)).toBe(66);
    expect(percentOf(0, 0)).toBeNull();
  });
});

describe("not applicable mandatory criteria (Henrik 2026-10-07)", () => {
  it("never yields ready when there is no applicable mandatory criterion", () => {
    const allNa = computeReadiness([crit("not_applicable"), crit("not_applicable"), should("met")], "accreditation", false);
    expect(allNa.status).toBe("not_assessed");
    expect(allNa.mandatory.total).toBe(0);
    expect(allNa.mandatory.notApplicable).toBe(2);
    const onlyShould = computeReadiness([should("met"), should("met")], "accreditation", false);
    expect(onlyShould.status).toBe("not_assessed");
  });

  it("counts not applicable mandatory criteria without changing the status of the rest", () => {
    const r = computeReadiness([crit("met"), crit("not_applicable"), crit("not_applicable")], "accreditation", false);
    expect(r.status).toBe("ready");
    expect(r.mandatory.notApplicable).toBe(2);
    expect(r.mandatory.total).toBe(1);
  });

  it("excludes not applicable criteria from the progress", () => {
    const r = computeReadiness([crit("met"), crit("not_applicable"), crit("open")], "accreditation", false);
    expect(r.progressPercent).toBe(50);
  });

  it("does not count not applicable should criteria as mandatory", () => {
    const r = computeReadiness([crit("met"), should("not_applicable")], "accreditation", false);
    expect(r.mandatory.notApplicable).toBe(0);
    expect(r.notApplicable).toBe(1);
  });

  it("explains the special case in the summary", () => {
    const r = computeReadiness([crit("not_applicable"), should("met")], "accreditation", false);
    expect(readinessSummary(r)).toBe("Keine anwendbaren Pflichtkriterien im Geltungsbereich.");
  });
});
