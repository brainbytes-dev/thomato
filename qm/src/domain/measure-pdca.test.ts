import { beforeEach, describe, expect, it } from "vitest";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION, auditEvent, measure, measureReview, measureStep } from "@/db/schema";
import { importCatalog } from "./catalog";
import { listAuditEvents } from "./audit";
import { listCriterionHistory } from "./assessments";
import { describeAuditEvent } from "./audit-copy";
import { createMeasure } from "./measures";
import {
  addStep, closeMeasure, completeDo, completePlan, getMeasureDetail, getPdcaFigures, moveStep, recordEffectiveness,
  refineMeasure, removeStep, renameStep, reopenMeasure, setEffectivenessCriterion, startNewCycle, toggleStep,
  allowedMeasureActions,
} from "./measure-pdca";
import { ForbiddenError, ValidationError, type OrgContext } from "./org-context";
import { can, ROLES, type Role } from "./rights";
import { addMemberTo, ctxFor, makeOrg, resetDb } from "@/test/helpers";

const NOW = new Date("2026-10-08T10:00:00Z");
const NOT_FOUND = "Die Massnahme wurde nicht gefunden.";

async function setup() {
  await importCatalog(db, {
    standardVersionId: ACTIVE_STANDARD_VERSION,
    label: "t",
    rows: ["7.3.10", "6.3.2"].map((n, i) => ({
      nummer: n, titel: `K ${n}`, kapitel: "Prozess", anerkennung_muss: true, anerkennung_soll: false,
      erneuerung_muss: true, erneuerung_soll: false, sortierung: i + 1,
    })),
  });
  const a = await makeOrg("pdca-a");
  const b = await makeOrg("pdca-b");
  const byRole = { owner: ctxFor(a.org.id, a.user.id, "owner") } as Record<Role, OrgContext>;
  for (const role of ROLES.filter((r) => r !== "owner")) {
    const u = await addMemberTo(a.org.id, `Person ${role}`, role);
    byRole[role] = ctxFor(a.org.id, u.id, role);
  }
  return { a, b, byRole, ctxA: byRole.owner, ctxB: ctxFor(b.org.id, b.user.id, "owner") };
}

type Setup = Awaited<ReturnType<typeof setup>>;
type Phase = "plan" | "do" | "check" | "act" | "done";

const fields = (ownerUserId: string) => ({
  criterionNumber: "7.3.10", title: "Hygieneschulung planen", description: null, ownerUserId, dueDate: "2026-11-15",
});

async function create(s: Setup, title = "Hygieneschulung planen"): Promise<string> {
  return (await createMeasure(s.ctxA, { ...fields(s.a.user.id), title })).id;
}

/** Bringt eine neue Massnahme über die echten Übergänge in die Zielphase. Offene Schritte gibt es nur in Do. */
async function measureAt(s: Setup, phase: Phase, title?: string): Promise<{ id: string; stepIds: string[] }> {
  const id = await create(s, title);
  const stepIds: string[] = [];
  if (phase === "plan") return { id, stepIds: [randomUUID()] };
  await completePlan(s.ctxA, id);
  stepIds.push((await addStep(s.ctxA, id, "Schritt eins")).stepId, (await addStep(s.ctxA, id, "Schritt zwei")).stepId);
  if (phase === "do") return { id, stepIds };
  for (const stepId of stepIds) await toggleStep(s.ctxA, id, stepId, true, NOW);
  await completeDo(s.ctxA, id, {});
  if (phase === "check") return { id, stepIds };
  await recordEffectiveness(s.ctxA, id, { result: "effective", note: "Wirkung belegt" });
  if (phase === "act") return { id, stepIds };
  await closeMeasure(s.ctxA, id, {}, NOW);
  return { id, stepIds };
}

async function row(id: string) {
  const [r] = await db.select().from(measure).where(eq(measure.id, id));
  return r;
}
const events = async (s: Setup) => (await listAuditEvents(s.ctxA, 500)).length;
const reviewsOf = (id: string) => db.select().from(measureReview).where(eq(measureReview.measureId, id)).orderBy(asc(measureReview.checkedAt));
const stepsOf = (id: string) => db.select().from(measureStep).where(eq(measureStep.measureId, id)).orderBy(asc(measureStep.position));

type Case = {
  name: string;
  right: "write" | "approve";
  phases: Phase[];
  prep?: (s: Setup, id: string, stepIds: string[]) => Promise<void>;
  run: (ctx: OrgContext, id: string, stepIds: string[]) => Promise<unknown>;
};

