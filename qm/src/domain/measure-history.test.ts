import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION } from "@/db/schema";
import { importCatalog } from "./catalog";
import { listMeasureHistory, MEASURE_HISTORY_LIMIT } from "./measure-history";
import { addStep, completePlan } from "./measure-pdca";
import { createMeasure } from "./measures";
import { ForbiddenError } from "./org-context";
import { addMemberTo, ctxFor, makeOrg, resetDb } from "@/test/helpers";

describe("listMeasureHistory", () => {
  beforeEach(async () => {
    await resetDb();
    await importCatalog(db, {
      standardVersionId: ACTIVE_STANDARD_VERSION,
      label: "t",
      rows: [{ nummer: "7.3.10", titel: "K", kapitel: "Prozess", anerkennung_muss: true, anerkennung_soll: false, erneuerung_muss: true, erneuerung_soll: false, sortierung: 1 }],
    });
  });

  it("returns only the events of this measure, newest first, and nothing for foreign or malformed ids", async () => {
    const a = await makeOrg("hist-a");
    const b = await makeOrg("hist-b");
    const ctxA = ctxFor(a.org.id, a.user.id, "owner");
    const ctxB = ctxFor(b.org.id, b.user.id, "owner");
    const mk = (ctx: typeof ctxA, ownerId: string, title: string) =>
      createMeasure(ctx, { criterionNumber: "7.3.10", title, description: null, ownerUserId: ownerId, dueDate: "2026-11-15" });
    const m1 = await mk(ctxA, a.user.id, "Erste Massnahme");
    const m2 = await mk(ctxA, a.user.id, "Zweite Massnahme");
    await completePlan(ctxA, m1.id);
    await addStep(ctxA, m1.id, "Schritt eins");
    const events = await listMeasureHistory(ctxA, m1.id);
    expect(events.map((e) => e.eventType)).toEqual(["measure.step_added", "measure.phase_changed", "measure.created"]);
    expect(events.every((e) => e.actorName === a.user.name)).toBe(true);
    expect((await listMeasureHistory(ctxA, m2.id)).map((e) => e.eventType)).toEqual(["measure.created"]);
    expect(await listMeasureHistory(ctxB, m1.id)).toEqual([]);
    expect(await listMeasureHistory(ctxA, "not-a-uuid")).toEqual([]);
  });

  it("loads one entry more than it shows so the UI can tell older ones exist", async () => {
    const a = await makeOrg("hist-d");
    const ctx = ctxFor(a.org.id, a.user.id, "owner");
    const m = await createMeasure(ctx, { criterionNumber: "7.3.10", title: "Viele Ereignisse", description: null, ownerUserId: a.user.id, dueDate: "2026-11-15" });
    await completePlan(ctx, m.id);
    for (let i = 0; i < MEASURE_HISTORY_LIMIT + 3; i++) await addStep(ctx, m.id, `Schritt ${i + 100}`);
    expect(await listMeasureHistory(ctx, m.id)).toHaveLength(MEASURE_HISTORY_LIMIT + 1);
  });

  it("requires the audit right", async () => {
    const a = await makeOrg("hist-c");
    const editor = await addMemberTo(a.org.id, "Editor", "editor");
    await expect(listMeasureHistory(ctxFor(a.org.id, editor.id, "editor"), "3f2b8c1e-5d4a-4e6b-9a7c-1b2c3d4e5f60")).rejects.toBeInstanceOf(ForbiddenError);
  });
});
