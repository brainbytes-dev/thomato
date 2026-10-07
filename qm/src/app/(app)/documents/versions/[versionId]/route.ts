import { requireOrgContext } from "@/domain/request-context";
import { serveVersion } from "./serve-version";

export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const served = await serveVersion(requireOrgContext, versionId);
  return new Response(served.body, { status: served.status, headers: served.headers });
}
