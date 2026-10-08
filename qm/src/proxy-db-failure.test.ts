import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/domain/criterion-lookup", () => ({
  criterionExistsMemoized: async () => {
    throw new Error("Datenbank nicht erreichbar");
  },
}));

import { proxy } from "./proxy";

const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined);

describe("proxy when the catalog lookup fails", () => {
  it("does not turn a database outage into a 500, the normal cookie check still applies", async () => {
    const anonymous = await proxy(req("/criteria/7.3.10"));
    expect(anonymous.status).toBe(307);
    const withCookie = await proxy(req("/criteria/7.3.10", "better-auth.session_token=x.y"));
    expect(withCookie.headers.get("x-middleware-next")).toBe("1");
  });
});
