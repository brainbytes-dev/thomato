import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION } from "@/db/schema";
import { importCatalog } from "./catalog";
import { catalogHasNumber, isWellFormedCriterionNumber, parseCriterionParam } from "./criterion-lookup";
import { resetDb } from "@/test/helpers";

describe("isWellFormedCriterionNumber", () => {
  it("accepts dotted numbers and rejects everything else", () => {
    expect(isWellFormedCriterionNumber("7.3.10")).toBe(true);
    expect(isWellFormedCriterionNumber("12")).toBe(true);
    for (const bad of ["abc", "", "7..3", "7.3.", ".7", "7.3.10; drop", "1".repeat(40), "7 3"]) {
      expect(isWellFormedCriterionNumber(bad)).toBe(false);
    }
  });
});

describe("catalog lookup", () => {
  beforeEach(resetDb);

  it("is true only for numbers of the active catalog", async () => {
    await importCatalog(db, {
      standardVersionId: ACTIVE_STANDARD_VERSION,
      label: "Entwurf",
      rows: [{ nummer: "7.3.10", titel: "Hygiene", kapitel: "Prozess", anerkennung_muss: true, anerkennung_soll: false, erneuerung_muss: true, erneuerung_soll: false, sortierung: 1 }],
    });
    expect(await catalogHasNumber("7.3.10")).toBe(true);
    expect(await catalogHasNumber("9.9.9")).toBe(false);
    expect(parseCriterionParam("7.3.10")).toBe("7.3.10");
    expect(parseCriterionParam("abc")).toBeNull();
    expect(parseCriterionParam("%E0%A4%A")).toBeNull();
  });
});