const CASES: Case[] = [
  { name: "setEffectivenessCriterion", right: "write", phases: ["plan", "do"], run: (c, id) => setEffectivenessCriterion(c, id, "Keine Wiederholung in 90 Tagen") },
  { name: "completePlan", right: "write", phases: ["plan"], run: (c, id) => completePlan(c, id) },
  { name: "addStep", right: "write", phases: ["do"], run: (c, id) => addStep(c, id, "Neuer Schritt") },
  { name: "renameStep", right: "write", phases: ["do"], run: (c, id, [s1]) => renameStep(c, id, s1, "Umbenannter Schritt") },
  { name: "toggleStep", right: "write", phases: ["do"], run: (c, id, [s1]) => toggleStep(c, id, s1, true, NOW) },
  { name: "removeStep", right: "write", phases: ["do"], run: (c, id, [s1]) => removeStep(c, id, s1) },
  { name: "moveStep", right: "write", phases: ["do"], run: (c, id, [s1]) => moveStep(c, id, s1, "down") },
  {
    name: "completeDo", right: "write", phases: ["do"],
    prep: async (s, id, stepIds) => {
      for (const stepId of stepIds) await toggleStep(s.ctxA, id, stepId, true, NOW);
    },
    run: (c, id) => completeDo(c, id, {}),
  },
  { name: "recordEffectiveness", right: "approve", phases: ["check"], run: (c, id) => recordEffectiveness(c, id, { result: "partly", note: "Teilweise belegt" }) },
  { name: "closeMeasure", right: "approve", phases: ["act"], run: (c, id) => closeMeasure(c, id, {}, NOW) },
  { name: "refineMeasure", right: "approve", phases: ["act"], run: (c, id) => refineMeasure(c, id) },
  { name: "startNewCycle", right: "approve", phases: ["act"], run: (c, id) => startNewCycle(c, id) },
  { name: "reopenMeasure", right: "approve", phases: ["done"], run: (c, id) => reopenMeasure(c, id) },
];

const PHASES: Phase[] = ["plan", "do", "check", "act", "done"];

describe("transition matrix: every service against every phase", () => {
  beforeEach(resetDb);

  for (const c of CASES) {
    for (const phase of PHASES) {
      const allowed = c.phases.includes(phase);
      it(`${c.name} in ${phase}: ${allowed ? "works with exactly one audit event" : "is rejected and writes nothing"}`, async () => {
        const s = await setup();
        const { id, stepIds } = await measureAt(s, phase);
        if (phase === "do") await c.prep?.(s, id, stepIds);
        const rowBefore = await row(id);
        const stepsBefore = await stepsOf(id);
        const reviewsBefore = await reviewsOf(id);
        const eventsBefore = await events(s);
        if (allowed) {
          await c.run(s.ctxA, id, stepIds);
          expect(await events(s)).toBe(eventsBefore + 1);
        } else {
          const error = await c.run(s.ctxA, id, stepIds).then(() => null, (e: unknown) => e);
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).message.length).toBeGreaterThan(10);
          expect(await events(s)).toBe(eventsBefore);
          expect(await row(id)).toEqual(rowBefore);
          expect(await stepsOf(id)).toEqual(stepsBefore);
          expect(await reviewsOf(id)).toEqual(reviewsBefore);
        }
      });
    }
  }
});

describe("rights: every role against every action", () => {
  beforeEach(resetDb);

  for (const role of ROLES) {
    for (const c of CASES) {
      const allowed = can(role, "measure", c.right);
      it(`${role} ${allowed ? "may" : "may not"} ${c.name} (${c.right})`, async () => {
        const s = await setup();
        const { id, stepIds } = await measureAt(s, c.phases[0]);
        await c.prep?.(s, id, stepIds);
        const rowBefore = await row(id);
        const eventsBefore = await events(s);
        if (allowed) {
          await c.run(s.byRole[role], id, stepIds);
          expect(await events(s)).toBe(eventsBefore + 1);
        } else {
          await expect(c.run(s.byRole[role], id, stepIds)).rejects.toBeInstanceOf(ForbiddenError);
          expect(await events(s)).toBe(eventsBefore);
          expect(await row(id)).toEqual(rowBefore);
        }
      });
    }
  }

  it("lets every role read the detail and the figures", async () => {
    const s = await setup();
    const { id } = await measureAt(s, "act");
    for (const role of ROLES) {
      expect((await getMeasureDetail(s.byRole[role], id, NOW)).measure.id).toBe(id);
      expect((await getPdcaFigures(s.byRole[role])).phases.act).toBe(1);
    }
  });
});

