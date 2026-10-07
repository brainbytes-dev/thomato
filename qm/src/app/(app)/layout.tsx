import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { AppNav } from "@/components/app-nav";
import { BRAND } from "@/brand";
import { db } from "@/db";
import { organization } from "@/db/schema";
import { requireOrgContextOrRedirect } from "@/domain/request-context";
import { ROLE_LABEL } from "@/domain/role-labels";

async function Shell({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContextOrRedirect();
  const [org] = await db.select().from(organization).where(eq(organization.id, ctx.organizationId));
  return (
    <div className="min-h-screen md:grid md:grid-cols-[14rem_1fr]">
      <aside className="flex flex-col gap-6 border-b border-border bg-sidebar px-4 py-4 md:border-b-0 md:border-r">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted">{BRAND.name}</p>
          <p className="font-semibold">{org?.name}</p>
          <p className="text-text-muted">{ROLE_LABEL[ctx.role]}</p>
        </div>
        <AppNav />
      </aside>
      <div className="px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-8">{children}</div>
      </div>
    </div>
  );
}

// Cache Components: Sitzungsdaten sind Laufzeitdaten und müssen hinter einer Suspense-Grenze liegen.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-6 text-text-muted">Wird geladen...</p>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
