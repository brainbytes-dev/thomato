import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { auth } from "@/auth/auth";
import { ACTIVE_STANDARD_VERSION, auditEvent, criterionAssessment, member, measure } from "@/db/schema";
import { importCatalog } from "./catalog";
import { listAuditEvents } from "./audit";
import { listCriterionHistory } from "./assessments";
import {
  createMeasure, listCriterionMeasures, listOpenMeasures, listOrgMembers, setMeasureStatus, updateMeasure,
} from "./measures";
import { ForbiddenError, ValidationError } from "./org-context";
import { randomUUID } from "node:crypto";
import { addMemberTo, ctxFor, makeOrg, resetDb } from "@/test/helpers";

const NOW = new Date("2026-10-08T10:00:00Z");

async function setup() {
  await importCatalog(db, {
    standardVersionId: ACTIVE_STANDARD_VERSION,
    label: "t",
    rows: ["7.3.10", "6.3.2"].map((n, i) => ({
      nummer: n, titel: `K ${n}`, kapitel: "Prozess", anerkennung_muss: true, anerkennung_soll: false,
      erneuerung_muss: true, erneuerung_soll: false, sortierung: i + 1,
    })),
  });
  const a = await makeOrg("mea-a");
  const b = await makeOrg("mea-b");
  const colleague = await addMemberTo(a.org.id, "Kollegin", "editor");
  return {
    a, b, colleague,
    ctxA: ctxFor(a.org.id, a.user.id, "owner"),
    ctxB: ctxFor(b.org.id, b.user.id, "owner"),
  };
}

const valid = (ownerUserId: string) => ({
  criterionNumber: "7.3.10", title: "Hygieneschulung planen", description: "Alle Teams", ownerUserId, dueDate: "2026-11-15",
});

describe("createMeasure", () => {
  beforeEach(resetDb);

  it("creates an open measure with one audit event and computes days/overdue", async () => {
    const { ctxA, colleague } = await setup();
    const { id } = await createMeasure(ctxA, valid(colleague.id));
    const list = await listCriterionMeasures(ctxA, "7.3.10", NOW);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id, criterionNumber: "7.3.10", title: "Hygieneschulung planen", description: "Alle Teams", ownerUserId: colleague.id,
      ownerName: "Kollegin", dueDate: "2026-11-15", status: "open", completedAt: null, overdue: false,
    });
    expect(list[0].days).toBe(38);
    const events = await listAuditEvents(ctxA);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ eventType: "measure.created", entityType: "measure", entityId: id, beforeJson: null });
    expect(events[0].afterJson).toEqual({
      title: "Hygieneschulung planen", description: "Alle Teams", ownerUserId: colleague.id, ownerName: "Kollegin",
      dueDate: "2026-11-15", status: "open", criterionNumbers: ["7.3.10"],
    });
  });

  it("trims input and stores an empty description as null", async () => {
    const { ctxA, a } = await setup();
    await createMeasure(ctxA, { ...valid(a.user.id), title: "  Titel drei  ", description: "   " });
    const [m] = await listCriterionMeasures(ctxA, "7.3.10", NOW);
    expect(m.title).toBe("Titel drei");
    expect(m.description).toBeNull();
  });

  it("treats yesterday as overdue and today as not overdue (Zurich)", async () => {
    const { ctxA, a } = await setup();
    await createMeasure(ctxA, { ...valid(a.user.id), title: "Gestern fällig", dueDate: "2026-10-07" });
    await createMeasure(ctxA, { ...valid(a.user.id), title: "Heute fällig", dueDate: "2026-10-08" });
    const list = await listCriterionMeasures(ctxA, "7.3.10", NOW);
    const yesterday = list.find((m) => m.title === "Gestern fällig")!;
    const today = list.find((m) => m.title === "Heute fällig")!;
    expect(yesterday).toMatchObject({ days: -1, overdue: true });
    expect(today).toMatchObject({ days: 0, overdue: false });
    // Zurich is UTC+2 in October: 23:30 UTC on the 7th is already the 8th in Zurich.
    const late = new Date("2026-10-07T23:30:00Z");
    const shifted = await listCriterionMeasures(ctxA, "7.3.10", late);
    expect(shifted.find((m) => m.title === "Heute fällig")).toMatchObject({ days: 0, overdue: false });
    expect(shifted.find((m) => m.title === "Gestern fällig")).toMatchObject({ days: -1, overdue: true });
  });

  it("rejects invalid input without writing a row or an audit event", async () => {
    const { ctxA, b, colleague } = await setup();
    const ok = valid(colleague.id);
    const cases = [
      { ...ok, title: "ab" },
      { ...ok, title: "x".repeat(121) },
      { ...ok, description: "y".repeat(1001) },
      { ...ok, dueDate: "2026-02-30" },
      { ...ok, dueDate: "" },
      { ...ok, criterionNumber: "9.9.9" },
      { ...ok, ownerUserId: b.user.id },
      { ...ok, ownerUserId: "not-a-uuid" },
      { ...ok, ownerUserId: "00000000-0000-4000-8000-000000000000" },
    ];
    for (const c of cases) await expect(createMeasure(ctxA, c)).rejects.toBeInstanceOf(ValidationError);
    expect(await db.select().from(measure)).toEqual([]);
    expect(await listAuditEvents(ctxA)).toEqual([]);
  });

  it("accepts boundary lengths in code points", async () => {
    const { ctxA, a } = await setup();
    await createMeasure(ctxA, { ...valid(a.user.id), title: "abc", description: "y".repeat(1000) });
    await createMeasure(ctxA, { ...valid(a.user.id), title: "😀".repeat(120) });
    expect(await db.select().from(measure)).toHaveLength(2);
  });
});

