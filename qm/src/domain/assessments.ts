import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  ACTIVE_STANDARD_VERSION,
  criterion,
  criterionAssessment,
  type AssessmentStatus,
} from "@/db/schema";
import { withAudit } from "./audit";
import { assertCan, type OrgContext } from "./org-context";

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

export async function setAssessmentStatus(
  ctx: OrgContext,
  criterionId: string,
  status: AssessmentStatus,
): Promise<{ id: string; status: AssessmentStatus }> {
  assertCan(ctx, "assessment", "write");
  return withAudit(ctx, async (tx) => {
    const [before] = await tx
      .select()
      .from(criterionAssessment)
      .where(
        and(
          eq(criterionAssessment.organizationId, ctx.organizationId),
          eq(criterionAssessment.criterionId, criterionId),
        ),
      );
    const [after] = await tx
      .insert(criterionAssessment)
      .values({ organizationId: ctx.organizationId, criterionId, status })
      .onConflictDoUpdate({
        target: [criterionAssessment.organizationId, criterionAssessment.criterionId],
        set: { status, updatedAt: new Date() },
      })
      .returning();
    return {
      result: { id: after.id, status: after.status },
      event: {
        eventType: "criterion.status_changed",
        entityType: "criterion_assessment",
        entityId: after.id,
        before: before ? { status: before.status } : { status: "not_assessed" },
        after: { status: after.status },
      },
    };
  });
}