describe("full cycle and audit trail", () => {
  beforeEach(resetDb);

  it("walks plan, do, check, act and closes only on the explicit action", async () => {
    const s = await setup();
    const id = await create(s);
    await setEffectivenessCriterion(s.ctxA, id, "  Keine Wiederholung in 90 Tagen  ");
    await completePlan(s.ctxA, id);
    const { stepId } = await addStep(s.ctxA, id, "  Schulung durchführen ");
    await toggleStep(s.ctxA, id, stepId, true, NOW);
    await completeDo(s.ctxA, id, {});
    expect(await row(id)).toMatchObject({ phase: "check", status: "in_progress", cycle: 1, completedAt: null });

    const { reviewId } = await recordEffectiveness(s.ctxA, id, { result: "effective", note: "  Keine neuen Fälle  " });
    // Auch «wirksam» schliesst nie automatisch.
    expect(await row(id)).toMatchObject({ phase: "act", status: "in_progress", completedAt: null });
    expect(await reviewsOf(id)).toMatchObject([{ id: reviewId, cycle: 1, result: "effective", note: "Keine neuen Fälle", checkedBy: s.a.user.id }]);

    await closeMeasure(s.ctxA, id, {}, NOW);
    expect(await row(id)).toMatchObject({ phase: "act", status: "done", completedAt: NOW, effectivenessCriterion: "Keine Wiederholung in 90 Tagen" });

    const log = (await listAuditEvents(s.ctxA, 100)).reverse();
    expect(log.map((e) => e.eventType)).toEqual([
      "measure.created", "measure.updated", "measure.phase_changed", "measure.step_added", "measure.step_updated",
      "measure.phase_changed", "measure.effectiveness_recorded", "measure.closed",
    ]);
    const state = { title: "Hygieneschulung planen", criterionNumbers: ["7.3.10"] };
    expect(log[2]).toMatchObject({
      entityId: id, entityType: "measure",
      beforeJson: { ...state, phase: "plan", status: "open", cycle: 1, completedAt: null },
      afterJson: { ...state, phase: "do", status: "in_progress", cycle: 1, completedAt: null },
    });
    expect(log[3].afterJson).toEqual({ ...state, stepId, stepTitle: "Schulung durchführen", position: 1, done: false });
    expect(log[3].beforeJson).toBeNull();
    expect(log[4].afterJson).toMatchObject({ stepId, done: true });
    expect(log[4].beforeJson).toMatchObject({ stepId, done: false });
    expect(log[5].afterJson).toMatchObject({ phase: "check", confirmedNoSteps: false });
    expect(log[6].afterJson).toMatchObject({ ...state, phase: "act", reviewId, result: "effective", note: "Keine neuen Fälle", cycle: 1 });
    expect(log[7].afterJson).toMatchObject({ ...state, status: "done", result: "effective", reason: null, completedAt: NOW.toISOString() });
    expect(log.every((e) => (e.afterJson as { criterionNumbers?: string[] }).criterionNumbers?.[0] === "7.3.10")).toBe(true);
  });

  it("shows every PDCA event in the criterion history with a readable German text", async () => {
    const s = await setup();
    const { id, stepIds } = await measureAt(s, "done");
    await reopenMeasure(s.ctxA, id);
    await removeStep(s.ctxA, id, stepIds[1]);
    await moveStep(s.ctxA, id, stepIds[0], "down");
    await renameStep(s.ctxA, id, stepIds[0], "Anders benannt");
    const history = await listCriterionHistory(s.ctxA, "7.3.10", null);
    const types = new Set(history.map((h) => h.eventType));
    for (const t of [
      "measure.created", "measure.phase_changed", "measure.step_added", "measure.step_updated", "measure.step_removed",
      "measure.effectiveness_recorded", "measure.closed", "measure.reopened",
    ]) expect(types.has(t), t).toBe(true);
    const all = await listAuditEvents(s.ctxA, 500);
    for (const e of all) {
      expect(describeAuditEvent({ eventType: e.eventType, before: e.beforeJson, after: e.afterJson }), e.eventType).not.toBe(e.eventType);
    }
  });

  it("does not write an event for a criterion text that did not change, and clears it with null or blank", async () => {
    const s = await setup();
    const id = await create(s);
    await setEffectivenessCriterion(s.ctxA, id, "Keine Wiederholung");
    const after = await events(s);
    await setEffectivenessCriterion(s.ctxA, id, "  Keine Wiederholung ");
    expect(await events(s)).toBe(after);
    await setEffectivenessCriterion(s.ctxA, id, "   ");
    expect((await row(id)).effectivenessCriterion).toBeNull();
    expect(await events(s)).toBe(after + 1);
    await setEffectivenessCriterion(s.ctxA, id, null);
    expect(await events(s)).toBe(after + 1);
  });

  it("validates the effectiveness criterion length (3 to 500 characters)", async () => {
    const s = await setup();
    const id = await create(s);
    const before = await events(s);
    for (const bad of ["ab", "x".repeat(501)]) {
      await expect(setEffectivenessCriterion(s.ctxA, id, bad)).rejects.toBeInstanceOf(ValidationError);
    }
    await setEffectivenessCriterion(s.ctxA, id, "x".repeat(500));
    await setEffectivenessCriterion(s.ctxA, id, "😀".repeat(3));
    expect(await events(s)).toBe(before + 2);
  });
});

