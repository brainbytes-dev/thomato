import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  ACTIVE_STANDARD_VERSION,
  criterion,
  criterionAssessment,
  auditEvent,
  standardVersion,
  user,
  type AssessmentStatus,
} from "@/db/schema";
import { withAudit } from "./audit";
import { isValidIsoDate } from "./dates";
import { assertCan, ValidationError, type OrgContext } from "./org-context";

export type AssessmentRow = {
  criterionId: string;
  number: string;
  title: string;
  chapter: string;
  mandatoryAccreditation: boolean;
  shouldAccreditation: boolean;
  mandatoryRenewal: boolean;
  shouldRenewal: boolean;
  status: AssessmentStatus;
  dueDate: string | null;
  notApplicableReason: string | null;
};

/** Alle Kriterien der aktiven Standardversion, mit dem Stand dieser Organisation. */
export async function listAssessments(ctx: OrgContext): Promise<AssessmentRow[]> {
  assertCan(ctx, "assessment", "read");
  const rows = await db
    .select({
      criterionId: criterion.id,
      number: criterion.number,
      title: criterion.title,
      chapter: criterion.chapter,
      mandatoryAccreditation: criterion.mandatoryAccreditation,
      shouldAccreditation: criterion.shouldAccreditation,
      mandatoryRenewal: criterion.mandatoryRenewal,
      shouldRenewal: criterion.shouldRenewal,
      status: criterionAssessment.status,
      dueDate: criterionAssessment.dueDate,
      notApplicableReason: criterionAssessment.notApplicableReason,
    })
    .from(criterion)
    .leftJoin(
      criterionAssessment,
      and(
        eq(criterionAssessment.criterionId, criterion.id),
        eq(criterionAssessment.organizationId, ctx.organizationId),
      ),
    )
    .where(eq(criterion.standardVersionId, ACTIVE_STANDARD_VERSION))
    .orderBy(criterion.sortOrder);
  return rows.map((r) => ({ ...r, status: r.status ?? "not_assessed" }));
}

export { isValidIsoDate };

export const NA_REASON_MIN = 10;
export const NA_REASON_MAX = 500;

function requireReason(reason: string | null | undefined): string {
  const trimmed = typeof reason === "string" ? reason.trim() : "";
  const length = [...trimmed].length;
  if (length < NA_REASON_MIN || length > NA_REASON_MAX) {
    throw new ValidationError(
      `Für «Nicht anwendbar» ist eine Begründung mit ${NA_REASON_MIN} bis ${NA_REASON_MAX} Zeichen nötig.`,
    );
  }
  return trimmed;
}

type Tx = Parameters<Parameters<typeof withAudit>[1]>[0];

/**
 * Locks the (organization, criterion) row for the rest of the transaction.
 * The row is created first (default status not_assessed) so that there is
 * always something to lock; concurrent writers then serialize here and each
 * one reads the committed result of the previous one as its "before". Without
 * the lock two parallel saves could log a stale "before" and lose the
 * not_applicable audit event.
 */
async function lockAssessment(tx: Tx, ctx: OrgContext, criterionId: string) {
  await tx
    .insert(criterionAssessment)
    .values({ organizationId: ctx.organizationId, criterionId })
    .onConflictDoNothing();
  const [row] = await tx
    .select()
    .from(criterionAssessment)
    .where(
      and(
        eq(criterionAssessment.organizationId, ctx.organizationId),
        eq(criterionAssessment.criterionId, criterionId),
      ),
    )
    .for("update");
  return row;
}

export async function setAssessmentStatus(
  ctx: OrgContext,
  criterionId: string,
  status: AssessmentStatus,
  opts: { reason?: string | null } = {},
): Promise<{ id: string; status: AssessmentStatus }> {
  assertCan(ctx, "assessment", "write");
  const reason = status === "not_applicable" ? requireReason(opts.reason) : null;
  return withAudit(ctx, async (tx) => {
    const before = await lockAssessment(tx, ctx, criterionId);
    const [after] = await tx
      .update(criterionAssessment)
      .set({ status, notApplicableReason: reason, updatedAt: new Date() })
      .where(eq(criterionAssessment.id, before.id))
      .returning();
    const beforeStatus = before.status;
    const touchesNa = beforeStatus === "not_applicable" || after.status === "not_applicable";
    return {
      result: { id: after.id, status: after.status },
      event: {
        eventType: touchesNa ? "criterion.not_applicable_changed" : "criterion.status_changed",
        entityType: "criterion_assessment",
        entityId: after.id,
        before: { status: beforeStatus, reason: before.notApplicableReason },
        after: { status: after.status, reason: after.notApplicableReason },
      },
    };
  });
}

