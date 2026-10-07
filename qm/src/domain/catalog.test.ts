import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { criterion, standardVersion } from "@/db/schema";
import { importCatalog } from "./catalog";
import { resetDb } from "@/test/helpers";

const row = (nummer: string, titel = "Titel") => ({
  nummer,
  titel,
  kapitel: "Prozess",
  anerkennung_muss: true,
  anerkennung_soll: false,
  erneuerung_muss: true,
  erneuerung_soll: false,
  sortierung: 80100,
});

describe("importCatalog", () => {
  beforeEach(resetDb);

  it("imports rows and keeps the version draft_extracted", async () => {
    await importCatalog(db, { standardVersionId: "v", label: "V", rows: [row("8.1"), row("8.2")] });
    expect(await db.select().from(criterion)).toHaveLength(2);
    const [v] = await db.select().from(standardVersion).where(eq(standardVersion.id, "v"));
    expect(v.validationStatus).toBe("draft_extracted");
  });

  it("is idempotent and updates changed titles", async () => {
    await importCatalog(db, { standardVersionId: "v", label: "V", rows: [row("8.1", "Alt")] });
    await importCatalog(db, { standardVersionId: "v", label: "V", rows: [row("8.1", "Neu")] });
    const rows = await db.select().from(criterion);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Neu");
  });

  it("strips private-use and control characters from titles", async () => {
    await importCatalog(db, {
      standardVersionId: "v",
      label: "V",
      rows: [row("6.7", "Personalplanung gemäss Punkt 7.8\uF020"), row("6.8", " A\u200B  b\tc ")],
    });
    const rows = await db.select().from(criterion);
    expect(rows.find((r) => r.number === "6.7")?.title).toBe("Personalplanung gemäss Punkt 7.8");
    expect(rows.find((r) => r.number === "6.8")?.title).toBe("A b c");
  });

  it("aborts the whole import when one row has no number", async () => {
    await expect(
      importCatalog(db, { standardVersionId: "v", label: "V", rows: [row("8.1"), { ...row("x"), nummer: "" }] }),
    ).rejects.toThrow();
    expect(await db.select().from(criterion)).toHaveLength(0);
  });

  it("does not turn the version validated when one rule is validated", async () => {
    await importCatalog(db, { standardVersionId: "v", label: "V", rows: [row("8.1")] });
    await db.update(criterion).set({ ruleValidationStatus: "validated" });
    const [v] = await db.select().from(standardVersion);
    expect(v.validationStatus).toBe("draft_extracted");
  });
});
