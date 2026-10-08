import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION } from "@/db/schema";
import { importCatalog } from "@/domain/catalog";
import { clearCriterionMemo } from "@/domain/criterion-lookup";
import { resetDb } from "@/test/helpers";
import { config, proxy } from "./proxy";

const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined);

describe("proxy criterion check (R51)", () => {
  beforeEach(async () => {
    await resetDb();
    clearCriterionMemo();
    await importCatalog(db, {
      standardVersionId: ACTIVE_STANDARD_VERSION,
      label: "Entwurf",
      rows: [{ nummer: "7.3.10", titel: "Hygiene", kapitel: "Prozess", anerkennung_muss: true, anerkennung_soll: false, erneuerung_muss: true, erneuerung_soll: false, sortierung: 1 }],
    });
  });

  it("answers unknown and malformed numbers with a 404 rewrite, even anonymously", async () => {
    for (const path of ["/criteria/9.9.9", "/criteria/abc", "/criteria/%E0%A4%A"]) {
      const res = await proxy(req(path));
      expect(res.status, path).toBe(404);
      expect(res.headers.get("x-middleware-rewrite")).toContain("/_not-found");
    }
  });

  it("keeps the login redirect for a valid number without a session", async () => {
    const res = await proxy(req("/criteria/7.3.10"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("lets a valid number with a session cookie through and ignores other paths", async () => {
    const cookie = "better-auth.session_token=x.y";
    expect((await proxy(req("/criteria/7.3.10", cookie))).headers.get("x-middleware-next")).toBe("1");
    expect((await proxy(req("/criteria", cookie))).headers.get("x-middleware-next")).toBe("1");
    expect((await proxy(req("/criteria"))).status).toBe(307);
  });

  it("redirects /measures without a session, lets it through with one, and matches it", async () => {
    const res = await proxy(req("/measures?status=overdue"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
    expect((await proxy(req("/measures", "better-auth.session_token=x.y"))).headers.get("x-middleware-next")).toBe("1");
    expect(config.matcher).toContain("/measures/:path*");
  });
});