export async function setAssessmentDueDate(
  ctx: OrgContext,
  criterionId: string,
  dueDate: string | null,
): Promise<{ id: string; dueDate: string | null }> {
  assertCan(ctx, "assessment", "write");
  if (dueDate !== null && !isValidIsoDate(dueDate)) {
    throw new ValidationError("Die Frist muss ein gültiges Datum sein.");
  }
  return withAudit(ctx, async (tx) => {
    const before = await lockAssessment(tx, ctx, criterionId);
    const [after] = await tx
      .update(criterionAssessment)
      .set({ dueDate, updatedAt: new Date() })
      .where(eq(criterionAssessment.id, before.id))
      .returning();
    return {
      result: { id: after.id, dueDate: after.dueDate },
      event: {
        eventType: "criterion.due_date_changed",
        entityType: "criterion_assessment",
        entityId: after.id,
        before: { dueDate: before.dueDate },
        after: { dueDate: after.dueDate },
      },
    };
  });
}

export type AssessmentDetail = AssessmentRow & {
  assessmentId: string | null;
  updatedAt: Date | null;
  standardVersionLabel: string;
  standardValidated: boolean;
};

export async function getAssessmentByNumber(ctx: OrgContext, number: string): Promise<AssessmentDetail | null> {
  assertCan(ctx, "assessment", "read");
  const [r] = await db
    .select({
      criterionId: criterion.id,
      number: criterion.number,
      title: criterion.title,
      chapter: criterion.chapter,
      mandatoryAccreditation: criterion.mandatoryAccreditation,
      shouldAccreditation: criterion.shouldAccreditation,
      mandatoryRenewal: criterion.mandatoryRenewal,
      shouldRenewal: criterion.shouldRenewal,
      status: criterionAssessment.status,
      dueDate: criterionAssessment.dueDate,
      notApplicableReason: criterionAssessment.notApplicableReason,
      assessmentId: criterionAssessment.id,
      updatedAt: criterionAssessment.updatedAt,
      standardVersionLabel: standardVersion.label,
      standardValidationStatus: standardVersion.validationStatus,
    })
    .from(criterion)
    .innerJoin(standardVersion, eq(standardVersion.id, criterion.standardVersionId))
    .leftJoin(
      criterionAssessment,
      and(
        eq(criterionAssessment.criterionId, criterion.id),
        eq(criterionAssessment.organizationId, ctx.organizationId),
      ),
    )
    .where(and(eq(criterion.standardVersionId, ACTIVE_STANDARD_VERSION), eq(criterion.number, number)));
  if (!r) return null;
  const { standardValidationStatus, ...rest } = r;
  return { ...rest, status: r.status ?? "not_assessed", standardValidated: standardValidationStatus === "validated" };
}

export type HistoryEntry = {
  id: string;
  createdAt: Date;
  eventType: string;
  actorName: string | null;
  before: unknown;
  after: unknown;
};

/** Verlauf eines Kriteriums: Bewertungs-Events der Bewertung (falls vorhanden) plus Dokument- und Nachweis-Events, die die Nummer nennen. */
export async function listCriterionHistory(
  ctx: OrgContext,
  number: string,
  assessmentId: string | null,
): Promise<HistoryEntry[]> {
  assertCan(ctx, "audit", "read");
  const rows = await db
    .select({
      id: auditEvent.id,
      createdAt: auditEvent.createdAt,
      eventType: auditEvent.eventType,
      actorName: user.name,
      before: auditEvent.beforeJson,
      after: auditEvent.afterJson,
    })
    .from(auditEvent)
    .leftJoin(user, eq(user.id, auditEvent.actorUserId))
    .where(
      and(
        eq(auditEvent.organizationId, ctx.organizationId),
        or(
          assessmentId === null
            ? undefined
            : and(eq(auditEvent.entityType, "criterion_assessment"), eq(auditEvent.entityId, assessmentId)),
          sql`jsonb_exists(${auditEvent.afterJson} -> 'criterionNumbers', ${number})`,
          sql`jsonb_exists(${auditEvent.beforeJson} -> 'criterionNumbers', ${number})`,
        ),
      ),
    )
    .orderBy(desc(auditEvent.createdAt), desc(auditEvent.id))
    .limit(100);
  return rows;
}
