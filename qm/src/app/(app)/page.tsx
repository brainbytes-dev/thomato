import { Suspense } from "react";
import { ActionCenter } from "@/components/dashboard/action-center";
import { ChapterProgressTable } from "@/components/dashboard/chapter-progress";
import { DeadlineList } from "@/components/dashboard/deadline-list";
import { ReadinessHero } from "@/components/dashboard/readiness-hero";
import { ACTION_CENTER_LIMIT, getDashboard } from "@/domain/dashboard";
import { requireOrgContextOrRedirect } from "@/domain/request-context";

async function Dashboard() {
  const ctx = await requireOrgContextOrRedirect();
  const data = await getDashboard(ctx);
  return (
    <>
      <ReadinessHero data={data} />
      <ActionCenter items={data.actions.slice(0, ACTION_CENTER_LIMIT)} total={data.actions.length} />
      <DeadlineList deadlines={data.deadlines} />
      <ChapterProgressTable chapters={data.chapters} />
    </>
  );
}

export default function DashboardPage() {
  return (
    <main className="flex flex-col gap-8">
      <h1 className="sr-only">Übersicht</h1>
      <Suspense fallback={<p className="text-text-muted">Übersicht wird geladen...</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}