describe("rights", () => {
  beforeEach(resetDb);

  it("lets viewers read but not write", async () => {
    const { a, ctxA } = await setup();
    const viewer = await addMemberTo(a.org.id, "Viewer", "viewer");
    const ctxV = ctxFor(a.org.id, viewer.id, "viewer");
    const { id } = await createMeasure(ctxA, valid(a.user.id));
    expect(await listCriterionMeasures(ctxV, "7.3.10", NOW)).toHaveLength(1);
    expect(await listOpenMeasures(ctxV, NOW)).toHaveLength(1);
    expect((await listOrgMembers(ctxV)).length).toBeGreaterThan(0);
    await expect(createMeasure(ctxV, valid(a.user.id))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      updateMeasure(ctxV, id, { title: "Neuer Titel", description: null, ownerUserId: a.user.id, dueDate: "2026-12-01" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setMeasureStatus(ctxV, id, "done", NOW)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await listAuditEvents(ctxA)).toHaveLength(1);
  });
});

describe("setMeasureStatus", () => {
  beforeEach(resetDb);

  it("walks open, in_progress, done, open with correct completedAt and events", async () => {
    const { ctxA, a } = await setup();
    const { id } = await createMeasure(ctxA, valid(a.user.id));
    const base = { title: "Hygieneschulung planen", criterionNumbers: ["7.3.10"] };

    expect(await setMeasureStatus(ctxA, id, "in_progress", NOW)).toEqual({ status: "in_progress", completedAt: null, criterionNumber: "7.3.10" });
    expect(await setMeasureStatus(ctxA, id, "done", NOW)).toEqual({ status: "done", completedAt: NOW, criterionNumber: "7.3.10" });
    expect(await setMeasureStatus(ctxA, id, "open", NOW)).toEqual({ status: "open", completedAt: null, criterionNumber: "7.3.10" });

    const events = (await listAuditEvents(ctxA))
      .filter((e) => e.eventType === "measure.status_changed")
      .reverse();
    expect(events.map((e) => [e.beforeJson, e.afterJson])).toEqual([
      [{ ...base, status: "open", completedAt: null }, { ...base, status: "in_progress", completedAt: null }],
      [{ ...base, status: "in_progress", completedAt: null }, { ...base, status: "done", completedAt: NOW.toISOString() }],
      [{ ...base, status: "done", completedAt: NOW.toISOString() }, { ...base, status: "open", completedAt: null }],
    ]);
  });

  it("is a no-op for the same status", async () => {
    const { ctxA, a } = await setup();
    const { id } = await createMeasure(ctxA, valid(a.user.id));
    await setMeasureStatus(ctxA, id, "done", NOW);
    const later = new Date("2026-10-09T10:00:00Z");
    expect(await setMeasureStatus(ctxA, id, "done", later)).toEqual({ status: "done", completedAt: NOW, criterionNumber: "7.3.10" });
    expect((await listAuditEvents(ctxA)).filter((e) => e.eventType === "measure.status_changed")).toHaveLength(1);
    const [row] = await db.select().from(measure);
    expect(row.completedAt).toEqual(NOW);
  });

  it("rejects a status outside the list", async () => {
    const { ctxA, a } = await setup();
    const { id } = await createMeasure(ctxA, valid(a.user.id));
    await expect(setMeasureStatus(ctxA, id, "weird" as never, NOW)).rejects.toBeInstanceOf(ValidationError);
    expect(await listAuditEvents(ctxA)).toHaveLength(1);
  });
});

describe("updateMeasure", () => {
  beforeEach(resetDb);

  it("changes the four fields, audits before/after and leaves status untouched", async () => {
    const { ctxA, a, colleague } = await setup();
    const { id } = await createMeasure(ctxA, valid(a.user.id));
    await setMeasureStatus(ctxA, id, "done", NOW);
    await updateMeasure(ctxA, id, {
      title: "Hygieneschulung durchführen", description: null, ownerUserId: colleague.id, dueDate: "2026-12-01",
    });
    const [row] = await db.select().from(measure);
    expect(row).toMatchObject({ title: "Hygieneschulung durchführen", description: null, ownerUserId: colleague.id, dueDate: "2026-12-01", status: "done" });
    expect(row.completedAt).toEqual(NOW);
    const updated = (await listAuditEvents(ctxA)).filter((e) => e.eventType === "measure.updated");
    expect(updated).toHaveLength(1);
    expect(updated[0].beforeJson).toEqual({
      title: "Hygieneschulung planen", description: "Alle Teams", ownerUserId: a.user.id, ownerName: a.user.name,
      dueDate: "2026-11-15", criterionNumbers: ["7.3.10"],
    });
    expect(updated[0].afterJson).toEqual({
      title: "Hygieneschulung durchführen", description: null, ownerUserId: colleague.id, ownerName: "Kollegin",
      dueDate: "2026-12-01", criterionNumbers: ["7.3.10"],
    });
  });

  it("writes no event for an unchanged call", async () => {
    const { ctxA, a } = await setup();
    const { id } = await createMeasure(ctxA, valid(a.user.id));
    await updateMeasure(ctxA, id, { title: "  Hygieneschulung planen ", description: "Alle Teams", ownerUserId: a.user.id, dueDate: "2026-11-15" });
    expect(await listAuditEvents(ctxA)).toHaveLength(1);
  });

  it("rejects invalid input and a non-member owner without changes", async () => {
    const { ctxA, a, b } = await setup();
    const { id } = await createMeasure(ctxA, valid(a.user.id));
    const ok = { title: "Neuer Titel", description: null, ownerUserId: a.user.id, dueDate: "2026-12-01" };
    for (const c of [{ ...ok, title: "ab" }, { ...ok, dueDate: "2026-02-30" }, { ...ok, ownerUserId: b.user.id }]) {
      await expect(updateMeasure(ctxA, id, c)).rejects.toBeInstanceOf(ValidationError);
    }
    expect(await listAuditEvents(ctxA)).toHaveLength(1);
  });
});

describe("tenant isolation", () => {
  beforeEach(resetDb);

  it("hides and protects measures of other organizations", async () => {
    const { ctxA, ctxB, a, b } = await setup();
    const { id } = await createMeasure(ctxA, valid(a.user.id));
    expect(await listCriterionMeasures(ctxB, "7.3.10", NOW)).toEqual([]);
    expect(await listOpenMeasures(ctxB, NOW)).toEqual([]);
    const members = await listOrgMembers(ctxB);
    expect(members.map((m) => m.userId)).toEqual([b.user.id]);

    const input = { title: "Fremder Titel", description: null, ownerUserId: b.user.id, dueDate: "2026-12-01" };
    for (const target of [id, "00000000-0000-4000-8000-000000000000", "not-a-uuid"]) {
      await expect(updateMeasure(ctxB, target, input)).rejects.toThrow(new ValidationError("Massnahme nicht gefunden."));
      await expect(setMeasureStatus(ctxB, target, "done", NOW)).rejects.toThrow(new ValidationError("Massnahme nicht gefunden."));
    }
    const [row] = await db.select().from(measure);
    expect(row).toMatchObject({ title: "Hygieneschulung planen", status: "open", completedAt: null });
    expect(await listAuditEvents(ctxB)).toEqual([]);
  });
});

describe("listings", () => {
  beforeEach(resetDb);

  it("sorts open by due date first, then done by completion descending; open list excludes done and has criterionTitle", async () => {
    const { ctxA, a } = await setup();
    const late = await createMeasure(ctxA, { ...valid(a.user.id), title: "Spät", dueDate: "2026-12-01" });
    await createMeasure(ctxA, { ...valid(a.user.id), title: "Früh", dueDate: "2026-10-20" });
    const d1 = await createMeasure(ctxA, { ...valid(a.user.id), title: "Erledigt eins", dueDate: "2026-09-01" });
    const d2 = await createMeasure(ctxA, { ...valid(a.user.id), title: "Erledigt zwei", dueDate: "2026-09-02" });
    await createMeasure(ctxA, { ...valid(a.user.id), title: "Andere Nummer", criterionNumber: "6.3.2", dueDate: "2026-10-10" });
    await setMeasureStatus(ctxA, d1.id, "done", new Date("2026-10-01T10:00:00Z"));
    await setMeasureStatus(ctxA, d2.id, "done", new Date("2026-10-05T10:00:00Z"));
    await setMeasureStatus(ctxA, late.id, "in_progress", NOW);

    const list = await listCriterionMeasures(ctxA, "7.3.10", NOW);
    expect(list.map((m) => m.title)).toEqual(["Früh", "Spät", "Erledigt zwei", "Erledigt eins"]);
    expect(list.find((m) => m.title === "Erledigt eins")!.overdue).toBe(false);

    const open = await listOpenMeasures(ctxA, NOW);
    expect(open.map((m) => m.title)).toEqual(["Andere Nummer", "Früh", "Spät"]);
    expect(open[0].criterionTitle).toBe("K 6.3.2");
  });
});

describe("concurrency", () => {
  beforeEach(resetDb);

  it("serializes concurrent status changes: two events chained, never done without a date", async () => {
    const { ctxA, a } = await setup();
    for (let round = 0; round < 8; round++) {
      const { id } = await createMeasure(ctxA, { ...valid(a.user.id), title: `Runde ${round}` });
      await Promise.all([setMeasureStatus(ctxA, id, "in_progress", NOW), setMeasureStatus(ctxA, id, "done", NOW)]);
      const events = (await db.select().from(auditEvent).where(and(eq(auditEvent.entityId, id), eq(auditEvent.eventType, "measure.status_changed"))))
        .sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
      expect(events).toHaveLength(2);
      const stat = (v: unknown) => (v as { status: string }).status;
      const first = events.filter((e) => stat(e.beforeJson) === "open");
      expect(first).toHaveLength(1);
      const second = events.find((e) => e !== first[0])!;
      expect(second.beforeJson).toEqual(first[0].afterJson);
      const [row] = await db.select().from(measure).where(eq(measure.id, id));
      if (row.status === "done") expect(row.completedAt).not.toBeNull();
      else {
        expect(row.status).toBe("in_progress");
        expect(row.completedAt).toBeNull();
      }
    }
  });
});

describe("criterion history", () => {
  beforeEach(resetDb);

  it("lists measure events newest first and scoped to the organisation", async () => {
    const { ctxA, ctxB, a, b } = await setup();
    const { id } = await createMeasure(ctxA, valid(a.user.id));
    await setMeasureStatus(ctxA, id, "in_progress", NOW);
    await updateMeasure(ctxA, id, { title: "Neuer Titel", description: null, ownerUserId: a.user.id, dueDate: "2026-12-01" });
    const own = (await listCriterionHistory(ctxA, "7.3.10", null)).map((h) => h.eventType);
    expect(own).toEqual(["measure.updated", "measure.status_changed", "measure.created"]);
    await createMeasure(ctxB, valid(b.user.id));
    expect((await listCriterionHistory(ctxB, "7.3.10", null)).map((h) => h.eventType)).toEqual(["measure.created"]);
    expect((await listCriterionHistory(ctxA, "6.3.2", null))).toEqual([]);
  });

  it("returns the criterion number from update and status changes, also for no-ops", async () => {
    const { ctxA, a } = await setup();
    const { id } = await createMeasure(ctxA, valid(a.user.id));
    const same = { title: "Hygieneschulung planen", description: "Alle Teams", ownerUserId: a.user.id, dueDate: "2026-11-15" };
    expect(await updateMeasure(ctxA, id, same)).toEqual({ criterionNumber: "7.3.10" });
    expect(await updateMeasure(ctxA, id, { ...same, title: "Anderer Titel" })).toEqual({ criterionNumber: "7.3.10" });
  });
});

describe("side effects", () => {
  beforeEach(resetDb);

  it("never touches criterion_assessment", async () => {
    const { ctxA, a } = await setup();
    const { id } = await createMeasure(ctxA, valid(a.user.id));
    await setMeasureStatus(ctxA, id, "done", NOW);
    await updateMeasure(ctxA, id, { title: "Anderer Titel", description: null, ownerUserId: a.user.id, dueDate: "2026-12-01" });
    expect(await db.select().from(criterionAssessment)).toEqual([]);
  });
});

describe("real Better Auth users", () => {
  beforeEach(resetDb);

  async function realMember(orgId: string, email: string) {
    const { user } = await auth.api.signUpEmail({ body: { email, password: "correct-horse-battery-1", name: "Echte Person" } });
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: user.id, role: "editor", createdAt: new Date() });
    return user;
  }

  it("accepts a non-UUID owner id in create and update", async () => {
    const { ctxA, a } = await setup();
    const real = await realMember(a.org.id, "real-owner@example.test");
    expect(real.id).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    const { id } = await createMeasure(ctxA, valid(real.id));
    const [created] = await listCriterionMeasures(ctxA, "7.3.10", NOW);
    expect(created).toMatchObject({ id, ownerUserId: real.id, ownerName: "Echte Person" });
    await updateMeasure(ctxA, id, { title: "Neuer Titel", description: null, ownerUserId: a.user.id, dueDate: "2026-12-01" });
    await updateMeasure(ctxA, id, { title: "Neuer Titel", description: null, ownerUserId: real.id, dueDate: "2026-12-01" });
    const [row] = await db.select().from(measure);
    expect(row.ownerUserId).toBe(real.id);
  });

  it("rejects an empty or oversized owner id", async () => {
    const { ctxA } = await setup();
    for (const bad of ["", "x".repeat(65)]) {
      await expect(createMeasure(ctxA, valid(bad))).rejects.toBeInstanceOf(ValidationError);
    }
  });

  it("allows a title-only edit after the owner left, but not a switch to a non-member", async () => {
    const { ctxA, a, b, colleague } = await setup();
    const { id } = await createMeasure(ctxA, valid(colleague.id));
    await db.delete(member).where(and(eq(member.organizationId, a.org.id), eq(member.userId, colleague.id)));
    const keep = { description: "Alle Teams", ownerUserId: colleague.id, dueDate: "2026-11-15" };
    await updateMeasure(ctxA, id, { ...keep, title: "Nur der Titel" });
    const [row] = await db.select().from(measure);
    expect(row).toMatchObject({ title: "Nur der Titel", ownerUserId: colleague.id });
    const updated = (await listAuditEvents(ctxA)).find((e) => e.eventType === "measure.updated")!;
    expect(updated.afterJson).toMatchObject({ ownerName: "Kollegin", title: "Nur der Titel" });
    await expect(
      updateMeasure(ctxA, id, { ...keep, title: "Nur der Titel", ownerUserId: b.user.id }),
    ).rejects.toBeInstanceOf(ValidationError);
    const [after] = await db.select().from(measure);
    expect(after.ownerUserId).toBe(colleague.id);
  });
});
