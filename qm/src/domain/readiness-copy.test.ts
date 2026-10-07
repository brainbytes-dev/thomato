import { describe, expect, it } from "vitest";
import { naMandatoryNotice } from "./readiness-copy";

describe("naMandatoryNotice", () => {
  it("is null for zero and uses singular and plural", () => {
    expect(naMandatoryNotice(0)).toBeNull();
    expect(naMandatoryNotice(-1)).toBeNull();
    expect(naMandatoryNotice(1)).toBe("1 Pflichtkriterium als nicht anwendbar markiert");
    expect(naMandatoryNotice(3)).toBe("3 Pflichtkriterien als nicht anwendbar markiert");
  });
});
