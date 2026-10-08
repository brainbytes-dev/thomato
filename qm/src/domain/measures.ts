import { and, asc, eq, inArray } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  ACTIVE_STANDARD_VERSION, criterion, MEASURE_STATUSES, member, measure, user, type MeasurePhase, type MeasureStatus,
} from "@/db/schema";
import { insertAuditEvent, withAudit, type AuditEventInput } from "./audit";
import { daysUntil, isValidIsoDate } from "./dates";
import { assertCan, ValidationError, type OrgContext } from "./org-context";

export type { MeasurePhase, MeasureStatus };

export type MeasureView = {
  id: string;
  criterionNumber: string;
  title: string;
  description: string | null;
  ownerUserId: string;
  ownerName: string | null;
  dueDate: string;
  status: MeasureStatus;
  phase: MeasurePhase;
  cycle: number;
  completedAt: Date | null;
  createdAt: Date;
  days: number;
  overdue: boolean;
};

export type OpenMeasureView = MeasureView & { criterionTitle: string };

export type MeasureFields = { title: string; description: string | null; ownerUserId: string; dueDate: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TITLE_MIN = 3;
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 1000;
const OWNER_ID_MAX = 64;
export const MEASURE_NOT_FOUND = "Die Massnahme wurde nicht gefunden.";

function validateFields(input: MeasureFields): MeasureFields {
  const title = input.title.trim();
  const length = [...title].length;
  if (length < TITLE_MIN || length > TITLE_MAX) {
    throw new ValidationError(`Der Titel muss zwischen ${TITLE_MIN} und ${TITLE_MAX} Zeichen lang sein.`);
  }
  const trimmed = input.description === null ? "" : input.description.trim();
  if ([...trimmed].length > DESCRIPTION_MAX) {
    throw new ValidationError(`Die Beschreibung darf höchstens ${DESCRIPTION_MAX} Zeichen lang sein.`);
  }
  if (!isValidIsoDate(input.dueDate)) throw new ValidationError("Die Frist ist ungültig.");
  // Better Auth vergibt keine UUIDs; die Mitgliedschaftsprüfung in der Transaktion ist die eigentliche Validierung.
  if (input.ownerUserId.length < 1 || input.ownerUserId.length > OWNER_ID_MAX) {
    throw new ValidationError("Die verantwortliche Person ist ungültig.");
  }
  return { title, description: trimmed === "" ? null : trimmed, ownerUserId: input.ownerUserId, dueDate: input.dueDate };
}

async function assertCriterionExists(number: string): Promise<void> {
  const [row] = await db
    .select({ number: criterion.number })
    .from(criterion)
    .where(and(eq(criterion.standardVersionId, ACTIVE_STANDARD_VERSION), eq(criterion.number, number)));
  if (!row) throw new ValidationError("Das Kriterium wurde nicht gefunden.");
}

/** Liefert den Namen der Person, wenn sie Mitglied der eigenen Organisation ist. */
async function ownerNameOf(tx: Tx, ctx: OrgContext, userId: string): Promise<string> {
  const [row] = await tx
    .select({ name: user.name })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.organizationId, ctx.organizationId), eq(member.userId, userId)));
  if (!row) throw new ValidationError("Die verantwortliche Person ist kein Mitglied der Organisation.");
  return row.name;
}

/** Sperrt die Zeile der eigenen Organisation (FOR UPDATE); fremde, unbekannte und fehlerhafte IDs liefern dieselbe Meldung. */
export async function lockMeasure(tx: Tx, ctx: OrgContext, id: string) {
  if (!UUID.test(id)) throw new ValidationError(MEASURE_NOT_FOUND);
  const [row] = await tx
    .select()
    .from(measure)
    .where(and(eq(measure.id, id), eq(measure.organizationId, ctx.organizationId)))
    .for("update");
  if (!row) throw new ValidationError(MEASURE_NOT_FOUND);
  return row;
}

/** Wie withAudit, aber ohne Event, wenn die Aktion nichts geändert hat (No-op). */
export async function withOptionalAudit<T>(
  ctx: OrgContext,
  fn: (tx: Tx) => Promise<{ result: T; event: AuditEventInput | null }>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const { result, event } = await fn(tx);
    if (event) await insertAuditEvent(tx, ctx, event);
    return result;
  });
}

