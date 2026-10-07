import type { ChapterProgress } from "@/domain/dashboard";

export function ChapterProgressTable({ chapters }: { chapters: ChapterProgress[] }) {
  return (
    <section aria-labelledby="progress-heading" className="flex flex-col gap-3">
      <h2 id="progress-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        Fortschritt nach Kapitel
      </h2>
      <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Erfüllte Kriterien je Kapitel</caption>
          <thead className="bg-surface-subtle text-text-muted">
            <tr>
              <th scope="col" className="px-3 py-2">Kapitel</th>
              <th scope="col" className="whitespace-nowrap px-3 py-2">Erfüllt</th>
              <th scope="col" className="w-1/2 px-3 py-2">Anteil</th>
            </tr>
          </thead>
          <tbody>
            {chapters.map((c) => (
              <tr key={c.chapter} className="border-t border-border">
                <th scope="row" className="px-3 py-2 text-left font-normal">{c.chapter}</th>
                <td className="whitespace-nowrap px-3 py-2">{c.met} / {c.applicable}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div aria-hidden="true" className="h-1.5 flex-1 rounded-[2px] bg-surface-subtle">
                      <div className="h-full rounded-[2px] bg-primary" style={{ width: `${c.percent ?? 0}%` }} />
                    </div>
                    <span className="w-12 text-right">{c.percent === null ? "k. A." : `${c.percent} %`}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
