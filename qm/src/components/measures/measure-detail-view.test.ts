import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HistoryItem } from "@/components/criteria/history-timeline";
import type { MeasurePhase, ReviewResult } from "@/db/schema";
import { allowedMeasureActions, type MeasureDetail, type ReviewView } from "@/domain/measure-pdca";
import { ROLES, type Role } from "@/domain/rights";
import { MeasureDetailView } from "./measure-detail-view";
import { phaseStates } from "./pdca-copy";

type Stage = MeasurePhase | "done";
const ID = "3f2b8c1e-5d4a-4e6b-9a7c-1b2c3d4e5f60";

const review = (over: Partial<ReviewView> = {}): ReviewView => ({
  id: "r1", cycle: 1, result: "effective", note: "Wirkung belegt", checkedAt: new Date("2026-10-01T09:00:00Z"),
  checkedByName: "Rita Reviewer", ...over,
});

function detailFor(role: Role, stage: Stage, over: Partial<MeasureDetail> = {}, cycle = 1): MeasureDetail {
  const phase: MeasurePhase = stage === "done" ? "act" : stage;
  const status = stage === "done" ? "done" : stage === "plan" ? "open" : "in_progress";
  const reviewed = stage === "act" || stage === "done";
  const last = reviewed ? review() : null;
  return {
    measure: {
      id: ID, criterionNumber: "7.3.10", title: "Desinfektion schulen", description: "Händehygiene wird nicht einheitlich umgesetzt.",
      ownerUserId: "u1", ownerName: "Beat Beispiel", dueDate: "2026-12-01", status, phase, cycle,
      completedAt: stage === "done" ? new Date("2026-10-05T10:00:00Z") : null, createdAt: new Date("2026-09-01T08:00:00Z"),
      days: 54, overdue: false, criterionTitle: "Hygiene", effectivenessCriterion: "Keine Beanstandung im Audit",
    },
    steps: phase === "plan" ? [] : [
      { id: "s1", position: 1, title: "Schulung planen", done: true, doneAt: new Date("2026-09-10T08:00:00Z"), doneByName: "Beat Beispiel" },
      { id: "s2", position: 2, title: "Schulung durchführen", done: phase !== "do", doneAt: phase !== "do" ? new Date("2026-09-20T08:00:00Z") : null, doneByName: phase !== "do" ? "Beat Beispiel" : null },
    ],
    reviewsByCycle: last ? [{ cycle: 1, reviews: [last] }] : [],
    lastReview: last,
    allowedActions: allowedMeasureActions(role, { phase, status }),
    ...over,
  };
}

const html = (d: MeasureDetail, history: HistoryItem[] | null = null) =>
  renderToStaticMarkup(createElement(MeasureDetailView, { detail: d, history }));

const MARKERS = {
  completePlan: "Plan abschliessen",
  criterionForm: 'name="effectivenessCriterion"',
  addStep: "Schritt hinzufügen",
  completeDo: "Do abschliessen",
  review: "Bewertung festhalten",
  close: "Massnahme abschliessen",
  refine: "Nachschärfen</button>",
  newCycle: "Neuen Zyklus starten</button>",
  reopen: "Wiedereröffnen</button>",
} as const;

const WRITE: Role[] = ["owner", "qm_admin", "reviewer", "editor"];
const APPROVE: Role[] = ["owner", "qm_admin", "reviewer"];

describe("role x phase: which actions render", () => {
  const stages: Stage[] = ["plan", "do", "check", "act", "done"];
  const expected: Record<Stage, { roles: Role[]; markers: (keyof typeof MARKERS)[] }> = {
    plan: { roles: WRITE, markers: ["completePlan", "criterionForm"] },
    do: { roles: WRITE, markers: ["addStep", "completeDo", "criterionForm"] },
    check: { roles: APPROVE, markers: ["review"] },
    act: { roles: APPROVE, markers: ["close", "refine", "newCycle"] },
    done: { roles: APPROVE, markers: ["reopen"] },
  };

  for (const stage of stages) {
    for (const role of ROLES) {
      it(`${role} in ${stage}`, () => {
        const out = html(detailFor(role, stage));
        const allowed = expected[stage].roles.includes(role);
        for (const key of Object.keys(MARKERS) as (keyof typeof MARKERS)[]) {
          const shouldShow = allowed && expected[stage].markers.includes(key);
          expect(out.includes(MARKERS[key]), `${role}/${stage}/${key}`).toBe(shouldShow);
        }
        expect(out.includes("schreibgeschützt"), "read-only note").toBe(!allowed);
      });
    }
  }
});

