import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "@/db";
import { member, organization, user } from "@/db/schema";
import { listAssessments, setAssessmentStatus } from "@/domain/assessments";
import { listAuditEvents } from "@/domain/audit";
import { DEFAULT_PROCEDURE, getDashboard } from "@/domain/dashboard";
import { addDays, zurichDate } from "@/domain/dates";
import { addDocumentVersion, listCriterionEvidence } from "@/domain/documents";
import { buildDemoPdf } from "./demo-documents";
import { scopeOf } from "@/domain/readiness";
import { resetDb } from "@/test/helpers";
import { seedDemo } from "./demo";

const catalog: unknown = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../../web/ivr/demo/kriterien.json"), "utf8"),
);

describe("seedDemo", () => {
  beforeEach(resetDb);

  it("creates a labelled demo organisation with all five roles", async () => {
    const out = await seedDemo({ catalog });
    const [org] = await db.select().from(organization);
    expect(org.name).toContain("Demo");
    const dbRoles = (await db.select().from(member)).map((m) => m.role).sort();
    expect(dbRoles).toEqual(["editor", "owner", "qm_admin", "reviewer", "viewer"]);
    expect(Object.keys(out.users).sort()).toEqual(dbRoles);
  });

  it("leaves a story: critical mandatory items and untouched criteria", async () => {
    await seedDemo({ catalog });
    const [org] = await db.select().from(organization);
    const owner = (await db.select().from(member)).find((m) => m.role === "owner");
    const ctx = { organizationId: org.id, userId: owner!.userId, role: "owner" as const };
    const rows = await listAssessments(ctx);
    expect(rows.some((r) => r.status === "critical" && scopeOf(r, DEFAULT_PROCEDURE).mandatory)).toBe(true);
    expect(rows.some((r) => r.status === "not_assessed")).toBe(true);
    expect((await listAuditEvents(ctx)).length).toBeGreaterThan(0);
  });

  it("is repeatable", async () => {
    await seedDemo({ catalog });
    await seedDemo({ catalog });
    expect(await db.select().from(organization)).toHaveLength(1);
    expect(await db.select().from(member)).toHaveLength(5);
    expect(await db.select().from(user)).toHaveLength(5);
  });
});

describe("seedDemo dashboard story", () => {
  beforeEach(resetDb);
  const NOW = new Date("2026-10-07T10:00:00Z");

  it("shows high progress but critical readiness, with deadlines and dated critical items", async () => {
    await seedDemo({ catalog, now: NOW });
    const [org] = await db.select().from(organization);
    const owner = (await db.select().from(member)).find((m) => m.role === "owner");
    const ctx = { organizationId: org.id, userId: owner!.userId, role: "owner" as const };
    const dash = await getDashboard(ctx, NOW);
    expect(dash.readiness.status).toBe("critical");
    expect(dash.readiness.progressPercent).toBeGreaterThan(50);
    expect(dash.readiness.mandatory.critical).toBe(2);
    expect(dash.deadlines.map((d) => d.kind).sort()).toEqual(["application", "custom", "dossier", "expiry"]);
    const critical = dash.actions.filter((a) => a.priority === "critical" && a.source === "criterion");
    expect(critical.map((a) => a.criterionNumber).sort()).toEqual(["6.3.2", "7.3.10"]);
    expect(critical.every((a) => a.dueInDays !== null && a.dueInDays > 0)).toBe(true);
    expect(dash.expiry?.kind).toBe("months");
    expect(dash.expiry?.kind === "months" && dash.expiry.months).toBeGreaterThan(12);
    expect(dash.chapters.map((c) => c.chapter)).toContain("Ergebnis");
    expect(dash.readiness.mandatory.notApplicable).toBe(2);
    const na = (await listAssessments(ctx)).filter((r) => r.status === "not_applicable");
    expect(na.map((r) => r.number).sort()).toEqual(["6.10", "7.9"]);
    expect(na.every((r) => (r.notApplicableReason ?? "").length >= 10)).toBe(true);
  });
});

describe("seedDemo evidence story", () => {
  beforeEach(resetDb);
  const NOW = new Date("2026-10-07T10:00:00Z");

  async function setup() {
    await seedDemo({ catalog, now: NOW });
    const [org] = await db.select().from(organization);
    const owner = (await db.select().from(member)).find((m) => m.role === "owner");
    const ctx = { organizationId: org.id, userId: owner!.userId, role: "owner" as const };
    return ctx;
  }

  it("seeds seven demo documents with the expected evidence picture", async () => {
    const ctx = await setup();
    const dash = await getDashboard(ctx, NOW);
    expect(dash.evidence.stale).toBe(2);
    expect(dash.evidence.current).toBeGreaterThanOrEqual(4);
    const items = dash.actions.filter((a) => a.source === "evidence");
    const stale = items.filter((a) => a.statusLabel === "Nachweis veraltet").map((a) => a.criterionNumber).sort();
    expect(stale).toEqual(["7.3.10", "7.3.9"]);
    expect(items.some((a) => /erfüllte Pflichtkriterien ohne Nachweis$/.test(a.topic))).toBe(true);
    expect(dash.readiness.status).toBe("critical");
    expect(dash.readiness.mandatory.critical).toBe(2);

    const vehicle = await listCriterionEvidence(ctx, "7.3.8", NOW);
    expect(vehicle.docs).toHaveLength(1);
    expect(vehicle.docs[0].versions).toHaveLength(2);
    expect(vehicle.docs[0].latest.versionNumber).toBe(2);
    expect(vehicle.docs[0].latest.current).toBe(true);
    expect((await listCriterionEvidence(ctx, "6.3.2", NOW)).state).toBe("none");
  });

  it("replacing the stale evidence changes neither status nor readiness; only the assessment does", async () => {
    const ctx = await setup();
    const rows = await listAssessments(ctx);
    const id7310 = rows.find((r) => r.number === "7.3.10")!.criterionId;
    const before = await getDashboard(ctx, NOW);
    expect(before.actions.some((a) => a.criterionNumber === "7.3.10" && a.statusLabel === "Nachweis veraltet")).toBe(true);

    const stale = (await listCriterionEvidence(ctx, "7.3.10", NOW)).docs[0];
    expect(stale.state).toBe("stale");
    await addDocumentVersion(ctx, stale.documentId, {
      file: { name: "hygienekonzept-v2.pdf", bytes: buildDemoPdf("Hygienekonzept (Demo)", ["Version 2"]) },
      validUntil: addDays(zurichDate(NOW), 365),
    });

    expect((await listCriterionEvidence(ctx, "7.3.10", NOW)).state).toBe("current");
    const after = await getDashboard(ctx, NOW);
    expect(after.evidence.stale).toBe(1);
    expect(after.actions.some((a) => a.criterionNumber === "7.3.10" && a.statusLabel === "Nachweis veraltet")).toBe(false);
    expect(after.readiness.status).toBe("critical");
    expect(after.readiness.mandatory.critical).toBe(2);
    expect((await listAssessments(ctx)).find((r) => r.number === "7.3.10")!.status).toBe("critical");

    await setAssessmentStatus(ctx, id7310, "met");
    const met = await getDashboard(ctx, NOW);
    expect(met.readiness.mandatory.critical).toBe(1);
  });
});
