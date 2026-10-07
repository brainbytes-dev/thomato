import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organization } from "@/db/schema";
import { requireOrgContextOrRedirect } from "@/domain/request-context";

async function Shell({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContextOrRedirect();
  const [org] = await db.select().from(organization).where(eq(organization.id, ctx.organizationId));
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <strong>{org?.name}</strong>
        <span className="text-text-muted">Rolle: {ctx.role}</span>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
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
