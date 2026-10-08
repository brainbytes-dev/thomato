import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/domain/measure-lookup", () => ({
  measureProvablyMissing: () => new Promise<boolean>(() => {}),
}));

import { proxy } from "./proxy";

describe("proxy when the measure lookup hangs", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("passes the request on after the lookup timeout instead of waiting for the pool", async () => {
    const id = "4f930425-67d6-4cd0-a32a-56c78a4c87b4";
    const request = new NextRequest(`http://localhost:3000/measures/${id}`, {
      headers: { cookie: "better-auth.session_token=abc123.sig" },
    });
    const pending = proxy(request);
    await vi.advanceTimersByTimeAsync(1600);
    const res = await pending;
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
