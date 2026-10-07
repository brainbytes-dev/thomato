import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION, criterion, deadline } from "@/db/schema";
import type { AssessmentRow } from "./assessments";
import { listAssessments, setAssessmentStatus } from "./assessments";
import { filterCriteria } from "./criteria-filter";
import { importCatalog } from "./catalog";
import { buildActionItems, chapterProgress, getDashboard, selectActionItems, type ActionItem } from "./dashboard";
import { createDocument, getEvidenceInfo } from "./documents";
import type { DeadlineView } from "./deadlines";
import { ctxFor, makeOrg, resetDb } from "@/test/helpers";
import { eq } from "drizzle-orm";

const NOW = new Date("2026-10-07T10:00:00Z");
const pdf = (text: string) => ({ name: "k.pdf", bytes: Buffer.from(`%PDF-1.4\n${text}`) });
const NO_EVIDENCE = { stale: [], missingMet: 0 };

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
    notApplicableReason: null,
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
      NO_EVIDENCE,
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
      NO_EVIDENCE,
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
      NO_EVIDENCE,
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

describe("buildActionItems with evidence", () => {
  it("adds one high item per stale criterion with the expiry date and a criterion link", () => {
    const items = buildActionItems(
      [row({ number: "7.3.10", status: "met" })],
      [],
      {
        stale: [
          { number: "7.3.10", title: "Hygiene", validUntil: "2026-09-30" },
          { number: "6.1", title: "Antrag/Ablauf", validUntil: "2026-01-15" },
        ],
        missingMet: 0,
      },
      "accreditation",
      NOW,
    );
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.criterionNumber)).toEqual(["6.1", "7.3.10"]);
    expect(items[1]).toMatchObject({
      priority: "high",
      statusLabel: "Nachweis veraltet",
      topic: "7.3.10 Hygiene",
      dueDate: "2026-09-30",
      dueInDays: -7,
      href: "/criteria/7.3.10",
      source: "evidence",
    });
    expect(items[0].href).toBe("/criteria/6.1");
  });

  it("bundles met mandatory criteria without evidence into exactly one medium item, singular for one", () => {
    const plural = buildActionItems([], [], { stale: [], missingMet: 3 }, "accreditation", NOW);
    expect(plural).toEqual([
      {
        key: "evidence:missing",
        priority: "medium",
        criterionNumber: null,
        topic: "3 erfüllte Pflichtkriterien ohne Nachweis",
        dueDate: null,
        dueInDays: null,
        statusLabel: "Nachweis fehlt",
        href: "/criteria?status=met&evidence=none&scope=mandatory",
        source: "evidence",
      },
    ]);
    const single = buildActionItems([], [], { stale: [], missingMet: 1 }, "accreditation", NOW);
    expect(single[0].topic).toBe("1 erfülltes Pflichtkriterium ohne Nachweis");
    expect(buildActionItems([], [], NO_EVIDENCE, "accreditation", NOW)).toEqual([]);
  });

  it("keeps critical before high before medium across criteria, deadlines and evidence", () => {
    const items = buildActionItems(
      [row({ number: "c", status: "critical" }), row({ number: "m", status: "not_assessed" })],
      [dl({ id: "1", label: "Heute", days: 0, urgency: "soon", dueDate: "2026-10-07" })],
      { stale: [{ number: "s", title: "Alt", validUntil: "2026-05-01" }], missingMet: 2 },
      "accreditation",
      NOW,
    );
    expect(items.map((i) => [i.source, i.priority])).toEqual([
      ["criterion", "critical"],
      ["evidence", "high"],
      ["deadline", "high"],
      ["criterion", "medium"],
      ["evidence", "medium"],
    ]);
    expect(items.find((i) => i.source === "deadline")?.href).toBeNull();
    expect(items.find((i) => i.criterionNumber === "c")?.href).toBe("/criteria/c");
  });

  it("encodes criterion numbers in links", () => {
    const [item] = buildActionItems([row({ number: "a/b c", status: "critical" })], [], NO_EVIDENCE, "accreditation", NOW);
    expect(item.href).toBe("/criteria/a%2Fb%20c");
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

  it("counts evidence over applicable mandatory criteria, adds stale and bundled items, and leaves readiness untouched", async () => {
    const crits = await seedCatalog();
    const a = await makeOrg("dash-ev-a");
    const b = await makeOrg("dash-ev-b");
    const ctxA = ctxFor(a.org.id, a.user.id, "owner");
    const ctxB = ctxFor(b.org.id, b.user.id, "owner");
    await setAssessmentStatus(ctxA, crits[0].id, "met"); // 5.2.1, ohne Nachweis
    await setAssessmentStatus(ctxA, crits[1].id, "met"); // 6.1, aktueller Nachweis
    await setAssessmentStatus(ctxA, crits[2].id, "met"); // 7.3.10, veralteter Nachweis
    await setAssessmentStatus(ctxA, crits[3].id, "not_applicable", { reason: "Im Betrieb nicht vorhanden" }); // 7.3.8

    const before = await getDashboard(ctxA, NOW);
    expect(before.evidence).toEqual({ current: 0, stale: 0, missing: 3 });

    await createDocument(ctxA, { title: "Hygienekonzept", file: pdf("a"), validUntil: "2026-03-01", criterionNumbers: ["7.3.10"] });
    await createDocument(ctxA, { title: "Hygienekonzept alt", file: pdf("b"), validUntil: "2026-06-30", criterionNumbers: ["7.3.10"] });
    await createDocument(ctxA, { title: "Antrag", file: pdf("c"), validUntil: null, criterionNumbers: ["6.1"] });
    await createDocument(ctxA, { title: "Nicht anwendbar", file: pdf("d"), validUntil: null, criterionNumbers: ["7.3.8"] });

    const after = await getDashboard(ctxA, NOW);
    expect(after.evidence).toEqual({ current: 1, stale: 1, missing: 1 });
    expect(after.readiness).toEqual(before.readiness);
    const evidenceItems = after.actions.filter((i) => i.source === "evidence");
    expect(evidenceItems).toHaveLength(2);
    expect(evidenceItems[0]).toMatchObject({
      criterionNumber: "7.3.10", priority: "high", dueDate: "2026-06-30", href: "/criteria/7.3.10", statusLabel: "Nachweis veraltet",
    });
    expect(evidenceItems[1]).toMatchObject({
      priority: "medium", topic: "1 erfülltes Pflichtkriterium ohne Nachweis", href: "/criteria?status=met&evidence=none&scope=mandatory",
    });

    const dashB = await getDashboard(ctxB, NOW);
    expect(dashB.evidence).toEqual({ current: 0, stale: 0, missing: 4 });
    expect(dashB.actions.some((i) => i.source === "evidence")).toBe(false);
  });

  it("bundled missing-evidence number equals the rows of its scoped link, even with a non-mandatory met criterion", async () => {
    const crits = await seedCatalog();
    await db.update(criterion).set({ mandatoryAccreditation: false, shouldAccreditation: true }).where(eq(criterion.id, crits[3].id));
    const a = await makeOrg("dash-scope");
    const ctx = ctxFor(a.org.id, a.user.id, "owner");
    for (const c of crits) await setAssessmentStatus(ctx, c.id, "met");
    const dash = await getDashboard(ctx, NOW);
    const item = dash.actions.find((i) => i.key === "evidence:missing");
    expect(item?.topic).toBe("3 erfüllte Pflichtkriterien ohne Nachweis");
    const rows = filterCriteria(
      await listAssessments(ctx),
      { status: "met", evidence: "none", scope: "mandatory" },
      await getEvidenceInfo(ctx, NOW),
    );
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.number)).not.toContain("7.3.8");
    expect(filterCriteria(await listAssessments(ctx), { status: "met", evidence: "none", scope: "all" }, new Map())).toHaveLength(4);
  });

  it("does not count evidence items as due, but still counts due criteria and deadlines", async () => {
    const crits = await seedCatalog();
    const a = await makeOrg("dash-soon");
    const ctx = ctxFor(a.org.id, a.user.id, "owner");
    for (const c of crits) await setAssessmentStatus(ctx, c.id, "met");
    await createDocument(ctx, { title: "Alt", file: pdf("x"), validUntil: "2026-01-01", criterionNumbers: ["5.2.1"] });
    const only = await getDashboard(ctx, NOW);
    expect(only.actions.some((i) => i.source === "evidence" && i.dueInDays !== null && i.dueInDays < 0)).toBe(true);
    expect(only.actions.every((i) => i.source === "evidence")).toBe(true);
    expect(only.soonCount).toBe(0);
    await db.insert(deadline).values({ organizationId: a.org.id, kind: "application", label: "Antrag", dueDate: "2026-10-20" });
    expect((await getDashboard(ctx, NOW)).soonCount).toBe(1);
  });
});