export async function createMeasure(
  ctx: OrgContext,
  input: MeasureFields & { criterionNumber: string },
): Promise<{ id: string }> {
  assertCan(ctx, "measure", "write");
  const fields = validateFields(input);
  await assertCriterionExists(input.criterionNumber);

  return withAudit(ctx, async (tx) => {
    const ownerName = await ownerNameOf(tx, ctx, fields.ownerUserId);
    const [row] = await tx
      .insert(measure)
      .values({
        organizationId: ctx.organizationId,
        standardVersionId: ACTIVE_STANDARD_VERSION,
        criterionNumber: input.criterionNumber,
        ...fields,
        status: "open",
        completedAt: null,
        createdBy: ctx.userId,
      })
      .returning({ id: measure.id });
    return {
      result: { id: row.id },
      event: {
        eventType: "measure.created",
        entityType: "measure",
        entityId: row.id,
        before: null,
        after: { ...fields, ownerName, status: "open", criterionNumbers: [input.criterionNumber] },
      },
    };
  });
}

export async function updateMeasure(
  ctx: OrgContext,
  id: string,
  input: MeasureFields,
): Promise<{ criterionNumber: string }> {
  assertCan(ctx, "measure", "write");
  const fields = validateFields(input);

  return withOptionalAudit(ctx, async (tx) => {
    const row = await lockMeasure(tx, ctx, id);
    const [beforeOwner] = await tx.select({ name: user.name }).from(user).where(eq(user.id, row.ownerUserId));
    const unchanged =
      row.title === fields.title &&
      row.description === fields.description &&
      row.ownerUserId === fields.ownerUserId &&
      row.dueDate === fields.dueDate;
    if (unchanged) return { result: { criterionNumber: row.criterionNumber }, event: null };
    // Nur bei einem Wechsel der Person prüfen; sonst bleibt eine reine Titeländerung auch nach deren Austritt möglich.
    const ownerName =
      fields.ownerUserId === row.ownerUserId
        ? (beforeOwner?.name ?? null)
        : await ownerNameOf(tx, ctx, fields.ownerUserId);
    await tx
      .update(measure)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(eq(measure.id, row.id), eq(measure.organizationId, ctx.organizationId)));
    const numbers = [row.criterionNumber];
    return {
      result: { criterionNumber: row.criterionNumber },
      event: {
        eventType: "measure.updated",
        entityType: "measure",
        entityId: row.id,
        before: {
          title: row.title,
          description: row.description,
          ownerUserId: row.ownerUserId,
          ownerName: beforeOwner?.name ?? null,
          dueDate: row.dueDate,
          criterionNumbers: numbers,
        },
        after: { ...fields, ownerName, criterionNumbers: numbers },
      },
    };
  });
}

/**
 * Kompatibler Status-Wechsel für Plan und Do: «in_progress» setzt die Phase Do, «open» die Phase Plan.
 * Abgeschlossen wird nur in der Phase Act (closeMeasure); in Check und Act steuern allein die Phasenaktionen.
 */
export async function setMeasureStatus(
  ctx: OrgContext,
  id: string,
  status: MeasureStatus,
): Promise<{ status: MeasureStatus; completedAt: Date | null; criterionNumber: string }> {
  assertCan(ctx, "measure", "write");
  if (!MEASURE_STATUSES.includes(status)) throw new ValidationError("Der Status ist ungültig.");

  return withOptionalAudit(ctx, async (tx) => {
    const row = await lockMeasure(tx, ctx, id);
    if (status === "done") throw new ValidationError("Abgeschlossen wird eine Massnahme in der Phase Act.");
    if (row.phase === "check" || row.phase === "act") {
      throw new ValidationError(
        `In der Phase ${row.phase === "check" ? "Check" : "Act"} wird der Status nur über die Phasenaktionen geändert.`,
      );
    }
    const phase: MeasurePhase = status === "in_progress" ? "do" : "plan";
    const unchanged = { status: row.status, completedAt: row.completedAt, criterionNumber: row.criterionNumber };
    if (row.status === status && row.phase === phase) return { result: unchanged, event: null };
    await tx
      .update(measure)
      .set({ status, phase, completedAt: null, updatedAt: new Date() })
      .where(and(eq(measure.id, row.id), eq(measure.organizationId, ctx.organizationId)));
    const numbers = [row.criterionNumber];
    const statusChanged = row.status !== status;
    return {
      result: { status, completedAt: null, criterionNumber: row.criterionNumber },
      event: {
        // Nur die Phase hat gewechselt (z. B. Plan zu Do bei gleichem Status): kein Statuswechsel, sondern Phasenwechsel.
        eventType: statusChanged ? "measure.status_changed" : "measure.phase_changed",
        entityType: "measure",
        entityId: row.id,
        before: {
          status: row.status,
          phase: row.phase,
          cycle: row.cycle,
          completedAt: row.completedAt ? row.completedAt.toISOString() : null,
          title: row.title,
          criterionNumbers: numbers,
        },
        after: { status, phase, cycle: row.cycle, completedAt: null, title: row.title, criterionNumbers: numbers },
      },
    };
  });
}

