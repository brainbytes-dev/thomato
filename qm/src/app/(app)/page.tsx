import { Suspense } from "react";
import { ActionCenter } from "@/components/dashboard/action-center";
import { ChapterProgressTable } from "@/components/dashboard/chapter-progress";
import { DeadlineList } from "@/components/dashboard/deadline-list";
import { ReadinessHero } from "@/components/dashboard/readiness-hero";
import { ACTION_CENTER_LIMIT, getDashboard, selectActionItems } from "@/domain/dashboard";
import { formatDate, zurichDate } from "@/domain/dates";
import { requireOrgContextOrRedirect } from "@/domain/request-context";

async function Dashboard() {
  const ctx = await requireOrgContextOrRedirect();
  const now = new Date();
  const data = await getDashboard(ctx, now);
  return (
    <>
      <ReadinessHero data={data} asOf={formatDate(zurichDate(now))} />
      <ActionCenter items={selectActionItems(data.actions, ACTION_CENTER_LIMIT)} total={data.actions.length} />
      <DeadlineList deadlines={data.deadlines} />
      <ChapterProgressTable chapters={data.chapters} />
    </>
  );
}

export default function DashboardPage() {
  return (
    <main className="flex flex-col gap-6">
      <h1 className="sr-only">Übersicht</h1>
      <Suspense fallback={<p className="text-text-muted">Übersicht wird geladen...</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}