describe("checklist steps", () => {
  beforeEach(resetDb);

  it("keeps positions dense and stable through add, move and remove", async () => {
    const s = await setup();
    const id = await create(s);
    await completePlan(s.ctxA, id);
    const one = (await addStep(s.ctxA, id, "Eins eins")).stepId;
    const two = (await addStep(s.ctxA, id, "Zwei zwei")).stepId;
    const three = (await addStep(s.ctxA, id, "Drei drei")).stepId;
    const order = async () => (await stepsOf(id)).map((x) => [x.id, x.position]);
    expect(await order()).toEqual([[one, 1], [two, 2], [three, 3]]);

    await moveStep(s.ctxA, id, three, "up");
    expect(await order()).toEqual([[one, 1], [three, 2], [two, 3]]);
    const eventsBefore = await events(s);
    await moveStep(s.ctxA, id, one, "up");
    await moveStep(s.ctxA, id, two, "down");
    expect(await events(s)).toBe(eventsBefore);
    expect(await order()).toEqual([[one, 1], [three, 2], [two, 3]]);

    await removeStep(s.ctxA, id, one);
    expect(await order()).toEqual([[three, 1], [two, 2]]);
    const removed = (await listAuditEvents(s.ctxA, 1))[0];
    expect(removed).toMatchObject({ eventType: "measure.step_removed", afterJson: null });
    expect(removed.beforeJson).toMatchObject({ stepId: one, stepTitle: "Eins eins", position: 1 });
  });

  it("validates the title (3 to 200 characters, trimmed) on add and rename", async () => {
    const s = await setup();
    const id = await create(s);
    await completePlan(s.ctxA, id);
    const { stepId } = await addStep(s.ctxA, id, "Gültiger Titel");
    const before = await events(s);
    for (const bad of ["ab", "  a  ", "x".repeat(201), ""]) {
      await expect(addStep(s.ctxA, id, bad)).rejects.toBeInstanceOf(ValidationError);
      await expect(renameStep(s.ctxA, id, stepId, bad)).rejects.toBeInstanceOf(ValidationError);
    }
    expect(await events(s)).toBe(before);
    await addStep(s.ctxA, id, "x".repeat(200));
    await renameStep(s.ctxA, id, stepId, "  Neuer Titel ");
    expect((await stepsOf(id))[0].title).toBe("Neuer Titel");
    await renameStep(s.ctxA, id, stepId, "Neuer Titel");
    expect(await events(s)).toBe(before + 2);
  });

  it("toggles with who and when, and a repeated request is a no-op without an event", async () => {
    const s = await setup();
    const id = await create(s);
    await completePlan(s.ctxA, id);
    const { stepId } = await addStep(s.ctxA, id, "Schritt eins");
    await toggleStep(s.ctxA, id, stepId, true, NOW);
    const before = await events(s);
    await toggleStep(s.ctxA, id, stepId, true, new Date("2026-10-09T10:00:00Z"));
    expect(await events(s)).toBe(before);
    expect((await stepsOf(id))[0]).toMatchObject({ doneAt: NOW, doneBy: s.a.user.id });
    await toggleStep(s.ctxA, id, stepId, false, NOW);
    expect((await stepsOf(id))[0]).toMatchObject({ doneAt: null, doneBy: null });
    expect(await events(s)).toBe(before + 1);
  });

  it("answers an unknown step, a non-UUID and a step of another measure with the same message and writes nothing", async () => {
    const s = await setup();
    const id = await create(s);
    const other = await create(s, "Andere Massnahme");
    await completePlan(s.ctxA, id);
    await completePlan(s.ctxA, other);
    const foreign = (await addStep(s.ctxA, other, "Fremder Schritt")).stepId;
    const before = await events(s);
    for (const target of [randomUUID(), "kein-uuid", foreign]) {
      for (const call of [
        () => renameStep(s.ctxA, id, target, "Neuer Titel"),
        () => toggleStep(s.ctxA, id, target, true, NOW),
        () => removeStep(s.ctxA, id, target),
        () => moveStep(s.ctxA, id, target, "up"),
      ]) {
        await expect(call()).rejects.toThrow(new ValidationError("Der Schritt wurde nicht gefunden."));
      }
    }
    expect(await events(s)).toBe(before);
    expect((await stepsOf(other))[0].title).toBe("Fremder Schritt");
  });

  it("requires all steps done for completeDo, and an explicit confirmation when there are none", async () => {
    const s = await setup();
    const id = await create(s);
    await completePlan(s.ctxA, id);
    const before = await events(s);
    await expect(completeDo(s.ctxA, id, {})).rejects.toThrow(/ausdrücklich/);
    await expect(completeDo(s.ctxA, id, { confirmNoSteps: false })).rejects.toBeInstanceOf(ValidationError);
    expect(await events(s)).toBe(before);

    const { stepId } = await addStep(s.ctxA, id, "Schritt eins");
    await addStep(s.ctxA, id, "Schritt zwei");
    await toggleStep(s.ctxA, id, stepId, true, NOW);
    // Die Bestätigung ersetzt keine offenen Schritte.
    await expect(completeDo(s.ctxA, id, { confirmNoSteps: true })).rejects.toThrow(/noch 1 Schritt offen/);
    expect((await row(id)).phase).toBe("do");

    const empty = await create(s, "Ohne Checkliste");
    await completePlan(s.ctxA, empty);
    await completeDo(s.ctxA, empty, { confirmNoSteps: true });
    expect((await row(empty)).phase).toBe("check");
    expect((await listAuditEvents(s.ctxA, 1))[0].afterJson).toMatchObject({ confirmedNoSteps: true });
  });

  it("keeps the checklist read-only outside Do", async () => {
    const s = await setup();
    const { id, stepIds } = await measureAt(s, "check");
    await expect(addStep(s.ctxA, id, "Zu spät")).rejects.toThrow(/Phase Do/);
    await expect(toggleStep(s.ctxA, id, stepIds[0], false, NOW)).rejects.toBeInstanceOf(ValidationError);
    expect((await stepsOf(id)).every((x) => x.doneAt !== null)).toBe(true);
  });
});

