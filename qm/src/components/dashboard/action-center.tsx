"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Badge, CARD, type BadgeTone } from "@/components/ui/badge";
import {
  ACTION_FILTER_LABEL,
  ACTION_FILTERS,
  countByActionFilter,
  matchesActionFilter,
  type ActionFilter,
} from "@/domain/action-filter";
import type { ActionItem, ActionPriority } from "@/domain/dashboard";
import { formatDate } from "@/domain/dates";

const PRIORITY_LABEL: Record<ActionPriority, string> = { critical: "Kritisch", high: "Hoch", medium: "Mittel" };
const PRIORITY_TONE: Record<ActionPriority, BadgeTone> = { critical: "critical", high: "warning", medium: "neutral" };

const TH = "type-eyebrow px-4 py-3 text-left text-text-muted whitespace-nowrap";

function SegmentedFilter({ value, counts, onChange }: { value: ActionFilter; counts: Record<ActionFilter, number>; onChange: (f: ActionFilter) => void }) {
  return (
    <div role="group" aria-label="Punkte filtern" className="inline-flex flex-wrap gap-0.5 rounded-lg border border-border bg-surface-subtle p-0.5">
      {ACTION_FILTERS.map((f) => {
        const pressed = f === value;
        return (
          <button
            key={f}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(f)}
            className={`type-label inline-flex h-8 items-center gap-2 rounded-md border px-3 ${
              pressed ? "border-border bg-surface text-text" : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {ACTION_FILTER_LABEL[f]}
            <span className="type-meta-mono">{counts[f]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ActionCenter({ items, total }: { items: ActionItem[]; total: number }) {
  const [filter, setFilter] = useState<ActionFilter>("all");
  const counts = countByActionFilter(items);
  const visible = items.filter((i) => matchesActionFilter(i, filter));
  return (
    <section aria-labelledby="actions-heading" className={`${CARD} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="actions-heading" className="type-headline-sub">Braucht Aufmerksamkeit</h2>
          <p className="type-meta mt-1 text-text-muted">Dringliche Massnahmen und Nachweise vor Ablauf der Frist</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {items.length > 0 && <SegmentedFilter value={filter} counts={counts} onChange={setFilter} />}
          <Link href="/criteria" className="type-label inline-flex h-9 items-center gap-2 text-primary hover:underline">
            Alle Kriterien anzeigen
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-text-muted">Aktuell gibt es nichts, das Aufmerksamkeit braucht.</p>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="actions-heading"
          className="relative mt-6 overflow-x-auto rounded-lg border border-border"
        >
          <table className="w-full min-w-[960px] border-collapse text-left">
            <caption className="sr-only">
              Offene Punkte nach Priorität, Filter: {ACTION_FILTER_LABEL[filter]}
            </caption>
            <thead className="bg-surface-subtle">
              <tr>
                <th scope="col" className={TH}>Priorität</th>
                <th scope="col" className={TH}>Thema und Referenz</th>
                <th scope="col" className={TH}>Zuständig</th>
                <th scope="col" className={TH}>Fällig</th>
                <th scope="col" className={TH}>Status</th>
                <th scope="col" className={`${TH} text-right`}>Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-text-muted">
                    Keine Punkte in dieser Kategorie.
                  </td>
                </tr>
              ) : (
                visible.map((i) => {
                  const overdue = i.dueInDays !== null && i.dueInDays < 0;
                  return (
                    <tr key={i.key} className="align-top hover:bg-surface-subtle">
                      <td className="whitespace-nowrap px-4 py-4">
                        <Badge tone={PRIORITY_TONE[i.priority]} dot upper>{PRIORITY_LABEL[i.priority]}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <p className="type-label">{i.title}</p>
                        {i.reference && <p className="type-meta mt-0.5 text-text-muted">{i.reference}</p>}
                      </td>
                      <td className="type-meta px-4 py-4 text-text-muted">{i.ownerName ?? "-"}</td>
                      <td className={`type-meta-mono whitespace-nowrap px-4 py-4 ${overdue ? "font-semibold text-critical" : ""}`}>
                        {i.dueDate ? formatDate(i.dueDate) : "ohne Frist"}
                      </td>
                      <td className="px-4 py-4">
                        <Badge tone={overdue || i.priority === "critical" ? "critical" : "neutral"}>{i.statusLabel}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right">
                        {i.href ? (
                          <Link
                            href={i.href}
                            className="type-label inline-flex h-9 items-center rounded border border-border bg-surface px-3 hover:bg-surface-subtle"
                          >
                            Öffnen
                            <span className="sr-only">: {i.title}</span>
                          </Link>
                        ) : (
                          <span className="type-meta text-text-muted">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      {total > items.length && (
        <p className="type-meta mt-4 text-text-muted">
          {items.length} von {total} Punkten.{" "}
          <Link href="/criteria" className="text-primary underline">Weitere Punkte: Kriterien und Fristen</Link>
        </p>
      )}
    </section>
  );
}
