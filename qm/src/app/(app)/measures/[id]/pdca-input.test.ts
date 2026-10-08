import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addStepInput, closeInput, completeDoInput, criterionInput, idInput, moveStepInput, recordInput, toggleStepInput,
} from "./pdca-input";

const ID = "3f2b8c1e-5d4a-4e6b-9a7c-1b2c3d4e5f60";

describe("pdca input", () => {
  it("accepts only uuids as measure ids", () => {
    expect(idInput.safeParse({ measureId: ID }).success).toBe(true);
    expect(idInput.safeParse({ measureId: "1" }).success).toBe(false);
    expect(idInput.safeParse({}).success).toBe(false);
  });

  it("keeps the German message for oversized or missing text", () => {
    const r = criterionInput.safeParse({ measureId: ID, effectivenessCriterion: "x".repeat(2001) });
    expect(r.success).toBe(false);
    expect(addStepInput.safeParse({ measureId: ID }).success).toBe(false);
    expect(addStepInput.safeParse({ measureId: ID, title: "Schritt" }).success).toBe(true);
  });

  it("parses the toggle target explicitly and rejects anything else", () => {
    const stepId = ID;
    expect(toggleStepInput.parse({ measureId: ID, stepId, done: "true" }).done).toBe(true);
    expect(toggleStepInput.parse({ measureId: ID, stepId, done: "false" }).done).toBe(false);
    expect(toggleStepInput.safeParse({ measureId: ID, stepId, done: "1" }).success).toBe(false);
    expect(moveStepInput.safeParse({ measureId: ID, stepId, direction: "left" }).success).toBe(false);
  });

  it("maps the confirmation checkbox to a boolean", () => {
    expect(completeDoInput.parse({ measureId: ID, confirmNoSteps: "on" }).confirmNoSteps).toBe(true);
    expect(completeDoInput.parse({ measureId: ID }).confirmNoSteps).toBe(false);
    expect(completeDoInput.parse({ measureId: ID, confirmNoSteps: "yes" }).confirmNoSteps).toBe(false);
  });

  it("requires a known review result and ignores unknown fields such as checkedAt", () => {
    expect(recordInput.safeParse({ measureId: ID, result: "great", note: "abc" }).success).toBe(false);
    const ok = recordInput.parse({ measureId: ID, result: "partly", note: "Teilweise", checkedAt: "2020-01-01" });
    expect(Object.keys(ok)).not.toContain("checkedAt");
    expect(closeInput.parse({ measureId: ID, reason: "Begründung hier", now: "2020-01-01" })).toEqual({ measureId: ID, reason: "Begründung hier" });
  });
});

describe("server actions never pass test-only parameters", () => {
  const source = readFileSync(join(process.cwd(), "src/app/(app)/measures/[id]/pdca-actions.ts"), "utf8");
  const code = source.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*")).join("\n");

  it("has no checkedAt and no time argument", () => {
    expect(code).not.toMatch(/checkedAt/);
    expect(code).not.toMatch(/new Date\(/);
    expect(code).not.toMatch(/\bnow\b/);
  });

  it("calls the services with the documented arity", () => {
    expect(code).toContain("recordEffectiveness(ctx, d.measureId, { result: d.result, note: d.note })");
    expect(code).toContain("toggleStep(ctx, d.measureId, d.stepId, d.done)");
    expect(code).toContain("closeMeasure(ctx, d.measureId, { reason: d.reason })");
  });
});