describe("check and act", () => {
  beforeEach(resetDb);

  it("validates result and note on recordEffectiveness", async () => {
    const s = await setup();
    const { id } = await measureAt(s, "check");
    const before = await events(s);
    const bad = [
      { result: "great" as never, note: "Gute Notiz" },
      { result: "effective" as const, note: "ab" },
      { result: "effective" as const, note: "  a  " },
      { result: "effective" as const, note: "x".repeat(1001) },
    ];
    for (const input of bad) await expect(recordEffectiveness(s.ctxA, id, input)).rejects.toBeInstanceOf(ValidationError);
    expect(await events(s)).toBe(before);
    expect(await reviewsOf(id)).toEqual([]);
    await recordEffectiveness(s.ctxA, id, { result: "effective", note: "x".repeat(1000) });
  });

  for (const result of ["partly", "not_effective"] as const) {
    it(`never closes automatically after ${result} and demands a reason of at least 10 characters`, async () => {
      const s = await setup();
      const { id } = await measureAt(s, "check");
      await recordEffectiveness(s.ctxA, id, { result, note: "Nicht ausreichend" });
      expect(await row(id)).toMatchObject({ phase: "act", status: "in_progress", completedAt: null });

      const before = await events(s);
      for (const reason of [undefined, "", "   ", "kurz", "123456789", "  12345678  "]) {
        await expect(closeMeasure(s.ctxA, id, { reason }, NOW)).rejects.toThrow(/Begründung/);
      }
      expect(await events(s)).toBe(before);
      expect((await row(id)).status).toBe("in_progress");

      await closeMeasure(s.ctxA, id, { reason: "  Restrisiko ist akzeptiert " }, NOW);
      expect(await row(id)).toMatchObject({ status: "done", completedAt: NOW });
      expect((await listAuditEvents(s.ctxA, 1))[0]).toMatchObject({
        eventType: "measure.closed",
        afterJson: { result, reason: "Restrisiko ist akzeptiert", status: "done" },
      });
    });
  }

  it("closes after effective without a reason, and stores an optional reason when given", async () => {
    const s = await setup();
    const a = await measureAt(s, "act");
    await closeMeasure(s.ctxA, a.id, {}, NOW);
    const b = await measureAt(s, "act", "Zweite Massnahme");
    await closeMeasure(s.ctxA, b.id, { reason: "Alles wie geplant erledigt" }, NOW);
    expect((await listAuditEvents(s.ctxA, 1))[0].afterJson).toMatchObject({ reason: "Alles wie geplant erledigt" });
    await expect(closeMeasure(s.ctxA, a.id, {}, NOW)).rejects.toThrow(/bereits abgeschlossen/);
  });

  it("refines: back to Do in the same cycle, reviews stay, new steps and a second review follow", async () => {
    const s = await setup();
    const { id } = await measureAt(s, "check");
    await recordEffectiveness(s.ctxA, id, { result: "partly", note: "Erster Befund" });
    const first = await reviewsOf(id);
    await refineMeasure(s.ctxA, id);
    expect(await row(id)).toMatchObject({ phase: "do", status: "in_progress", cycle: 1, completedAt: null });
    expect(await reviewsOf(id)).toEqual(first);

    const { stepId } = await addStep(s.ctxA, id, "Nachschärfen nötig");
    await toggleStep(s.ctxA, id, stepId, true, NOW);
    await completeDo(s.ctxA, id, {});
    await recordEffectiveness(s.ctxA, id, { result: "effective", note: "Zweiter Befund" });
    const all = await reviewsOf(id);
    expect(all).toHaveLength(2);
    expect(all[0]).toEqual(first[0]);
    expect(all.map((r) => r.cycle)).toEqual([1, 1]);
    // Der letzte Befund zählt: «wirksam» braucht keine Begründung.
    await closeMeasure(s.ctxA, id, {}, NOW);
    expect((await row(id)).status).toBe("done");
  });

  it("starts a new cycle: plan, cycle plus one, criterion proposal and all old reviews untouched", async () => {
    const s = await setup();
    const id = await create(s);
    await setEffectivenessCriterion(s.ctxA, id, "Keine Wiederholung in 90 Tagen");
    await completePlan(s.ctxA, id);
    const { stepId } = await addStep(s.ctxA, id, "Schritt eins");
    await toggleStep(s.ctxA, id, stepId, true, NOW);
    await completeDo(s.ctxA, id, {});
    await recordEffectiveness(s.ctxA, id, { result: "not_effective", note: "Fall wiederholt sich" });
    const reviewsBefore = await reviewsOf(id);

    await startNewCycle(s.ctxA, id);
    expect(await row(id)).toMatchObject({
      phase: "plan", status: "in_progress", cycle: 2, completedAt: null, effectivenessCriterion: "Keine Wiederholung in 90 Tagen",
    });
    expect(await reviewsOf(id)).toEqual(reviewsBefore);
    expect((await listAuditEvents(s.ctxA, 1))[0]).toMatchObject({
      eventType: "measure.cycle_started",
      beforeJson: { cycle: 1, phase: "act" },
      afterJson: { cycle: 2, phase: "plan", previousResult: "not_effective" },
    });

    // Zweiter Zyklus: Reviews tragen den neuen Zyklus, die alten bleiben unverändert.
    await completePlan(s.ctxA, id);
    await completeDo(s.ctxA, id, {});
    await recordEffectiveness(s.ctxA, id, { result: "effective", note: "Jetzt wirksam" });
    const all = await reviewsOf(id);
    expect(all.map((r) => [r.cycle, r.result])).toEqual([[1, "not_effective"], [2, "effective"]]);
    expect(all[0]).toEqual(reviewsBefore[0]);

    const detail = await getMeasureDetail(s.ctxA, id, NOW);
    expect(detail.reviewsByCycle.map((g) => [g.cycle, g.reviews.map((r) => r.result)])).toEqual([
      [1, ["not_effective"]], [2, ["effective"]],
    ]);
    expect(detail.lastReview).toMatchObject({ cycle: 2, result: "effective" });
  });

  it("reopens only done measures (approve): Do, in progress, no completion date, history kept", async () => {
    const s = await setup();
    const { id } = await measureAt(s, "done");
    const reviewsBefore = await reviewsOf(id);
    await reopenMeasure(s.byRole.reviewer, id);
    expect(await row(id)).toMatchObject({ phase: "do", status: "in_progress", completedAt: null, cycle: 1 });
    expect(await reviewsOf(id)).toEqual(reviewsBefore);
    expect((await listAuditEvents(s.ctxA, 1))[0]).toMatchObject({
      eventType: "measure.reopened",
      beforeJson: { status: "done", completedAt: expect.any(String) },
      afterJson: { status: "in_progress", phase: "do", completedAt: null },
    });
    // Danach läuft der Kreislauf normal weiter und lässt sich erneut abschliessen.
    const { stepId } = await addStep(s.ctxA, id, "Nacharbeit");
    await toggleStep(s.ctxA, id, stepId, true, NOW);
    await completeDo(s.ctxA, id, {});
    await recordEffectiveness(s.ctxA, id, { result: "effective", note: "Jetzt in Ordnung" });
    await closeMeasure(s.ctxA, id, {}, NOW);
    expect((await row(id)).status).toBe("done");
  });

  it("refuses to close an Act measure that has no review at all (defensive) and writes nothing", async () => {
    const s = await setup();
    const { id } = await measureAt(s, "act");
    // Zustand, den der Service nie erzeugt: Act ohne Bewertung (Bewertung ist append-only, also über eine zweite Massnahme simulieren).
    const bare = await create(s, "Ohne Bewertung");
    await db.update(measure).set({ phase: "act", status: "in_progress" }).where(eq(measure.id, bare));
    const before = await events(s);
    await expect(closeMeasure(s.ctxA, bare, { reason: "Eine ausreichend lange Begründung" }, NOW)).rejects.toThrow(/keine Wirksamkeitsbewertung/);
    await expect(closeMeasure(s.ctxA, bare, {}, NOW)).rejects.toBeInstanceOf(ValidationError);
    expect(await events(s)).toBe(before);
    expect((await row(bare)).status).toBe("in_progress");
    await closeMeasure(s.ctxA, id, {}, NOW);
  });

  it("rejects the Act decisions on a closed measure with a clear message", async () => {
    const s = await setup();
    const { id } = await measureAt(s, "done");
    for (const call of [() => closeMeasure(s.ctxA, id, {}, NOW), () => refineMeasure(s.ctxA, id), () => startNewCycle(s.ctxA, id)]) {
      await expect(call()).rejects.toThrow(/bereits abgeschlossen.*wiedereröffnet/);
    }
  });
});

