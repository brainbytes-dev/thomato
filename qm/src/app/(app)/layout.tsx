import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/db";
import { organization, user } from "@/db/schema";
import { requireOrgContextOrRedirect } from "@/domain/request-context";
import { ROLE_LABEL } from "@/domain/role-labels";

async function Shell({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContextOrRedirect();
  const [[org], [me]] = await Promise.all([
    db.select().from(organization).where(eq(organization.id, ctx.organizationId)),
    db.select({ name: user.name }).from(user).where(eq(user.id, ctx.userId)),
  ]);
  return (
    <AppShell organizationName={org?.name ?? ""} roleLabel={ROLE_LABEL[ctx.role]} userName={me?.name ?? ""}>
      {children}
    </AppShell>
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
