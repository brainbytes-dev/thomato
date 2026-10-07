import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "@/db";
import { member, organization } from "@/db/schema";
import { listAssessments } from "@/domain/assessments";
import { listAuditEvents } from "@/domain/audit";
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
    expect(await db.select().from(member)).toHaveLength(5);
    expect(Object.keys(out.users).sort()).toEqual(
      ["editor", "owner", "qm_admin", "reviewer", "viewer"],
    );
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
  });
});