describe("tenant isolation", () => {
  beforeEach(resetDb);

  it("answers a foreign, unknown and malformed id with the identical message and changes nothing", async () => {
    const s = await setup();
    const { id, stepIds } = await measureAt(s, "do");
    const rowBefore = await row(id);
    const eventsA = await events(s);
    const stepA = stepIds[0];
    const calls: ((target: string) => Promise<unknown>)[] = [
      (t) => setEffectivenessCriterion(s.ctxB, t, "Ein Kriterium"),
      (t) => completePlan(s.ctxB, t),
      (t) => addStep(s.ctxB, t, "Ein Schritt"),
      (t) => renameStep(s.ctxB, t, stepA, "Neuer Titel"),
      (t) => toggleStep(s.ctxB, t, stepA, true, NOW),
      (t) => removeStep(s.ctxB, t, stepA),
      (t) => moveStep(s.ctxB, t, stepA, "down"),
      (t) => completeDo(s.ctxB, t, { confirmNoSteps: true }),
      (t) => recordEffectiveness(s.ctxB, t, { result: "effective", note: "Fremde Notiz" }),
      (t) => closeMeasure(s.ctxB, t, {}, NOW),
      (t) => refineMeasure(s.ctxB, t),
      (t) => startNewCycle(s.ctxB, t),
      (t) => reopenMeasure(s.ctxB, t),
      (t) => getMeasureDetail(s.ctxB, t, NOW),
    ];
    for (const call of calls) {
      for (const target of [id, randomUUID(), "kein-uuid"]) {
        await expect(call(target)).rejects.toThrow(new ValidationError(NOT_FOUND));
      }
    }
    expect(await row(id)).toEqual(rowBefore);
    expect(await stepsOf(id)).toHaveLength(2);
    expect(await events(s)).toBe(eventsA);
    expect(await listAuditEvents(s.ctxB)).toEqual([]);
  });

  it("keeps the figures per organization", async () => {
    const s = await setup();
    await measureAt(s, "done");
    const figures = await getPdcaFigures(s.ctxB);
    expect(figures.total).toBe(0);
    expect(figures.phases).toEqual({ plan: 0, do: 0, check: 0, act: 0 });
    expect(figures.effective).toEqual({ percent: null, n: 0 });
    expect(figures.averageDaysToClose).toEqual({ days: null, n: 0 });
  });
});

