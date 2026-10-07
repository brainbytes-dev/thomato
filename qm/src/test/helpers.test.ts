import { describe, expect, it } from "vitest";
import { authId } from "./helpers";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("test helper ids", () => {
  it("look like Better Auth ids: 32 alphanumeric characters, never UUID-shaped", () => {
    const ids = Array.from({ length: 200 }, () => authId());
    for (const id of ids) {
      expect(id).toMatch(/^[A-Za-z0-9]{32}$/);
      expect(id).not.toMatch(UUID);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});
