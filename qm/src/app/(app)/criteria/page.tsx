import { listAssessments } from "@/domain/assessments";
import { requireOrgContext } from "@/domain/request-context";
import type { AssessmentStatus } from "@/db/schema";

const LABEL: Record<AssessmentStatus, string> = {
  not_assessed: "Nicht bewertet",
  met: "Erfüllt",
  open: "Offen",
  critical: "Kritisch",
  not_applicable: "Entfällt",
};

const TONE: Record<AssessmentStatus, string> = {
  not_assessed: "text-text-muted",
  met: "text-success",
  open: "text-warning",
  critical: "text-critical",
  not_applicable: "text-text-muted",
};

export default async function CriteriaPage() {
  const ctx = await requireOrgContext();
  const rows = await listAssessments(ctx);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Kriterien</h1>
      <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Kriterien mit Bewertungsstand</caption>
          <thead className="bg-surface-subtle text-text-muted">
            <tr>
              <th scope="col" className="px-3 py-2">Nr.</th>
              <th scope="col" className="px-3 py-2">Titel</th>
              <th scope="col" className="px-3 py-2">Kapitel</th>
              <th scope="col" className="px-3 py-2">Pflicht</th>
              <th scope="col" className="px-3 py-2">Stand</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.criterionId} className="border-t border-border">
                <td className="px-3 py-2 font-mono">{r.number}</td>
                <td className="px-3 py-2">{r.title}</td>
                <td className="px-3 py-2">{r.chapter}</td>
                <td className="px-3 py-2">{r.mandatory ? "Muss" : "Soll"}</td>
                <td className={`px-3 py-2 font-medium ${TONE[r.status]}`}>{LABEL[r.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
