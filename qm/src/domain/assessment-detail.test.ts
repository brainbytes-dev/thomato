import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION, criterion, criterionAssessment } from "@/db/schema";
import { getAssessmentByNumber, listCriterionHistory, setAssessmentStatus } from "./assessments";
import { importCatalog } from "./catalog";
import { ForbiddenError } from "./org-context";
import { addMemberTo, ctxFor, makeOrg, resetDb } from "@/test/helpers";

async function setup() {
  await importCatalog(db, {
    standardVersionId: ACTIVE_STANDARD_VERSION,
    label: "Entwurf",
    rows: [
      { nummer: "7.3.10", titel: "Hygiene", kapitel: "Prozess", anerkennung_muss: true, anerkennung_soll: false, erneuerung_muss: true, erneuerung_soll: false, sortierung: 1 },
    ],
  });
  const [c] = await db.select().from(criterion).where(eq(criterion.standardVersionId, ACTIVE_STANDARD_VERSION));
  const a = await makeOrg("det-a");
  const b = await makeOrg("det-b");
  return { c, a, b, ctxA: ctxFor(a.org.id, a.user.id, "owner"), ctxB: ctxFor(b.org.id, b.user.id, "owner") };
}

describe("getAssessmentByNumber", () => {
  beforeEach(resetDb);

  it("returns null for an unknown number and the not assessed default for an untouched criterion", async () => {
    const { ctxA } = await setup();
    expect(await getAssessmentByNumber(ctxA, "9.9.9")).toBeNull();
    const d = await getAssessmentByNumber(ctxA, "7.3.10");
    expect(d).toMatchObject({
      number: "7.3.10", status: "not_assessed", assessmentId: null, updatedAt: null,
      standardVersionLabel: "Entwurf", standardValidated: false, notApplicableReason: null,
    });
  });

  it("is scoped to the own organisation", async () => {
    const { c, ctxA, ctxB } = await setup();
    await setAssessmentStatus(ctxA, c.id, "critical");
    expect((await getAssessmentByNumber(ctxA, "7.3.10"))?.status).toBe("critical");
    expect((await getAssessmentByNumber(ctxB, "7.3.10"))?.status).toBe("not_assessed");
  });

  it("is readable for a viewer", async () => {
    const { a } = await setup();
    const v = await addMemberTo(a.org.id, "v", "viewer");
    await expect(getAssessmentByNumber(ctxFor(a.org.id, v.id, "viewer"), "7.3.10")).resolves.not.toBeNull();
  });
});

describe("listCriterionHistory", () => {
  beforeEach(resetDb);

  it("lists the events of one assessment newest first with the actor name", async () => {
    const { c, ctxA } = await setup();
    await setAssessmentStatus(ctxA, c.id, "open");
    await setAssessmentStatus(ctxA, c.id, "critical");
    const d = await getAssessmentByNumber(ctxA, "7.3.10");
    const history = await listCriterionHistory(ctxA, d!.assessmentId!);
    expect(history).toHaveLength(2);
    expect(history[0].after).toEqual({ status: "critical", reason: null });
    expect(history[0].actorName).toMatch(/^user-det-a/);
  });

  it("is readable for a qm_admin", async () => {
    const { c, a, ctxA } = await setup();
    await setAssessmentStatus(ctxA, c.id, "open");
    const id = (await db.select().from(criterionAssessment))[0].id;
    const u = await addMemberTo(a.org.id, "qmadmin", "qm_admin");
    await expect(listCriterionHistory(ctxFor(a.org.id, u.id, "qm_admin"), id)).resolves.toHaveLength(1);
  });

  it("is only readable with the audit right", async () => {
    const { c, a, ctxA } = await setup();
    await setAssessmentStatus(ctxA, c.id, "open");
    const id = (await db.select().from(criterionAssessment))[0].id;
    for (const role of ["reviewer", "editor", "viewer"] as const) {
      const u = await addMemberTo(a.org.id, role, role);
      await expect(listCriterionHistory(ctxFor(a.org.id, u.id, role), id)).rejects.toBeInstanceOf(ForbiddenError);
    }
  });

  it("never returns events of another organisation, even with a foreign assessment id", async () => {
    const { c, ctxA, ctxB } = await setup();
    await setAssessmentStatus(ctxA, c.id, "open");
    const id = (await db.select().from(criterionAssessment))[0].id;
    expect(await listCriterionHistory(ctxB, id)).toEqual([]);
  });
});
