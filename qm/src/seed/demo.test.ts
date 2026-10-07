import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "@/db";
import { member, organization, user } from "@/db/schema";
import { listAssessments } from "@/domain/assessments";
import { listAuditEvents } from "@/domain/audit";
import { getDashboard } from "@/domain/dashboard";
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
    expect(rows.some((r) => r.status === "critical" && r.mandatory)).toBe(true);
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
    expect(dash.monthsToExpiry).toBeGreaterThan(12);
    expect(dash.chapters.map((c) => c.chapter)).toContain("Ergebnis");
  });
});
