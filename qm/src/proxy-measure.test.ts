import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION, member, session } from "@/db/schema";
import { importCatalog } from "@/domain/catalog";
import { createMeasure } from "@/domain/measures";
import { measureProvablyMissing, sessionTokenFromCookie } from "@/domain/measure-lookup";
import { authId, ctxFor, makeOrg, resetDb } from "@/test/helpers";
import { proxy } from "./proxy";

const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined);

const cookieFor = (token: string) => `better-auth.session_token=${token}.c2lnbmF0dXJl`;

async function sessionFor(userId: string, orgId: string | null, expiresAt = new Date(Date.now() + 3_600_000)) {
  const token = authId();
  await db.insert(session).values({ id: authId(), token, userId, expiresAt, activeOrganizationId: orgId });
  return token;
}

async function setup() {
  await importCatalog(db, {
    standardVersionId: ACTIVE_STANDARD_VERSION,
    label: "t",
    rows: [{ nummer: "7.3.10", titel: "Hygiene", kapitel: "Prozess", anerkennung_muss: true, anerkennung_soll: false, erneuerung_muss: true, erneuerung_soll: false, sortierung: 1 }],
  });
  const a = await makeOrg("px-a");
  const b = await makeOrg("px-b");
  const fields = (ownerUserId: string, title: string) => ({ title, description: null, ownerUserId, dueDate: "2026-12-01", criterionNumber: "7.3.10" });
  const own = await createMeasure(ctxFor(a.org.id, a.user.id, "owner"), fields(a.user.id, "Eigene Massnahme"));
  const foreign = await createMeasure(ctxFor(b.org.id, b.user.id, "owner"), fields(b.user.id, "Geheime Fremdmassnahme"));
  const tokenA = await sessionFor(a.user.id, a.org.id);
  return { a, b, own: own.id, foreign: foreign.id, tokenA };
}

async function bodyOf(res: Response): Promise<string> {
  return res.headers.get("x-middleware-rewrite") ?? (await res.text());
}

describe("proxy measure detail with a session (R55)", () => {
  beforeEach(resetDb);

  it("lets an own measure through", async () => {
    const s = await setup();
    const res = await proxy(req(`/measures/${s.own}`, cookieFor(s.tokenA)));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.status).toBe(200);
  });

  it("answers a foreign and an unknown id with the same 404 rewrite and leaks nothing of the other organization", async () => {
    const s = await setup();
    const foreign = await proxy(req(`/measures/${s.foreign}`, cookieFor(s.tokenA)));
    const unknown = await proxy(req(`/measures/${randomUUID()}`, cookieFor(s.tokenA)));
    for (const res of [foreign, unknown]) {
      expect(res.status).toBe(404);
      expect(res.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/_not-found");
    }
    const headers = (r: Response) => JSON.stringify([...r.headers.entries()].sort());
    expect(headers(foreign)).toBe(headers(unknown));
    const all = (await bodyOf(foreign)) + headers(foreign);
    for (const secret of [s.foreign, s.b.org.id, s.b.org.name, "Geheime Fremdmassnahme"]) expect(all).not.toContain(secret);
  });

  it("is symmetric: the other organization's session finds its measure and 404s on the first one", async () => {
    const s = await setup();
    const tokenB = await sessionFor(s.b.user.id, s.b.org.id);
    expect((await proxy(req(`/measures/${s.foreign}`, cookieFor(tokenB)))).headers.get("x-middleware-next")).toBe("1");
    expect((await proxy(req(`/measures/${s.own}`, cookieFor(tokenB)))).status).toBe(404);
  });

  it("keeps the 404 for malformed ids and the login redirect without a cookie", async () => {
    const s = await setup();
    for (const path of ["/measures/abc", `/measures/${s.own}x`]) {
      expect((await proxy(req(path, cookieFor(s.tokenA)))).status, path).toBe(404);
      expect((await proxy(req(path))).status, path).toBe(404);
    }
    const res = await proxy(req(`/measures/${s.foreign}`));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("passes through when the session cannot be proven: unknown token, expired, no active organization, no membership", async () => {
    const s = await setup();
    const expired = await sessionFor(s.a.user.id, s.a.org.id, new Date(Date.now() - 1000));
    const noOrg = await sessionFor(s.a.user.id, null);
    const crossOrg = await sessionFor(s.a.user.id, s.b.org.id); // a ist nicht Mitglied von b
    for (const token of ["unbekannt", expired, noOrg, crossOrg]) {
      const res = await proxy(req(`/measures/${s.foreign}`, cookieFor(token)));
      expect(res.headers.get("x-middleware-next"), token).toBe("1");
      expect(res.status).toBe(200);
    }
  });

  it("stops proving once the membership is gone", async () => {
    const s = await setup();
    await db.delete(member).where(eq(member.userId, s.a.user.id));
    expect((await proxy(req(`/measures/${randomUUID()}`, cookieFor(s.tokenA)))).headers.get("x-middleware-next")).toBe("1");
  });

  it("measureProvablyMissing only proves absence, and only with a clean token", async () => {
    const s = await setup();
    expect(await measureProvablyMissing(cookieFor(s.tokenA).split("=")[1], s.own)).toBe(false);
    expect(await measureProvablyMissing(`${s.tokenA}.sig`, s.foreign)).toBe(true);
    expect(await measureProvablyMissing(`${s.tokenA}%2Esig`, randomUUID())).toBe(true);
    expect(await measureProvablyMissing("", s.foreign)).toBe(false);
    expect(await measureProvablyMissing(`${s.tokenA}.sig`, "kein-uuid")).toBe(false);
    expect(await measureProvablyMissing(`${s.tokenA}.sig`, s.foreign, new Date(Date.now() + 7_200_000))).toBe(false);
  });

  it("parses the cookie value defensively", () => {
    expect(sessionTokenFromCookie("abc.def")).toBe("abc");
    expect(sessionTokenFromCookie("abc%2Edef.ghi")).toBe("abc");
    expect(sessionTokenFromCookie("abc")).toBe("abc");
    expect(sessionTokenFromCookie(".sig")).toBeNull();
    expect(sessionTokenFromCookie("%E0%A4%A")).toBeNull();
    expect(sessionTokenFromCookie("x".repeat(300))).toBeNull();
    expect(sessionTokenFromCookie("ab-c.sig")).toBeNull();
    expect(sessionTokenFromCookie("ab%00c.sig")).toBeNull();
    expect(sessionTokenFromCookie("a b.sig")).toBeNull();
  });
});
