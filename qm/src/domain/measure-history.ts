import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditEvent, user } from "@/db/schema";
import { assertCan, type OrgContext } from "./org-context";
import type { HistoryEntry } from "./assessments";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Verlauf einer einzelnen Massnahme (nur Audit-Recht): ihre Events, neueste zuerst. Fremde und unbekannte IDs liefern eine leere Liste. */
export async function listMeasureHistory(ctx: OrgContext, measureId: string): Promise<HistoryEntry[]> {
  assertCan(ctx, "audit", "read");
  if (!UUID.test(measureId)) return [];
  return db
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
        eq(auditEvent.entityType, "measure"),
        eq(auditEvent.entityId, measureId),
      ),
    )
    .orderBy(desc(auditEvent.createdAt), desc(auditEvent.id))
    .limit(100);
}