describe("stepper", () => {
  it("names every phase state in words, never colour alone", () => {
    const out = html(detailFor("owner", "check"));
    expect(out).toContain("Abgeschlossen");
    expect(out).toContain("Aktiv");
    expect(out).toContain("Ausstehend");
    expect(out).toContain('aria-current="step"');
  });

  it("derives the states from phase and status", () => {
    expect(phaseStates({ phase: "do", status: "in_progress" })).toEqual({ plan: "done", do: "active", check: "pending", act: "pending" });
    expect(phaseStates({ phase: "act", status: "done" })).toEqual({ plan: "done", do: "done", check: "done", act: "done" });
  });

  it("shows the cycle badge and no measure id", () => {
    const out = html(detailFor("owner", "do", {}, 2));
    expect(out).toContain("Zyklus 2");
    expect(out).not.toContain(`>${ID}<`);
  });
});

describe("checklist", () => {
  it("is read-only outside Do and shows progress", () => {
    const out = html(detailFor("owner", "check"));
    expect(out).toContain("2 von 2 erledigt");
    expect(out).not.toContain("Schritt hinzufügen");
    expect(out).toContain("disabled");
  });

  it("is editable in Do with move, rename and remove controls", () => {
    const out = html(detailFor("editor", "do"));
    expect(out).toContain("1 von 2 erledigt");
    expect(out).toContain("Nach oben: Schulung planen");
    expect(out).toContain("Umbenennen: Schulung durchführen");
    expect(out).toContain("Entfernen: Schulung planen");
  });

  it("shows an empty state without steps", () => {
    expect(html(detailFor("editor", "do", { steps: [] }))).toContain("Noch keine Schritte");
    expect(html(detailFor("viewer", "do", { steps: [] }))).toContain("Es gibt keine Schritte");
  });

  it("offers the confirmation checkbox only without steps", () => {
    expect(html(detailFor("editor", "do", { steps: [] }))).toContain('name="confirmNoSteps"');
    expect(html(detailFor("editor", "do"))).not.toContain('name="confirmNoSteps"');
  });
});

describe("effectiveness reviews grouped by cycle", () => {
  const two = (): MeasureDetail => {
    const r1 = review({ id: "r1", cycle: 1, result: "not_effective", note: "Ziel verfehlt im ersten Zyklus" });
    const r2 = review({ id: "r2", cycle: 2, result: "effective", note: "Ziel im zweiten Zyklus erreicht", checkedAt: new Date("2026-10-06T09:00:00Z") });
    return detailFor("owner", "act", { reviewsByCycle: [{ cycle: 1, reviews: [r1] }, { cycle: 2, reviews: [r2] }], lastReview: r2 }, 2);
  };

  it("lists the newest cycle first and keeps older reviews visible", () => {
    const out = html(two());
    expect(out.indexOf("Zyklus 2")).toBeLessThan(out.indexOf("Ziel im zweiten Zyklus erreicht"));
    expect(out.indexOf("Ziel im zweiten Zyklus erreicht")).toBeLessThan(out.indexOf("Ziel verfehlt im ersten Zyklus"));
    expect(out).toContain("Nicht wirksam");
    expect(out).toContain("Rita Reviewer");
    expect(out).toContain("aktuell");
  });

  it("shows the current cycle without reviews after a new cycle started", () => {
    const r1 = review({ cycle: 1, result: "partly", note: "Teilweise erreicht" });
    const out = html(detailFor("owner", "plan", { reviewsByCycle: [{ cycle: 1, reviews: [r1] }], lastReview: r1 }, 2));
    expect(out.indexOf("Zyklus 2")).toBeLessThan(out.indexOf("Teilweise erreicht"));
    expect(out).toContain("In diesem Zyklus gibt es noch keine Bewertung");
  });

  it("shows several reviews of one cycle after refining, newest first", () => {
    const a = review({ id: "a", result: "partly", note: "Erste Bewertung" });
    const b = review({ id: "b", result: "effective", note: "Zweite Bewertung", checkedAt: new Date("2026-10-04T09:00:00Z") });
    const out = html(detailFor("owner", "act", { reviewsByCycle: [{ cycle: 1, reviews: [a, b] }], lastReview: b }));
    expect(out.indexOf("Zweite Bewertung")).toBeLessThan(out.indexOf("Erste Bewertung"));
  });

  it("shows an empty state before the first review", () => {
    expect(html(detailFor("owner", "do"))).toContain("Noch keine Wirksamkeitsprüfung");
  });
});

