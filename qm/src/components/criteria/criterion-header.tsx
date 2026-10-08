import Link from "next/link";
import { ArrowLeft, CalendarClock, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AssessmentStatus } from "@/db/schema";
import { STATUS_BADGE, STATUS_LABEL } from "./status-copy";

export type CriterionHeaderProps = {
  number: string;
  title: string;
  chapter: string;
  status: AssessmentStatus;
  scope: string;
  dueDateText: string;
  updatedAtText: string;
};

export function CriterionHeader(p: CriterionHeaderProps) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <Link
          href="/criteria"
          className="type-label inline-flex h-9 items-center gap-2 self-start text-primary hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Zurück zu den Kriterien
        </Link>
        <nav aria-label="Kriterienpfad">
          <ol className="type-meta flex min-w-0 flex-wrap items-center gap-x-2 text-text-muted">
            <li><Link href="/criteria" className="hover:text-text hover:underline">Kriterien</Link></li>
            <li aria-hidden="true">/</li>
            <li>{p.chapter}</li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="type-meta-mono text-text">{p.number}</li>
          </ol>
        </nav>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <ul aria-label="Eigenschaften" className="flex flex-wrap items-center gap-2">
            <li><Badge tone={STATUS_BADGE[p.status]} dot>{STATUS_LABEL[p.status]}</Badge></li>
            <li><Badge tone="neutral" title="Pflicht im Verfahren">{p.scope}</Badge></li>
            <li><Badge tone="neutral" title="Kapitel">{p.chapter}</Badge></li>
            <li className="type-meta-mono text-text-muted">{p.number}</li>
          </ul>
          <h1 className="type-headline-section max-w-[70ch] text-balance">
            <span className="font-mono">{p.number}</span> {p.title}
          </h1>
        </div>

        <dl className="type-meta flex shrink-0 flex-wrap gap-x-6 gap-y-2 rounded-lg border border-border bg-surface px-4 py-3">
          <div className="flex items-center gap-2">
            <CalendarClock aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
            <dt className="text-text-muted">Frist</dt>
            <dd className="type-label">{p.dueDateText}</dd>
          </div>
          <div className="flex items-center gap-2">
            <History aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
            <dt className="text-text-muted">Zuletzt geändert</dt>
            <dd className="type-label">{p.updatedAtText}</dd>
          </div>
        </dl>
      </div>
    </header>
  );
}
