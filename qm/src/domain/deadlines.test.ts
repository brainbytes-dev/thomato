import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { deadline } from "@/db/schema";
import { listDeadlines } from "./deadlines";
import { ctxFor, makeOrg, resetDb } from "@/test/helpers";

const NOW = new Date("2026-10-07T10:00:00Z");

describe("listDeadlines", () => {
  beforeEach(resetDb);

  it("returns only the deadlines of the own organisation, ordered by date, with days and urgency", async () => {
    const a = await makeOrg("dl-a");
    const b = await makeOrg("dl-b");
    await db.insert(deadline).values([
      { organizationId: a.org.id, kind: "dossier", label: "Dossier", dueDate: "2026-12-01" },
      { organizationId: a.org.id, kind: "application", label: "Antrag", dueDate: "2026-10-20" },
      { organizationId: a.org.id, kind: "custom", label: "Überfällig", dueDate: "2026-10-01" },
      { organizationId: b.org.id, kind: "expiry", label: "Fremd", dueDate: "2027-01-01" },
    ]);
    const list = await listDeadlines(ctxFor(a.org.id, a.user.id, "viewer"), NOW);
    expect(list.map((d) => d.label)).toEqual(["Überfällig", "Antrag", "Dossier"]);
    expect(list[0]).toMatchObject({ days: -6, urgency: "overdue" });
    expect(list[1]).toMatchObject({ days: 13, urgency: "soon" });
    expect(list[2]).toMatchObject({ days: 55, urgency: "upcoming" });
    expect(list.some((d) => d.label === "Fremd")).toBe(false);
  });
});
