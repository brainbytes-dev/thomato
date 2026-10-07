import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scopeLabel, STATUS_LABEL } from "./status-copy";

const base = { number: "1", chapter: "x" };

describe("status-copy is client-safe", () => {
  it.each(["src/components/criteria/status-copy.ts", "src/domain/procedure.ts", "src/domain/readiness.ts"])(
    "%s does not import the database client",
    (file) => {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source).not.toMatch(/from\s+["']@\/db["']/);
      expect(source).not.toMatch(/from\s+["']@\/db\/(?!schema["'])/);
      expect(source).not.toMatch(/from\s+["'](\.\/|@\/domain\/)dashboard["']/);
    },
  );
});

describe("assessment form files are client-safe", () => {
  it.each(["src/app/(app)/criteria/[number]/assessment-form.tsx", "src/app/(app)/criteria/[number]/action-input.ts"])(
    "%s has no value import of server modules",
    (file) => {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      const valueImports = source
        .split("\n")
        .filter((line) => /^import\s/.test(line) && !/^import\s+type\s/.test(line));
      for (const line of valueImports) {
        expect(line).not.toMatch(/["']@\/db["']/);
        expect(line).not.toMatch(/["'](\.\/|@\/domain\/)(dashboard|assessments)["']/);
        if (file.endsWith(".tsx")) expect(line).not.toMatch(/["']@\/db\/schema["']/);
      }
    },
  );
});

describe("STATUS_LABEL", () => {
  it("covers all five statuses", () => {
    expect(STATUS_LABEL).toEqual({
      not_assessed: "Nicht bewertet",
      met: "Erfüllt",
      open: "Offen",
      critical: "Kritisch",
      not_applicable: "Nicht anwendbar",
    });
  });
});

describe("scopeLabel", () => {
  it("labels mandatory, should and out-of-procedure criteria", () => {
    const off = { mandatoryAccreditation: false, shouldAccreditation: false, mandatoryRenewal: false, shouldRenewal: false };
    expect(scopeLabel({ ...base, ...off, mandatoryAccreditation: true })).toBe("Muss");
    expect(scopeLabel({ ...base, ...off, shouldAccreditation: true })).toBe("Soll");
    expect(scopeLabel({ ...base, ...off, mandatoryRenewal: true })).toBe("- (nicht im Verfahren)");
  });
});
