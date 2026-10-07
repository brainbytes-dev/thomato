import { getVersionDownload } from "@/domain/documents";
import { ForbiddenError, UnauthorizedError, type OrgContext } from "@/domain/org-context";

export type ServedVersion = {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array<ArrayBuffer> | null;
};

const EMPTY = (status: number): ServedVersion => ({ status, headers: { "Cache-Control": "private, no-store" }, body: null });

/** ASCII-Rückfall: alles ausser druckbarem ASCII (ohne Anführungszeichen, Backslash, Prozent) wird zu "_". */
function asciiFallback(name: string): string {
  return name.replace(/[^\x20-\x7e]|["\\%]/g, "_");
}

function encodeRfc5987(name: string): string {
  return encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** Entscheidungslogik des Downloads. `resolve` liefert den Kontext oder wirft Unauthorized/Forbidden. */
export async function serveVersion(resolve: () => Promise<OrgContext>, versionId: string): Promise<ServedVersion> {
  let ctx: OrgContext;
  try {
    ctx = await resolve();
  } catch (e) {
    if (e instanceof UnauthorizedError) return EMPTY(401);
    if (e instanceof ForbiddenError) return EMPTY(403);
    throw e;
  }
  let found: Awaited<ReturnType<typeof getVersionDownload>>;
  try {
    found = await getVersionDownload(ctx, versionId);
  } catch (e) {
    if (e instanceof ForbiddenError) return EMPTY(403);
    throw e;
  }
  if (!found) return EMPTY(404);
  // Kopie bewusst: Buffer.buffer ist ArrayBufferLike, Response verlangt ArrayBuffer-basierte Bytes (ohne Cast keine View).
  const body = new Uint8Array(found.content);
  return {
    status: 200,
    headers: {
      "Content-Type": found.mimeType,
      "Content-Length": String(body.length),
      "Content-Disposition": `attachment; filename="${asciiFallback(found.fileName)}"; filename*=UTF-8''${encodeRfc5987(found.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "Cache-Control": "private, no-store",
    },
    body,
  };
}