describe("act decision", () => {
  const act = (result: ReviewResult) => html(detailFor("owner", "act", { lastReview: review({ result }) }));

  it("requires a reason for partly and not_effective and explains the rule", () => {
    for (const r of ["partly", "not_effective"] as const) {
      const out = act(r);
      expect(out).toContain("Begründung (Pflicht");
      expect(out).toContain("required");
      expect(out).toContain("Act schliesst nie automatisch");
    }
  });

  it("keeps the reason optional for effective but still never closes automatically", () => {
    const out = act("effective");
    expect(out).toContain("Begründung (optional");
    expect(out).toContain("Act schliesst nie automatisch");
  });

  it("explains each of the three actions", () => {
    const out = act("effective");
    expect(out).toContain("Zurück in die Phase Do im selben Zyklus");
    expect(out).toContain("Zyklus 2");
    expect(out).toContain("bleiben unverändert erhalten");
  });
});

describe("review form", () => {
  it("offers the three results in words and a note", () => {
    const out = html(detailFor("reviewer", "check"));
    for (const w of ["Wirksam", "Teilweise wirksam", "Nicht wirksam"]) expect(out).toContain(w);
    expect(out).toContain('name="note"');
    expect(out).toContain("kann nicht mehr geändert werden");
  });
});

describe("history and always-present regions", () => {
  const entry: HistoryItem = {
    id: "e1", createdAt: new Date("2026-10-02T08:00:00Z"), eventType: "measure.phase_changed", actorName: "Beat Beispiel",
    before: { title: "Desinfektion schulen", phase: "plan" }, after: { title: "Desinfektion schulen", phase: "do" },
  };

  it("renders the timeline only with history data", () => {
    expect(html(detailFor("owner", "do"), [entry])).toContain("Verlauf der Massnahme");
    expect(html(detailFor("owner", "do"), [entry])).toContain("Phase von «Plan» auf «Do»");
    expect(html(detailFor("editor", "do"), null)).not.toContain("Verlauf der Massnahme");
    expect(html(detailFor("owner", "do"), [])).toContain("Noch keine Änderungen");
  });

  it("keeps status and alert regions in the DOM", () => {
    const out = html(detailFor("owner", "do"));
    expect(out).toContain('role="status"');
    expect(out).toContain('role="alert"');
  });

  it("handles a missing description, criterion and owner", () => {
    const base = detailFor("viewer", "plan");
    const out = html({ ...base, measure: { ...base.measure, description: null, effectivenessCriterion: null, ownerName: null } });
    expect(out).toContain("Es wurde keine Beschreibung erfasst");
    expect(out).toContain("Es wurde kein Wirksamkeitskriterium festgehalten");
    expect(out).toContain("unbekannt");
  });

  it("states overdue wording in words", () => {
    const base = detailFor("viewer", "do");
    const out = html({ ...base, measure: { ...base.measure, overdue: true, days: -3 } });
    expect(out).toContain("seit 3 Tagen überfällig");
    expect(out).toContain("Überfällig");
  });
});

describe("page and client files", () => {
  it("the page turns service not-found errors into notFound and gates history by the audit right", () => {
    const source = readFileSync(join(process.cwd(), "src/app/(app)/measures/[id]/page.tsx"), "utf8");
    expect(source).toContain("notFound()");
    expect(source).toContain("ValidationError");
    expect(source).toContain('can(ctx.role, "audit", "read")');
  });

  it("the client forms stay free of server modules", () => {
    const source = readFileSync(join(process.cwd(), "src/components/measures/pdca-forms.tsx"), "utf8");
    expect(source).toContain('"use client"');
    const valueImports = source.split("\n").filter((l) => /^import\s/.test(l) && !/^import\s+type\s/.test(l));
    for (const line of valueImports) {
      expect(line).not.toMatch(/["']@\/db(\/[\w-]+)?["']/);
      expect(line).not.toMatch(/["']@\/domain\/[\w-]+["']/);
    }
  });
});