export const viewColumns = {
  id: measure.id,
  criterionNumber: measure.criterionNumber,
  title: measure.title,
  description: measure.description,
  ownerUserId: measure.ownerUserId,
  ownerName: user.name,
  dueDate: measure.dueDate,
  status: measure.status,
  phase: measure.phase,
  cycle: measure.cycle,
  completedAt: measure.completedAt,
  createdAt: measure.createdAt,
};

export type ViewRow = Omit<MeasureView, "days" | "overdue">;

export function toView(r: ViewRow, now: Date): MeasureView {
  const days = daysUntil(r.dueDate, now);
  return { ...r, days, overdue: days < 0 && r.status !== "done" };
}

/** Nicht erledigte zuerst nach Frist, dann erledigte nach Erledigungsdatum absteigend. */
function sortViews<T extends MeasureView>(rows: T[]): T[] {
  const done = (m: T) => m.status === "done";
  return [...rows].sort((a, b) => {
    if (done(a) !== done(b)) return done(a) ? 1 : -1;
    if (!done(a)) return a.dueDate.localeCompare(b.dueDate) || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
    return (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0) || a.id.localeCompare(b.id);
  });
}

export async function listCriterionMeasures(ctx: OrgContext, number: string, now: Date): Promise<MeasureView[]> {
  assertCan(ctx, "measure", "read");
  const rows = await db
    .select(viewColumns)
    .from(measure)
    .leftJoin(user, eq(user.id, measure.ownerUserId))
    .where(
      and(
        eq(measure.organizationId, ctx.organizationId),
        eq(measure.standardVersionId, ACTIVE_STANDARD_VERSION),
        eq(measure.criterionNumber, number),
      ),
    )
    .orderBy(asc(measure.dueDate), asc(measure.id));
  return sortViews(rows.map((r) => toView(r, now)));
}

async function listWithCriterion(ctx: OrgContext, now: Date, statuses: readonly MeasureStatus[] | null): Promise<OpenMeasureView[]> {
  const rows = await db
    .select({ ...viewColumns, criterionTitle: criterion.title })
    .from(measure)
    .innerJoin(
      criterion,
      and(eq(criterion.standardVersionId, measure.standardVersionId), eq(criterion.number, measure.criterionNumber)),
    )
    .leftJoin(user, eq(user.id, measure.ownerUserId))
    .where(
      and(
        eq(measure.organizationId, ctx.organizationId),
        eq(measure.standardVersionId, ACTIVE_STANDARD_VERSION),
        statuses ? inArray(measure.status, [...statuses]) : undefined,
      ),
    )
    .orderBy(asc(measure.dueDate), asc(measure.id));
  return sortViews(rows.map(({ criterionTitle, ...r }) => ({ ...toView(r, now), criterionTitle })));
}

export async function listOpenMeasures(ctx: OrgContext, now: Date): Promise<OpenMeasureView[]> {
  assertCan(ctx, "measure", "read");
  return listWithCriterion(ctx, now, ["open", "in_progress"]);
}

/** Alle Massnahmen der Organisation (jeder Status, alle Kriterien) für das Register. */
export async function listAllMeasures(ctx: OrgContext, now: Date): Promise<OpenMeasureView[]> {
  assertCan(ctx, "measure", "read");
  return listWithCriterion(ctx, now, null);
}

export async function listOrgMembers(ctx: OrgContext): Promise<{ userId: string; name: string }[]> {
  assertCan(ctx, "measure", "read");
  return db
    .select({ userId: user.id, name: user.name })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, ctx.organizationId))
    .orderBy(asc(user.name), asc(user.id));
}
