import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION } from "@/db/schema";
import { importCatalog } from "@/domain/catalog";
import { createDocument } from "@/domain/documents";
import { ForbiddenError, UnauthorizedError } from "@/domain/org-context";
import { addMemberTo, ctxFor, makeOrg, resetDb } from "@/test/helpers";
import { serveVersion } from "./serve-version";

const bytes = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from([0, 255, 128, 10, 13]), Buffer.from("ende")]);

async function setup() {
  await importCatalog(db, {
    standardVersionId: ACTIVE_STANDARD_VERSION,
    label: "t",
    rows: [
      { nummer: "7.3.10", titel: "K", kapitel: "Prozess", anerkennung_muss: true, anerkennung_soll: false,
        erneuerung_muss: true, erneuerung_soll: false, sortierung: 1 },
    ],
  });
  const a = await makeOrg("srv-a");
  const b = await makeOrg("srv-b");
  const viewer = await addMemberTo(a.org.id, "viewer-a", "viewer");
  const ctxA = ctxFor(a.org.id, a.user.id, "owner");
  const ctxB = ctxFor(b.org.id, b.user.id, "owner");
  const docA = await createDocument(ctxA, {
    title: "Konzept", file: { name: "Qualitätskonzept Müller.pdf", bytes }, validUntil: null, criterionNumbers: ["7.3.10"],
  });
  const docB = await createDocument(ctxB, {
    title: "Fremd", file: { name: "fremd.pdf", bytes: Buffer.from("%PDF-1.4\nB") }, validUntil: null, criterionNumbers: [],
  });
  return { ctxA, ctxB, viewerCtx: ctxFor(a.org.id, viewer.id, "viewer"), docA, docB };
}

const asCtx = (c: Awaited<ReturnType<typeof setup>>["ctxA"]) => async () => c;

describe("serveVersion", () => {
  beforeEach(resetDb);

  it("returns 401 without a session", async () => {
    const { docA } = await setup();
    const r = await serveVersion(async () => { throw new UnauthorizedError(); }, docA.versionId);
    expect(r.status).toBe(401);
    expect(r.body).toBeNull();
  });

  it("returns 403 without an active membership", async () => {
    const { docA } = await setup();
    const r = await serveVersion(async () => { throw new ForbiddenError("x"); }, docA.versionId);
    expect(r.status).toBe(403);
  });

  it("serves exact bytes with security headers to the owner", async () => {
    const { ctxA, docA } = await setup();
    const r = await serveVersion(asCtx(ctxA), docA.versionId);
    expect(r.status).toBe(200);
    expect(Buffer.from(r.body ?? new Uint8Array()).equals(bytes)).toBe(true);
    expect(r.headers["Content-Type"]).toBe("application/pdf");
    expect(r.headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(r.headers["Content-Security-Policy"]).toBe("sandbox");
    expect(r.headers["Cache-Control"]).toBe("private, no-store");
    expect(r.headers["Content-Length"]).toBe(String(bytes.length));
    const cd = r.headers["Content-Disposition"];
    expect(cd.startsWith("attachment;")).toBe(true);
    expect(cd).toContain('filename="Qualit');
    expect(cd).not.toMatch(/filename="[^"]*[^\x20-\x7e][^"]*"/);
    expect(cd).toContain(`filename*=UTF-8''${encodeURIComponent("Qualitätskonzept Müller.pdf")}`);
  });

  it("serves the viewer of the same organisation", async () => {
    const { viewerCtx, docA } = await setup();
    const r = await serveVersion(asCtx(viewerCtx), docA.versionId);
    expect(r.status).toBe(200);
  });

  it("returns 404 for a foreign, unknown or malformed version id", async () => {
    const { ctxA, docB } = await setup();
    expect((await serveVersion(asCtx(ctxA), docB.versionId)).status).toBe(404);
    expect((await serveVersion(asCtx(ctxA), "3f2b8c1e-5a4d-4e6f-8a7b-9c0d1e2f3a4b")).status).toBe(404);
    expect((await serveVersion(asCtx(ctxA), "not-a-uuid")).status).toBe(404);
  });
});
