import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION, criterion, criterionAssessment } from "@/db/schema";
import { listAssessments, setAssessmentDueDate, setAssessmentStatus } from "./assessments";
import { listAuditEvents } from "./audit";
import { importCatalog } from "./catalog";
import { ForbiddenError, ValidationError } from "./org-context";
import { addMemberTo, ctxFor, makeOrg, resetDb } from "@/test/helpers";

const REASON = "Der Rettungsdienst betreibt keinen Rettungshelikopter.";

async function setup() {
  await importCatalog(db, {
    standardVersionId: ACTIVE_STANDARD_VERSION,
    label: "t",
    rows: [
      { nummer: "7.9", titel: "Helikopter", kapitel: "Prozess", anerkennung_muss: true, anerkennung_soll: false, erneuerung_muss: true, erneuerung_soll: false, sortierung: 1 },
    ],
  });
  const [c] = await db.select().from(criterion).where(eq(criterion.standardVersionId, ACTIVE_STANDARD_VERSION));
  const a = await makeOrg("na-a");
  const b = await makeOrg("na-b");
  return { c, a, b, ctxA: ctxFor(a.org.id, a.user.id, "owner"), ctxB: ctxFor(b.org.id, b.user.id, "owner") };
}

describe("not applicable needs a reason", () => {
  beforeEach(resetDb);

  it.each([undefined, null, "", "   ", "zu kurz", "x".repeat(501)])("rejects reason %j without writing anything", async (reason) => {
    const { c, ctxA } = await setup();
    await expect(setAssessmentStatus(ctxA, c.id, "not_applicable", { reason })).rejects.toBeInstanceOf(ValidationError);
    expect(await db.select().from(criterionAssessment)).toHaveLength(0);
    expect(await listAuditEvents(ctxA)).toHaveLength(0);
  });

  it("stores the trimmed reason and audits actor, before and after", async () => {
    const { c, ctxA } = await setup();
    await setAssessmentStatus(ctxA, c.id, "open");
    await setAssessmentStatus(ctxA, c.id, "not_applicable", { reason: `  ${REASON}  ` });
    const rows = await listAssessments(ctxA);
    expect(rows[0]).toMatchObject({ status: "not_applicable", notApplicableReason: REASON });
    const [latest] = await listAuditEvents(ctxA);
    expect(latest.eventType).toBe("criterion.not_applicable_changed");
    expect(latest.actorUserId).toBe(ctxA.userId);
    expect(latest.beforeJson).toEqual({ status: "open", reason: null });
    expect(latest.afterJson).toEqual({ status: "not_applicable", reason: REASON });
  });

  it("clears the reason when leaving not applicable and keeps it as before in the audit event", async () => {
    const { c, ctxA } = await setup();
    await setAssessmentStatus(ctxA, c.id, "not_applicable", { reason: REASON });
    await setAssessmentStatus(ctxA, c.id, "met", { reason: "wird ignoriert" });
    const [row] = await db.select().from(criterionAssessment);
    expect(row.status).toBe("met");
    expect(row.notApplicableReason).toBeNull();
    const [latest] = await listAuditEvents(ctxA);
    expect(latest.eventType).toBe("criterion.not_applicable_changed");
    expect(latest.beforeJson).toEqual({ status: "not_applicable", reason: REASON });
    expect(latest.afterJson).toEqual({ status: "met", reason: null });
  });

  it("uses the normal event type for changes that do not touch not applicable", async () => {
    const { c, ctxA } = await setup();
    await setAssessmentStatus(ctxA, c.id, "open");
    const [e] = await listAuditEvents(ctxA);
    expect(e.eventType).toBe("criterion.status_changed");
    expect(e.afterJson).toEqual({ status: "open", reason: null });
  });

  it("is forbidden for a viewer and leaves other organisations untouched", async () => {
    const { c, a, ctxA, ctxB } = await setup();
    const v = await addMemberTo(a.org.id, "viewer", "viewer");
    await expect(
      setAssessmentStatus(ctxFor(a.org.id, v.id, "viewer"), c.id, "not_applicable", { reason: REASON }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await setAssessmentStatus(ctxA, c.id, "not_applicable", { reason: REASON });
    const seenByB = await listAssessments(ctxB);
    expect(seenByB[0]).toMatchObject({ status: "not_assessed", notApplicableReason: null });
  });
});

describe("due date", () => {
  beforeEach(resetDb);

  it("sets, changes and clears the due date with audit events", async () => {
    const { c, ctxA } = await setup();
    await setAssessmentDueDate(ctxA, c.id, "2026-11-15");
    await setAssessmentDueDate(ctxA, c.id, "2026-12-01");
    await setAssessmentDueDate(ctxA, c.id, null);
    const [row] = await db.select().from(criterionAssessment);
    expect(row.dueDate).toBeNull();
    expect(row.status).toBe("not_assessed");
    const events = (await listAuditEvents(ctxA)).filter((e) => e.eventType === "criterion.due_date_changed");
    expect(events).toHaveLength(3);
    expect(events[0].beforeJson).toEqual({ dueDate: "2026-12-01" });
    expect(events[0].afterJson).toEqual({ dueDate: null });
  });

  it.each(["2026-13-01", "2026-02-30", "15.11.2026", "morgen", ""])("rejects %j", async (value) => {
    const { c, ctxA } = await setup();
    await expect(setAssessmentDueDate(ctxA, c.id, value)).rejects.toBeInstanceOf(ValidationError);
    expect(await db.select().from(criterionAssessment)).toHaveLength(0);
  });

  it("keeps the status when only the due date changes and is scoped to the organisation", async () => {
    const { c, ctxA, ctxB } = await setup();
    await setAssessmentStatus(ctxA, c.id, "critical");
    await setAssessmentDueDate(ctxA, c.id, "2026-11-15");
    const a = await listAssessments(ctxA);
    expect(a[0]).toMatchObject({ status: "critical", dueDate: "2026-11-15" });
    const b = await listAssessments(ctxB);
    expect(b[0]).toMatchObject({ status: "not_assessed", dueDate: null });
    const rows = await db.select().from(criterionAssessment).where(and(eq(criterionAssessment.organizationId, ctxB.organizationId)));
    expect(rows).toHaveLength(0);
  });
});
