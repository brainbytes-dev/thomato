import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvent } from "@/db/schema";
import { makeOrg, resetDb } from "@/test/helpers";

// drizzle verpackt den PG-Fehler: Originalmeldung steht in error.cause.
async function rejectionText(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
    return `${error instanceof Error ? error.message : String(error)} ${cause}`;
  }
  throw new Error("erwartete Ablehnung blieb aus");
}

describe("audit_event is append-only", () => {
  beforeEach(resetDb);

  it("rejects UPDATE and DELETE", async () => {
    const { org, user } = await makeOrg("audit-a");
    const [e] = await db
      .insert(auditEvent)
      .values({ organizationId: org.id, actorUserId: user.id, eventType: "test.created", entityType: "test", entityId: "1" })
      .returning();
    expect(await rejectionText(db.execute(sql`UPDATE audit_event SET event_type = 'x' WHERE id = ${e.id}`))).toMatch(/append-only/);
    expect(await rejectionText(db.execute(sql`DELETE FROM audit_event WHERE id = ${e.id}`))).toMatch(/append-only/);
  });
});
