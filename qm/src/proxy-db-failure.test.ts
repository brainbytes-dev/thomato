import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/domain/criterion-lookup", () => ({
  criterionExistsMemoized: async () => {
    throw new Error("Datenbank nicht erreichbar");
  },
}));

vi.mock("@/domain/measure-lookup", () => ({
  measureProvablyMissing: async () => {
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

  it("passes a measure detail request with a session cookie through when the measure lookup fails", async () => {
    const id = "3f2b8c1e-5d4a-4e6b-9a7c-1b2c3d4e5f60";
    const res = await proxy(req(`/measures/${id}`, "better-auth.session_token=x.y"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect((await proxy(req(`/measures/${id}`))).status).toBe(307);
  });
});