describe("selectActionItems", () => {
  const item = (key: string, source: ActionItem["source"] = "criterion"): ActionItem => ({
    key,
    priority: "medium",
    criterionNumber: null,
    topic: key,
    dueDate: null,
    dueInDays: null,
    statusLabel: "x",
    href: null,
    source,
  });
  const bundled = () => item("evidence:missing", "evidence");
  const keys = (l: ActionItem[]) => l.map((i) => i.key);

  it("slices plainly without a bundled item", () => {
    const list = ["a", "b", "c", "d"].map((k) => item(k));
    expect(keys(selectActionItems(list, 3))).toEqual(["a", "b", "c"]);
  });

  it("leaves the list unchanged when the bundled item is within the limit", () => {
    const list = [item("a"), bundled(), item("c"), item("d")];
    expect(keys(selectActionItems(list, 3))).toEqual(["a", "evidence:missing", "c"]);
  });

  it("lets the bundled item replace the last slot when it would be cut", () => {
    const list = [item("a"), item("b"), item("c"), item("d"), bundled()];
    expect(keys(selectActionItems(list, 3))).toEqual(["a", "b", "evidence:missing"]);
  });

  it("keeps only the bundled item for limit 1", () => {
    const list = [item("a"), item("b"), bundled()];
    expect(keys(selectActionItems(list, 1))).toEqual(["evidence:missing"]);
    expect(keys(selectActionItems([item("a"), item("b")], 1))).toEqual(["a"]);
  });

  it("returns nothing for limit 0 or below and for an empty list", () => {
    expect(selectActionItems([item("a"), bundled()], 0)).toEqual([]);
    expect(selectActionItems([item("a")], -2)).toEqual([]);
    expect(selectActionItems([], 10)).toEqual([]);
  });

  it("returns the bundled item when it is the only one", () => {
    expect(keys(selectActionItems([bundled()], 10))).toEqual(["evidence:missing"]);
    expect(keys(selectActionItems([bundled()], 1))).toEqual(["evidence:missing"]);
  });
});