describe("concurrency", () => {
  beforeEach(resetDb);

  it("lets exactly one of two parallel completeDo calls win and chains the audit trail", async () => {
    const s = await setup();
    for (let round = 0; round < 6; round++) {
      const { id, stepIds } = await measureAt(s, "do", `Runde ${round}`);
      for (const stepId of stepIds) await toggleStep(s.ctxA, id, stepId, true, NOW);
      const before = await events(s);
      const results = await Promise.allSettled([completeDo(s.ctxA, id, {}), completeDo(s.byRole.editor, id, {})]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const failed = results.find((r) => r.status === "rejected");
      expect((failed as PromiseRejectedResult).reason).toBeInstanceOf(ValidationError);
      expect(await events(s)).toBe(before + 1);
      const changes = (await db.select().from(auditEvent).where(and(eq(auditEvent.entityId, id), eq(auditEvent.eventType, "measure.phase_changed"))).orderBy(asc(auditEvent.createdAt)));
      expect(changes.map((e) => (e.afterJson as { phase: string }).phase)).toEqual(["do", "check"]);
      expect(changes[1].beforeJson).toMatchObject({ phase: "do" });
      expect((await row(id)).phase).toBe("check");
    }
  });

  it("lets exactly one Act decision win when close, refine and new cycle race", async () => {
    const s = await setup();
    for (let round = 0; round < 5; round++) {
      const { id } = await measureAt(s, "act", `Akt ${round}`);
      const before = await events(s);
      const results = await Promise.allSettled([
        closeMeasure(s.ctxA, id, {}, NOW), refineMeasure(s.ctxA, id), startNewCycle(s.ctxA, id),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await events(s)).toBe(before + 1);
      const r = await row(id);
      expect([r.status === "done", r.phase === "do", r.phase === "plan"].filter(Boolean)).toHaveLength(1);
      expect(r.cycle).toBe(r.phase === "plan" ? 2 : 1);
    }
  });

  it("keeps step positions unique when steps are added in parallel", async () => {
    const s = await setup();
    const id = await create(s);
    await completePlan(s.ctxA, id);
    await Promise.all(Array.from({ length: 6 }, (_, i) => addStep(s.ctxA, id, `Schritt ${i + 1}`)));
    expect((await stepsOf(id)).map((x) => x.position)).toEqual([1, 2, 3, 4, 5, 6]);
    const added = await db.select().from(auditEvent).where(and(eq(auditEvent.entityId, id), eq(auditEvent.eventType, "measure.step_added")));
    expect(added).toHaveLength(6);
  });
});

describe("getMeasureDetail", () => {
  beforeEach(resetDb);

  it("returns the measure with criterion title, owner, steps with names, reviews and allowed actions", async () => {
    const s = await setup();
    const { id, stepIds } = await measureAt(s, "act");
    const detail = await getMeasureDetail(s.byRole.reviewer, id, NOW);
    expect(detail.measure).toMatchObject({
      id, title: "Hygieneschulung planen", criterionNumber: "7.3.10", criterionTitle: "K 7.3.10", ownerName: s.a.user.name,
      status: "in_progress", phase: "act", cycle: 1, effectivenessCriterion: null, overdue: false,
    });
    expect(detail.steps.map((x) => [x.id, x.title, x.position, x.done, x.doneByName])).toEqual([
      [stepIds[0], "Schritt eins", 1, true, s.a.user.name],
      [stepIds[1], "Schritt zwei", 2, true, s.a.user.name],
    ]);
    expect(detail.reviewsByCycle).toHaveLength(1);
    expect(detail.reviewsByCycle[0].reviews[0]).toMatchObject({ result: "effective", note: "Wirkung belegt", checkedByName: s.a.user.name });
    expect(detail.allowedActions).toEqual(["close", "refine", "start_cycle"]);
    expect((await getMeasureDetail(s.byRole.editor, id, NOW)).allowedActions).toEqual([]);
    expect((await getMeasureDetail(s.byRole.viewer, id, NOW)).allowedActions).toEqual([]);
  });

  it("derives the allowed actions from role and phase", () => {
    const at = (phase: "plan" | "do" | "check" | "act", status: "open" | "in_progress" | "done" = "in_progress") => ({ phase, status });
    expect(allowedMeasureActions("editor", at("plan", "open"))).toEqual(["set_criterion", "complete_plan"]);
    expect(allowedMeasureActions("editor", at("do"))).toEqual(["set_criterion", "edit_steps", "complete_do"]);
    expect(allowedMeasureActions("editor", at("check"))).toEqual([]);
    expect(allowedMeasureActions("reviewer", at("check"))).toEqual(["record_effectiveness"]);
    expect(allowedMeasureActions("owner", at("act"))).toEqual(["close", "refine", "start_cycle"]);
    expect(allowedMeasureActions("owner", at("act", "done"))).toEqual(["reopen"]);
    expect(allowedMeasureActions("editor", at("act", "done"))).toEqual([]);
    expect(allowedMeasureActions("viewer", at("do"))).toEqual([]);
  });

  it("marks an overdue measure and a done one correctly", async () => {
    const s = await setup();
    const id = await create(s);
    await db.update(measure).set({ dueDate: "2026-10-01" }).where(eq(measure.id, id));
    expect((await getMeasureDetail(s.ctxA, id, NOW)).measure).toMatchObject({ days: -7, overdue: true });
    const done = await measureAt(s, "done", "Fertig");
    await db.update(measure).set({ dueDate: "2026-10-01" }).where(eq(measure.id, done.id));
    expect((await getMeasureDetail(s.ctxA, done.id, NOW)).measure.overdue).toBe(false);
  });
});

describe("getPdcaFigures", () => {
  beforeEach(resetDb);

  it("returns null instead of numbers when nothing has been reviewed or closed", async () => {
    const s = await setup();
    expect(await getPdcaFigures(s.ctxA)).toEqual({
      total: 0, phases: { plan: 0, do: 0, check: 0, act: 0 }, effective: { percent: null, n: 0 }, averageDaysToClose: { days: null, n: 0 },
    });
    await create(s);
    await measureAt(s, "do");
    const f = await getPdcaFigures(s.ctxA);
    expect(f).toMatchObject({ total: 2, phases: { plan: 1, do: 1, check: 0, act: 0 }, effective: { percent: null, n: 0 } });
    expect(f.averageDaysToClose).toEqual({ days: null, n: 0 });
  });

  it("counts the share of effective latest reviews among reviewed measures, with n", async () => {
    const s = await setup();
    await measureAt(s, "act", "Eins"); // effective
    const two = await measureAt(s, "check", "Zwei");
    await recordEffectiveness(s.ctxA, two.id, { result: "not_effective", note: "Nicht wirksam" });
    const three = await measureAt(s, "check", "Drei");
    await recordEffectiveness(s.ctxA, three.id, { result: "partly", note: "Teilweise" });
    await refineMeasure(s.ctxA, three.id);
    await completeDo(s.ctxA, three.id, {});
    await recordEffectiveness(s.ctxA, three.id, { result: "effective", note: "Jetzt wirksam" }); // latest wins
    await measureAt(s, "do", "Vier"); // unreviewed, does not count
    const f = await getPdcaFigures(s.ctxA);
    expect(f.total).toBe(4);
    expect(f.phases).toEqual({ plan: 0, do: 1, check: 0, act: 3 });
    expect(f.effective).toEqual({ percent: 67, n: 3 });
  });

  it("averages days from creation to completion over closed measures only, with n", async () => {
    const s = await setup();
    const one = await measureAt(s, "act", "Eins");
    const two = await measureAt(s, "act", "Zwei");
    await measureAt(s, "act", "Offen im Act");
    const day = 86_400_000;
    const created = new Date("2026-09-01T10:00:00Z");
    await db.update(measure).set({ createdAt: created }).where(eq(measure.id, one.id));
    await db.update(measure).set({ createdAt: created }).where(eq(measure.id, two.id));
    await closeMeasure(s.ctxA, one.id, {}, new Date(created.getTime() + 10 * day));
    await closeMeasure(s.ctxA, two.id, {}, new Date(created.getTime() + 15 * day));
    expect((await getPdcaFigures(s.ctxA)).averageDaysToClose).toEqual({ days: 12.5, n: 2 });
  });

  it("never reports a negative duration", async () => {
    const s = await setup();
    const one = await measureAt(s, "act", "Eins");
    await closeMeasure(s.ctxA, one.id, {}, new Date("2020-01-01T00:00:00Z"));
    expect((await getPdcaFigures(s.ctxA)).averageDaysToClose).toEqual({ days: 0, n: 1 });
  });
});
