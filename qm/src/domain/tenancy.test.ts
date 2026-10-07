import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditEvent, criterion, criterionAssessment } from "@/db/schema";
import { importCatalog } from "./catalog";
import { listAssessments, setAssessmentStatus } from "./assessments";
import { listAuditEvents, withAudit } from "./audit";
import { ForbiddenError } from "./org-context";
import { addMemberTo, ctxFor, makeOrg, resetDb } from "@/test/helpers";
import { ACTIVE_STANDARD_VERSION } from "@/db/schema";

const rows = ["8.1", "8.2"].map((n, i) => ({
  nummer: n, titel: `Kriterium ${n}`, kapitel: "Prozess",
  anerkennung_muss: i === 0, anerkennung_soll: false,
  erneuerung_muss: false, erneuerung_soll: false, sortierung: 80100 + i,
}));

async function setup() {
  await importCatalog(db, { standardVersionId: ACTIVE_STANDARD_VERSION, label: "t", rows });
  const a = await makeOrg("org-a");
  const b = await makeOrg("org-b");
  const [c1] = await db.select().from(criterion).orderBy(criterion.sortOrder);
  return { a, b, c1, ctxA: ctxFor(a.org.id, a.user.id, "owner"), ctxB: ctxFor(b.org.id, b.user.id, "owner") };
}

describe("tenant isolation", () => {
  beforeEach(resetDb);

  it("org B never sees or changes the assessment of org A", async () => {
    const { c1, ctxA, ctxB } = await setup();
    await setAssessmentStatus(ctxA, c1.id, "critical");

    const seenByB = await listAssessments(ctxB);
    expect(seenByB.find((r) => r.criterionId === c1.id)?.status).toBe("not_assessed");

    await setAssessmentStatus(ctxB, c1.id, "met");
    const all = await db.select().from(criterionAssessment);
    expect(all).toHaveLength(2);
    const seenByA = await listAssessments(ctxA);
    expect(seenByA.find((r) => r.criterionId === c1.id)?.status).toBe("critical");

    const eventsB = await listAuditEvents(ctxB);
    expect(eventsB).toHaveLength(1);
    expect(eventsB[0].beforeJson).toEqual({ status: "not_assessed", reason: null });
    expect(eventsB[0].afterJson).toEqual({ status: "met", reason: null });
    expect(await listAuditEvents(ctxA)).toHaveLength(1);
  });

  it("audit events are scoped to the organization", async () => {
    const { c1, ctxA, ctxB } = await setup();
    await setAssessmentStatus(ctxA, c1.id, "open");
    expect(await listAuditEvents(ctxA)).toHaveLength(1);
    expect(await listAuditEvents(ctxB)).toHaveLength(0);
  });
});

describe("permissions", () => {
  beforeEach(resetDb);

  it("viewer cannot write: no row, no audit event", async () => {
    const { a, c1 } = await setup();
    const v = await addMemberTo(a.org.id, "viewer", "viewer");
    const ctxV = ctxFor(a.org.id, v.id, "viewer");
    await expect(setAssessmentStatus(ctxV, c1.id, "met")).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.select().from(criterionAssessment)).toHaveLength(0);
    expect(await listAuditEvents(ctxFor(a.org.id, a.user.id, "owner"))).toHaveLength(0);
  });

  it("only owner and qm_admin may read the audit log", async () => {
    const { a } = await setup();
    for (const role of ["reviewer", "editor", "viewer"] as const) {
      const u = await addMemberTo(a.org.id, role, role);
      await expect(listAuditEvents(ctxFor(a.org.id, u.id, role))).rejects.toBeInstanceOf(ForbiddenError);
    }
    const admin = await addMemberTo(a.org.id, "admin", "qm_admin");
    await expect(listAuditEvents(ctxFor(a.org.id, admin.id, "qm_admin"))).resolves.toEqual([]);
  });
});

describe("atomic audit", () => {
  beforeEach(resetDb);

  it("rolls back the change when the action fails after writing", async () => {
    const { c1, ctxA } = await setup();
    await expect(
      withAudit(ctxA, async (tx) => {
        await tx.insert(criterionAssessment).values({
          organizationId: ctxA.organizationId, criterionId: c1.id, status: "met",
        });
        throw new Error("fails after write");
      }),
    ).rejects.toThrow("fails after write");
    expect(await db.select().from(criterionAssessment)).toHaveLength(0);
    expect(await listAuditEvents(ctxA)).toHaveLength(0);
  });

  it("rolls back the domain change when the audit insert fails", async () => {
    const { c1, ctxA } = await setup();
    const error: unknown = await setAssessmentStatus({ ...ctxA, userId: "nonexistent-user" }, c1.id, "met").then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(Error);
    // drizzle verpackt den PG-Fehler: die FK-Meldung steht in error.cause.
    const text = `${(error as Error).message} ${(error as Error).cause instanceof Error ? ((error as Error).cause as Error).message : ""}`;
    expect(text).toMatch(/foreign key/i);
    expect(await db.select().from(criterionAssessment)).toHaveLength(0);
    expect(await db.select().from(auditEvent)).toHaveLength(0);
  });

  it("records before and after for a status change", async () => {
    const { c1, ctxA } = await setup();
    await setAssessmentStatus(ctxA, c1.id, "open");
    await setAssessmentStatus(ctxA, c1.id, "met");
    const events = await listAuditEvents(ctxA);
    expect(events).toHaveLength(2);
    const latest = events[0];
    expect(latest.eventType).toBe("criterion.status_changed");
    expect((latest.beforeJson as { status: string }).status).toBe("open");
    expect((latest.afterJson as { status: string }).status).toBe("met");
    expect(latest.actorUserId).toBe(ctxA.userId);
  });
});
