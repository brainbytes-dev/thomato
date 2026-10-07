import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { auth } from "./auth";
import { resetDb } from "@/test/helpers";

describe("auth", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("signs up a user and creates an organization with owner membership", async () => {
    const { user } = await auth.api.signUpEmail({
      body: { email: "a@example.test", password: "correct-horse-battery-1", name: "A" },
    });
    const org = await auth.api.createOrganization({
      body: { name: "Org A", slug: "org-a", userId: user.id },
    });
    const members = await db
      .select()
      .from(schema.member)
      .where(eq(schema.member.organizationId, org.id));
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe("owner");
  });
});
