import { describe, expect, it } from "vitest";
import { assertResetAllowed } from "./demo";

const local = "postgres://u:p@localhost:5437/qm_dev";
const remote = "postgres://u:p@ep-foo.eu-central-1.aws.neon.tech/db";

describe("assertResetAllowed", () => {
  it("throws without the flag", () => {
    expect(() => assertResetAllowed({ DATABASE_URL: local })).toThrow(/ALLOW_DEMO_RESET/);
  });
  it("allows localhost with the flag", () => {
    expect(() => assertResetAllowed({ ALLOW_DEMO_RESET: "1", DATABASE_URL: local })).not.toThrow();
  });
  it("refuses a remote host", () => {
    expect(() => assertResetAllowed({ ALLOW_DEMO_RESET: "1", DATABASE_URL: remote })).toThrow(
      /ep-foo/,
    );
  });
  it("allows a remote host with explicit override", () => {
    expect(() =>
      assertResetAllowed({
        ALLOW_DEMO_RESET: "1",
        DATABASE_URL: remote,
        ALLOW_DEMO_RESET_REMOTE: "1",
      }),
    ).not.toThrow();
  });
  it("throws on missing or malformed DATABASE_URL", () => {
    expect(() => assertResetAllowed({ ALLOW_DEMO_RESET: "1" })).toThrow(/DATABASE_URL/);
    expect(() => assertResetAllowed({ ALLOW_DEMO_RESET: "1", DATABASE_URL: "nonsense" })).toThrow(
      /DATABASE_URL/,
    );
  });
});
