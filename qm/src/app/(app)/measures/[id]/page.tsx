import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MeasureDetailView } from "@/components/measures/measure-detail-view";
import { getMeasureDetail } from "@/domain/measure-pdca";
import { listMeasureHistory } from "@/domain/measure-history";
import { ValidationError } from "@/domain/org-context";
import { requireOrgContextOrRedirect } from "@/domain/request-context";
import { can } from "@/domain/rights";

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgContextOrRedirect();
  let detail;
  try {
    detail = await getMeasureDetail(ctx, id, new Date());
  } catch (e) {
    // Fremde, unbekannte und fehlerhafte IDs liefern vom Service dieselbe Meldung: überall derselbe 404.
    if (e instanceof ValidationError) notFound();
    throw e;
  }
  const history = can(ctx.role, "audit", "read") ? await listMeasureHistory(ctx, detail.measure.id) : null;
  return <MeasureDetailView detail={detail} history={history} />;
}

export default function MeasureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="flex flex-col gap-6">
      <Suspense fallback={<p className="text-text-muted">Massnahme wird geladen...</p>}>
        <Detail params={params} />
      </Suspense>
    </main>
  );
}
