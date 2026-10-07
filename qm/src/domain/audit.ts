import { desc, eq } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { auditEvent, type AuditEventRow } from "@/db/schema";
import type { OrgContext } from "./org-context";

export type AuditEventInput = {
  eventType: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

/** Führt die Aktion und das Audit-Event in einer Transaktion aus: beides oder nichts. */
export async function withAudit<T>(
  ctx: OrgContext,
  fn: (tx: Tx) => Promise<{ result: T; event: AuditEventInput }>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const { result, event } = await fn(tx);
    await tx.insert(auditEvent).values({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
      beforeJson: event.before ?? null,
      afterJson: event.after ?? null,
    });
    return result;
  });
}

export async function listAuditEvents(ctx: OrgContext, limit = 100): Promise<AuditEventRow[]> {
  return db
    .select()
    .from(auditEvent)
    .where(eq(auditEvent.organizationId, ctx.organizationId))
    .orderBy(desc(auditEvent.createdAt))
    .limit(limit);
}
