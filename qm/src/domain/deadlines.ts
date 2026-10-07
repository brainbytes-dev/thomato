import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { deadline, type DeadlineKind } from "@/db/schema";
import { daysUntil, urgency, type DeadlineUrgency } from "./dates";
import { assertCan, type OrgContext } from "./org-context";

export type DeadlineView = {
  id: string;
  kind: DeadlineKind;
  label: string;
  dueDate: string;
  days: number;
  urgency: DeadlineUrgency;
};

export async function listDeadlines(ctx: OrgContext, now: Date): Promise<DeadlineView[]> {
  assertCan(ctx, "deadline", "read");
  const rows = await db
    .select()
    .from(deadline)
    .where(eq(deadline.organizationId, ctx.organizationId))
    .orderBy(asc(deadline.dueDate));
  return rows.map((r) => {
    const days = daysUntil(r.dueDate, now);
    return { id: r.id, kind: r.kind, label: r.label, dueDate: r.dueDate, days, urgency: urgency(days) };
  });
}
