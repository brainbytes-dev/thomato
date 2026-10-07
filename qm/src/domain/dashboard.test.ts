import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION, criterion, deadline } from "@/db/schema";
import type { AssessmentRow } from "./assessments";
import { setAssessmentStatus } from "./assessments";
import { importCatalog } from "./catalog";
import { buildActionItems, chapterProgress, getDashboard } from "./dashboard";
import type { DeadlineView } from "./deadlines";
import { ctxFor, makeOrg, resetDb } from "@/test/helpers";
import { eq } from "drizzle-orm";

const NOW = new Date("2026-10-07T10:00:00Z");

let k = 0;
function row(over: Partial<AssessmentRow>): AssessmentRow {
  k += 1;
  return {
    criterionId: `id${k}`,
    number: `${k}`,
    title: `Titel ${k}`,
    chapter: "Prozess",
    mandatoryAccreditation: true,
    shouldAccreditation: false,
    mandatoryRenewal: true,
    shouldRenewal: false,
    status: "not_assessed",
    dueDate: null,
    ...over,
  };
}
const dl = (over: Partial<DeadlineView>): DeadlineView => ({
  id: "d", kind: "custom", label: "Frist", dueDate: "2026-12-01", days: 55, urgency: "upcoming", ...over,
});

describe("buildActionItems", () => {
  it("ranks critical before open before not assessed and drops met, n/a and unassessed should items", () => {
    const items = buildActionItems(
      [
        row({ number: "a", status: "not_assessed" }),
        row({ number: "b", status: "open" }),
        row({ number: "c", status: "critical" }),
        row({ number: "d", status: "met" }),
        row({ number: "e", status: "not_applicable" }),
        row({ number: "f", status: "not_assessed", mandatoryAccreditation: false, shouldAccreditation: true }),
        row({ number: "g", status: "critical", mandatoryAccreditation: false, shouldAccreditation: true }),
      ],
      [],
      "accreditation",
      NOW,
    );
    expect(items.map((i) => [i.criterionNumber, i.priority])).toEqual([
      ["c", "critical"],
      ["b", "high"],
      ["g", "high"],
      ["a", "medium"],
    ]);
    expect(items[0].statusLabel).toBe("Kritisch");
  });

  it("sorts by due date within a priority, undated last, and keeps catalog order as tie-break", () => {
    const items = buildActionItems(
      [
        row({ number: "x", status: "critical" }),
        row({ number: "y", status: "critical", dueDate: "2026-10-20" }),
        row({ number: "z", status: "critical", dueDate: "2026-10-10" }),
      ],
      [],
      "accreditation",
      NOW,
    );
    expect(items.map((i) => i.criterionNumber)).toEqual(["z", "y", "x"]);
    expect(items[0].dueInDays).toBe(3);
  });

  it("turns overdue and soon deadlines into action items and ignores distant ones", () => {
    const items = buildActionItems(
      [],
      [
        dl({ id: "1", label: "Überfällig", days: -6, urgency: "overdue", dueDate: "2026-10-01" }),
        dl({ id: "2", label: "Bald", days: 13, urgency: "soon", dueDate: "2026-10-20" }),
        dl({ id: "3", label: "Heute", days: 0, urgency: "soon", dueDate: "2026-10-07" }),
        dl({ id: "4", label: "Fern", days: 90, urgency: "upcoming", dueDate: "2027-01-05" }),
      ],
      "accreditation",
      NOW,
    );
    expect(items.map((i) => [i.topic, i.priority, i.statusLabel])).toEqual([
      ["Überfällig", "critical", "Frist überschritten (seit 6 Tagen)"],
      ["Heute", "high", "Frist heute"],
      ["Bald", "high", "Frist in 13 Tagen"],
    ]);
  });
});

describe("chapterProgress", () => {
  it("groups in-scope applicable criteria by chapter in order of appearance", () => {
    const rows = [
      row({ chapter: "Antrag", status: "met" }),
      row({ chapter: "Antrag", status: "open" }),
      row({ chapter: "Struktur", status: "met" }),
      row({ chapter: "Struktur", status: "not_applicable" }),
      row({ chapter: "Ergebnis", mandatoryAccreditation: false, shouldAccreditation: false }),
    ];
    expect(chapterProgress(rows, "accreditation")).toEqual([
      { chapter: "Antrag", met: 1, applicable: 2, percent: 50 },
      { chapter: "Struktur", met: 1, applicable: 1, percent: 100 },
    ]);
  });
});

