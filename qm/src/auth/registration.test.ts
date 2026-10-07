import { beforeEach, describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organization, session, user } from "@/db/schema";
import { auth } from "./auth";
import { seedAuth } from "./seed-auth";
import { resetDb } from "@/test/helpers";

const PASSWORD = "Correct-Horse-1";
const ORIGIN = "http://localhost:3000";

function jsonPost(pathname: string, body: unknown, cookie?: string) {
  return new Request(`${ORIGIN}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

describe("Registrierung ist zur Laufzeit abgeschaltet", () => {
  beforeEach(resetDb);

  it("lehnt Sign-up über den echten Handler mit 4xx ab und legt keinen User an", async () => {
    const res = await auth.handler(
      jsonPost("/api/auth/sign-up/email", { email: "x@example.test", password: PASSWORD, name: "X" }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(await db.select().from(user).where(eq(user.email, "x@example.test"))).toEqual([]);
  });

  it("lehnt auch den serverseitigen Aufruf auth.api.signUpEmail ab", async () => {
    await expect(
      auth.api.signUpEmail({ body: { email: "y@example.test", password: PASSWORD, name: "Y" } }),
    ).rejects.toThrow();
    expect(await db.select().from(user)).toEqual([]);
  });

  it("lässt einen per seedAuth angelegten User über die Laufzeit-Instanz anmelden", async () => {
    const { user: created } = await seedAuth.api.signUpEmail({
      body: { email: "seed@example.test", password: PASSWORD, name: "Seed" },
    });
    await db.delete(session).where(eq(session.userId, created.id));
    const res = await auth.api.signInEmail({ body: { email: "seed@example.test", password: PASSWORD } });
    expect(res.user.id).toBe(created.id);
    expect(await db.select().from(session).where(eq(session.userId, created.id))).toHaveLength(1);
  });

  it("verweigert angemeldeten Nutzern das Anlegen einer Organisation über den Handler", async () => {
    await seedAuth.api.signUpEmail({ body: { email: "org@example.test", password: PASSWORD, name: "Org" } });
    const signIn = await auth.handler(
      jsonPost("/api/auth/sign-in/email", { email: "org@example.test", password: PASSWORD }),
    );
    expect(signIn.status).toBe(200);
    const cookie = signIn.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    expect(cookie).toContain("session_token");

    const res = await auth.handler(
      jsonPost("/api/auth/organization/create", { name: "Wilde Org", slug: "wilde-org" }, cookie),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(await db.select().from(organization)).toEqual([]);
  });
});

describe("seed-auth Import-Guard", () => {
  const srcRoot = path.resolve(import.meta.dirname, "..");
  const projectRoot = path.resolve(srcRoot, "..");

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (name === "node_modules" || name === ".next") return [];
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  }

  function allowed(rel: string): boolean {
    return (
      rel === "src/auth/seed-auth.ts" ||
      rel.startsWith("src/seed/") ||
      rel.startsWith("src/test/") ||
      rel.startsWith("scripts/") ||
      /\.test\.tsx?$/.test(rel)
    );
  }

  it("wird nur von Seed, Tests und Skripten importiert", () => {
    const importRe = /(?:from\s+|import\s*\(\s*|import\s+|require\s*\(\s*)["'][^"']*seed-auth["']/;
    const files = [...walk(srcRoot), ...walk(path.join(projectRoot, "scripts"))].filter((f) => /\.(ts|tsx|js|mjs)$/.test(f));
    const offenders = files
      .map((f) => path.relative(projectRoot, f))
      .filter((rel) => !allowed(rel))
      .filter((rel) => importRe.test(readFileSync(path.join(projectRoot, rel), "utf8")));
    expect(offenders).toEqual([]);
  });
});
