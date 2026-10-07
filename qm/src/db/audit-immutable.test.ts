import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvent } from "@/db/schema";
import { makeOrg, resetDb } from "@/test/helpers";

describe("audit_event is append-only", () => {
  beforeEach(resetDb);

  it("rejects UPDATE and DELETE", async () => {
    const { org, user } = await makeOrg("audit-a");
    const [e] = await db
      .insert(auditEvent)
      .values({ organizationId: org.id, actorUserId: user.id, eventType: "test.created", entityType: "test", entityId: "1" })
      .returning();
    await expect(db.execute(sql`UPDATE audit_event SET event_type = 'x' WHERE id = ${e.id}`)).rejects.toThrow();
    await expect(db.execute(sql`DELETE FROM audit_event WHERE id = ${e.id}`)).rejects.toThrow();
  });
});