describe("getDashboard", () => {
  beforeEach(resetDb);

  async function seedCatalog() {
    const rows = ["5.2.1", "6.1", "7.3.10", "7.3.8"].map((nr, i) => ({
      nummer: nr, titel: `K ${nr}`, kapitel: i < 2 ? "Antrag" : "Prozess",
      anerkennung_muss: true, anerkennung_soll: false, erneuerung_muss: true, erneuerung_soll: false,
      sortierung: 100 + i,
    }));
    await importCatalog(db, { standardVersionId: ACTIVE_STANDARD_VERSION, label: "t", rows });
    const crits = await db.select().from(criterion).where(eq(criterion.standardVersionId, ACTIVE_STANDARD_VERSION)).orderBy(criterion.sortOrder);
    return crits;
  }

  it("derives status, progress, actions and deadlines from the persisted data of the own organisation only", async () => {
    const crits = await seedCatalog();
    const a = await makeOrg("dash-a");
    const b = await makeOrg("dash-b");
    const ctxA = ctxFor(a.org.id, a.user.id, "owner");
    const ctxB = ctxFor(b.org.id, b.user.id, "owner");
    await setAssessmentStatus(ctxA, crits[0].id, "met");
    await setAssessmentStatus(ctxA, crits[1].id, "met");
    await setAssessmentStatus(ctxA, crits[2].id, "critical");
    await db.insert(deadline).values([
      { organizationId: a.org.id, kind: "application", label: "Antrag", dueDate: "2026-10-20" },
      { organizationId: a.org.id, kind: "expiry", label: "Ablauf", dueDate: "2028-06-30" },
    ]);

    const dashA = await getDashboard(ctxA, NOW);
    expect(dashA.readiness.status).toBe("critical");
    expect(dashA.readiness.progressPercent).toBe(50);
    expect(dashA.readiness.basisValidated).toBe(false);
    expect(dashA.actions[0]).toMatchObject({ criterionNumber: "7.3.10", priority: "critical" });
    expect(dashA.deadlines.map((d) => d.label)).toEqual(["Antrag", "Ablauf"]);
    expect(dashA.expiry).toEqual({ kind: "months", months: 20 });
    expect(dashA.overdueCount).toBe(0);
    expect(dashA.soonCount).toBe(1);

    const dashB = await getDashboard(ctxB, NOW);
    expect(dashB.readiness.status).toBe("not_assessed");
    expect(dashB.deadlines).toEqual([]);
    expect(dashB.expiry).toBeNull();
    expect(dashB.overdueCount).toBe(0);
    expect(dashB.actions).toHaveLength(4);
    expect(dashB.actions.every((i) => i.source === "criterion" && i.priority === "medium")).toBe(true);
  });

  it("is readable for a viewer", async () => {
    await seedCatalog();
    const a = await makeOrg("dash-v", "viewer");
    await expect(getDashboard(ctxFor(a.org.id, a.user.id, "viewer"), NOW)).resolves.toBeDefined();
  });

  it("a mandatory critical item is never hidden by high progress", async () => {
    const crits = await seedCatalog();
    const a = await makeOrg("dash-c");
    const ctx = ctxFor(a.org.id, a.user.id, "owner");
    for (const c of crits.slice(0, 3)) await setAssessmentStatus(ctx, c.id, "met");
    await setAssessmentStatus(ctx, crits[3].id, "critical");
    const dash = await getDashboard(ctx, NOW);
    expect(dash.readiness.progressPercent).toBe(75);
    expect(dash.readiness.status).toBe("critical");
    expect(dash.actions[0]).toMatchObject({ priority: "critical", criterionNumber: "7.3.8", source: "criterion" });
  });

  it("reports an expired expiry deadline without changing the readiness status", async () => {
    const crits = await seedCatalog();
    const a = await makeOrg("dash-e");
    const ctx = ctxFor(a.org.id, a.user.id, "owner");
    for (const c of crits) await setAssessmentStatus(ctx, c.id, "met");
    await db.insert(deadline).values([
      { organizationId: a.org.id, kind: "expiry", label: "Alt", dueDate: "2025-01-01" },
      { organizationId: a.org.id, kind: "expiry", label: "Abgelaufen", dueDate: "2026-09-27" },
    ]);
    const dash = await getDashboard(ctx, NOW);
    expect(dash.expiry).toEqual({ kind: "expired", days: 10 });
    expect(dash.overdueCount).toBe(2);
    expect(dash.readiness.status).toBe("ready");
  });

  it("prefers the nearest future expiry over a past one", async () => {
    await seedCatalog();
    const a = await makeOrg("dash-f");
    const ctx = ctxFor(a.org.id, a.user.id, "owner");
    await db.insert(deadline).values([
      { organizationId: a.org.id, kind: "expiry", label: "Vorher", dueDate: "2026-09-01" },
      { organizationId: a.org.id, kind: "expiry", label: "Spät", dueDate: "2028-06-30" },
      { organizationId: a.org.id, kind: "expiry", label: "Früher", dueDate: "2027-10-07" },
    ]);
    const dash = await getDashboard(ctx, NOW);
    expect(dash.expiry).toEqual({ kind: "months", months: 12 });
  });

  it("lets the catalog order decide between equal priority and equal due date", async () => {
    const crits = await seedCatalog();
    const a = await makeOrg("dash-g");
    const ctx = ctxFor(a.org.id, a.user.id, "owner");
    await setAssessmentStatus(ctx, crits[3].id, "critical");
    await setAssessmentStatus(ctx, crits[1].id, "critical");
    const dash = await getDashboard(ctx, NOW);
    expect(dash.actions.slice(0, 2).map((i) => i.criterionNumber)).toEqual(["6.1", "7.3.8"]);
  });
});
