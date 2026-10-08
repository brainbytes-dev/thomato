import Link from "next/link";
import { ArrowLeft, CalendarClock, ClipboardCheck, Lock, UserRound } from "lucide-react";
import { HistoryTimeline, type HistoryItem } from "@/components/criteria/history-timeline";
import { Panel } from "@/components/criteria/panel";
import { MEASURE_STATUS_BADGE, MEASURE_STATUS_LABEL } from "@/components/criteria/status-copy";
import { Badge } from "@/components/ui/badge";
import { SECTION_CARD } from "@/components/ui/styles";
import { formatDate, formatDateTime, formatDaysDative } from "@/domain/dates";
import type { MeasureAction, MeasureDetail } from "@/domain/measure-pdca";
import {
  AddStepForm, CloseForm, CompleteDoForm, CompletePlanForm, CriterionForm, EditableChecklist, NewCycleForm,
  PdcaNoticeScope, RefineForm, ReopenForm, ReviewForm, type StepItem,
} from "./pdca-forms";
import { PHASE_NAME, RESULT_BADGE, RESULT_LABEL } from "./pdca-copy";
import { PdcaStepper } from "./pdca-stepper";

type Props = {
  detail: MeasureDetail;
  /** null ohne Audit-Recht: dann gibt es keine Zeitleiste. */
  history: HistoryItem[] | null;
};

const has = (actions: readonly MeasureAction[], a: MeasureAction) => actions.includes(a);

function Header({ detail }: { detail: MeasureDetail }) {
  const m = detail.measure;
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <Link href="/measures" className="type-label inline-flex h-9 items-center gap-2 self-start text-primary hover:underline">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Zurück zu den Massnahmen
        </Link>
        <nav aria-label="Massnahmenpfad">
          <ol className="type-meta flex min-w-0 flex-wrap items-center gap-x-2 text-text-muted">
            <li><Link href="/measures" className="hover:text-text hover:underline">Massnahmen</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href={`/criteria/${encodeURIComponent(m.criterionNumber)}`} className="type-meta-mono hover:text-text hover:underline">{m.criterionNumber}</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="min-w-0 max-w-[28ch] truncate text-text">{m.title}</li>
          </ol>
        </nav>
      </div>

      <div className={`${SECTION_CARD} gap-3`}>
        <ul aria-label="Eigenschaften" className="flex flex-wrap items-center gap-2">
          <li><Badge tone="primary" title="Zyklus der Massnahme">Zyklus {m.cycle}</Badge></li>
          <li><Badge tone={MEASURE_STATUS_BADGE[m.status]} dot>{MEASURE_STATUS_LABEL[m.status]}</Badge></li>
          {m.overdue && <li><Badge tone="critical" dot>Überfällig</Badge></li>}
        </ul>
        <h1 className="type-headline-section max-w-[70ch] text-balance break-words">{m.title}</h1>
        <dl className="type-meta grid grid-cols-1 gap-x-6 gap-y-2 text-text-muted sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex min-w-0 items-center gap-2">
            <UserRound aria-hidden="true" className="size-4 shrink-0" />
            <dt>Verantwortliche</dt>
            <dd className="type-label min-w-0 break-words text-text">{m.ownerName ?? "unbekannt"}</dd>
          </div>
          <div className="flex items-center gap-2">
            <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
            <dt>Erstellt</dt>
            <dd className="type-label text-text">{formatDate(m.createdAt.toISOString().slice(0, 10))}</dd>
          </div>
          <div className="flex flex-wrap items-center gap-x-2">
            <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
            <dt>Frist</dt>
            <dd className="type-label text-text">{formatDate(m.dueDate)}</dd>
            {m.overdue && <dd className="type-label text-critical">(seit {formatDaysDative(-m.days)} überfällig)</dd>}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <ClipboardCheck aria-hidden="true" className="size-4 shrink-0" />
            <dt>Kriterium</dt>
            <dd className="min-w-0">
              <Link href={`/criteria/${encodeURIComponent(m.criterionNumber)}`} className="type-label text-primary hover:underline">
                <span className="font-mono">{m.criterionNumber}</span>
                <span className="sr-only"> {m.criterionTitle}</span>
              </Link>
            </dd>
          </div>
        </dl>
      </div>
    </header>
  );
}

function ReadOnlyNote({ detail }: { detail: MeasureDetail }) {
  const m = detail.measure;
  if (detail.allowedActions.length > 0) return null;
  const next =
    m.status === "done"
      ? "Die Massnahme ist abgeschlossen."
      : m.phase === "check"
        ? "Als Nächstes folgt die Wirksamkeitsprüfung durch eine berechtigte Person."
        : m.phase === "act"
          ? "Als Nächstes entscheidet eine berechtigte Person über Abschluss, Nachschärfen oder einen neuen Zyklus."
          : "";
  return (
    <p className="type-meta flex items-start gap-2 rounded-lg border border-border bg-surface-subtle px-4 py-3 text-text-muted">
      <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>Mit Ihrer Rolle ist diese Massnahme in der aktuellen Phase schreibgeschützt. {next}</span>
    </p>
  );
}

function ProseBlock({ text, empty }: { text: string | null; empty: string }) {
  return text ? <p className="type-body max-w-[70ch] whitespace-pre-line break-words">{text}</p> : <p className="text-text-muted">{empty}</p>;
}

function Facts({ detail }: { detail: MeasureDetail }) {
  const m = detail.measure;
  return (
    <Panel headingId="facts-heading" title="Fristen und Verantwortliche">
      <dl className="type-meta grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
        <dt className="text-text-muted">Verantwortliche</dt>
        <dd className="type-label min-w-0 break-words">{m.ownerName ?? "unbekannt"}</dd>
        <dt className="text-text-muted">Frist</dt>
        <dd className="type-label">
          <span className="type-meta-mono">{formatDate(m.dueDate)}</span>
          {m.status !== "done" && (
            <span className={`block font-normal ${m.overdue ? "text-critical" : "text-text-muted"}`}>
              {m.overdue ? `seit ${formatDaysDative(-m.days)} überfällig` : m.days === 0 ? "heute fällig" : `in ${formatDaysDative(m.days)}`}
            </span>
          )}
        </dd>
        <dt className="text-text-muted">Erstellt</dt>
        <dd className="type-meta-mono">{formatDateTime(m.createdAt)}</dd>
        {m.status === "done" && m.completedAt && (
          <>
            <dt className="text-text-muted">Abgeschlossen</dt>
            <dd className="type-meta-mono">{formatDateTime(m.completedAt)}</dd>
          </>
        )}
        <dt className="text-text-muted">Zyklus</dt>
        <dd className="type-label">{m.cycle}</dd>
      </dl>
    </Panel>
  );
}

function ReadOnlyChecklist({ detail }: { detail: MeasureDetail }) {
  if (detail.steps.length === 0) {
    return <p className="text-text-muted">Es gibt keine Schritte. Die Checkliste wird in der Phase Do geführt.</p>;
  }
  return (
    <ul aria-label="Checkliste" className="flex flex-col gap-2">
      {detail.steps.map((s) => (
        <li key={s.id} className="flex items-start gap-3 rounded-lg border border-border bg-surface-subtle p-3">
          <input type="checkbox" checked={s.done} disabled readOnly aria-label={`${s.done ? "Erledigt" : "Offen"}: ${s.title}`} className="mt-0.5 size-5 shrink-0 accent-primary" />
          <div className="min-w-0">
            <p className={`type-body break-words ${s.done ? "text-text-muted line-through" : ""}`}>
              <span className="type-meta-mono text-text-muted">{s.position}. </span>
              {s.title}
            </p>
            {s.done && <p className="type-meta text-text-muted">{doneText(s)}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function doneText(s: MeasureDetail["steps"][number]): string {
  const who = s.doneByName ?? "unbekannt";
  return s.doneAt ? `Erledigt von ${who} am ${formatDateTime(s.doneAt)}` : `Erledigt von ${who}`;
}

function Checklist({ detail }: { detail: MeasureDetail }) {
  const done = detail.steps.filter((s) => s.done).length;
  const editable = has(detail.allowedActions, "edit_steps");
  const items: StepItem[] = detail.steps.map((s) => ({
    id: s.id, position: s.position, title: s.title, done: s.done, doneText: s.done ? doneText(s) : null,
  }));
  return (
    <Panel
      headingId="checklist-heading"
      title="Checkliste"
      aside={<span className="type-meta text-text-muted">{detail.steps.length === 0 ? "keine Schritte" : `${done} von ${detail.steps.length} erledigt`}</span>}
    >
      {detail.steps.length > 0 && (
        <div role="progressbar" aria-label="Fortschritt der Checkliste" aria-valuemin={0} aria-valuemax={detail.steps.length} aria-valuenow={done} className="h-2 overflow-hidden rounded-full bg-surface-subtle">
          <div className="h-full bg-primary" style={{ width: `${(done / detail.steps.length) * 100}%` }} />
        </div>
      )}
      {editable ? (
        <>
          {items.length === 0 && <p className="text-text-muted">Noch keine Schritte. Fügen Sie die Schritte hinzu, mit denen die Massnahme umgesetzt wird.</p>}
          <EditableChecklist measureId={detail.measure.id} steps={items} />
          <AddStepForm measureId={detail.measure.id} />
        </>
      ) : (
        <ReadOnlyChecklist detail={detail} />
      )}
    </Panel>
  );
}

function ReviewGroups({ detail }: { detail: MeasureDetail }) {
  const m = detail.measure;
  const byCycle = new Map(detail.reviewsByCycle.map((g) => [g.cycle, g.reviews]));
  // Der aktuelle Zyklus steht immer da, auch ohne Bewertung; frühere Zyklen nur, wenn sie bewertet wurden.
  const cycles = [...new Set([...byCycle.keys(), m.cycle])].sort((a, b) => b - a);
  if (byCycle.size === 0) {
    return (
      <p className="text-text-muted">
        {m.phase === "check" ? "Noch keine Wirksamkeitsprüfung. Sie findet in dieser Phase statt." : "Noch keine Wirksamkeitsprüfung. Sie folgt nach der Phase Do."}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {cycles.map((cycle) => {
        const reviews = byCycle.get(cycle) ?? [];
        return (
          <section key={cycle} aria-labelledby={`cycle-${cycle}`} className="flex flex-col gap-3">
            <h3 id={`cycle-${cycle}`} className="type-eyebrow flex items-center gap-2 text-text-muted">
              Zyklus {cycle}
              {cycle === m.cycle && <Badge tone="primary">aktuell</Badge>}
            </h3>
            {reviews.length === 0 ? (
              <p className="type-meta text-text-muted">In diesem Zyklus gibt es noch keine Bewertung.</p>
            ) : (
              <ol aria-label={`Bewertungen in Zyklus ${cycle}, neueste zuerst`} className="flex flex-col gap-3">
                {[...reviews].reverse().map((r) => (
                  <li key={r.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface-subtle p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge tone={RESULT_BADGE[r.result]} dot>{RESULT_LABEL[r.result]}</Badge>
                      <span className="type-meta text-text-muted">
                        {r.checkedByName ?? "unbekannt"}, <time dateTime={r.checkedAt.toISOString()} className="type-meta-mono">{formatDateTime(r.checkedAt)}</time>
                      </span>
                    </div>
                    <p className="type-body max-w-[70ch] whitespace-pre-line break-words">{r.note}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Review({ detail }: { detail: MeasureDetail }) {
  const m = detail.measure;
  return (
    <Panel headingId="review-heading" title="Wirksamkeitsprüfung">
      <ReviewGroups detail={detail} />
      {has(detail.allowedActions, "record_effectiveness") && <ReviewForm measureId={m.id} criterion={m.effectivenessCriterion} />}
    </Panel>
  );
}

function Option({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4" aria-label={title}>
      <h3 className="type-body-emphasis">{title}</h3>
      <p className="type-meta max-w-[70ch] text-text-muted">{text}</p>
      {children}
    </section>
  );
}

function Decision({ detail }: { detail: MeasureDetail }) {
  const m = detail.measure;
  const last = detail.lastReview;
  const reasonRequired = last !== null && last.result !== "effective";
  return (
    <Panel headingId="decision-heading" title="Entscheidung in Act">
      <p className="type-body max-w-[70ch]">
        {last ? <>Letzte Bewertung: <strong>{RESULT_LABEL[last.result]}</strong>. </> : null}
        Act schliesst nie automatisch, auch nicht bei «wirksam». Sie entscheiden bewusst, wie es weitergeht.
        {reasonRequired ? " Bei «teilweise wirksam» und «nicht wirksam» verlangt der Abschluss eine Begründung." : ""}
      </p>
      <div className="flex flex-col gap-4">
        <Option title="Abschliessen" text="Die Massnahme gilt als erledigt. Sie bleibt mit allen Bewertungen sichtbar und lässt sich später wiedereröffnen.">
          <CloseForm measureId={m.id} reasonRequired={reasonRequired} />
        </Option>
        <Option title="Nachschärfen" text="Zurück in die Phase Do im selben Zyklus. Die bisherige Bewertung bleibt sichtbar, Sie ergänzen weitere Schritte und prüfen danach erneut.">
          <RefineForm measureId={m.id} />
        </Option>
        <Option title="Neuer Zyklus" text={`Zurück in die Phase Plan als Zyklus ${m.cycle + 1}. Alle Bewertungen des bisherigen Zyklus bleiben unverändert erhalten.`}>
          <NewCycleForm measureId={m.id} />
        </Option>
      </div>
    </Panel>
  );
}

function Actions({ detail }: { detail: MeasureDetail }) {
  const m = detail.measure;
  const a = detail.allowedActions;
  const open = detail.steps.filter((s) => !s.done).length;
  const content = has(a, "complete_plan") ? (
    <>
      <p className="type-meta text-text-muted">Legen Sie Sachverhalt und Wirksamkeitskriterium fest. Danach beginnt die Umsetzung in Do.</p>
      <CompletePlanForm measureId={m.id} />
    </>
  ) : has(a, "complete_do") ? (
    <>
      <p className="type-meta text-text-muted">Schliessen Sie Do ab, sobald alle Schritte der Checkliste erledigt sind. Danach folgt die Wirksamkeitsprüfung.</p>
      <CompleteDoForm measureId={m.id} stepCount={detail.steps.length} openCount={open} />
    </>
  ) : has(a, "record_effectiveness") ? (
    <p className="type-meta text-text-muted">Bewerten Sie die Wirksamkeit im Abschnitt «Wirksamkeitsprüfung».</p>
  ) : has(a, "close") ? (
    <p className="type-meta text-text-muted">Entscheiden Sie im Abschnitt «Entscheidung in Act», wie es weitergeht.</p>
  ) : has(a, "reopen") ? (
    <>
      <p className="type-meta text-text-muted">Die Massnahme ist abgeschlossen. Wiedereröffnen setzt sie zurück in die Phase Do, die bisherigen Bewertungen bleiben erhalten.</p>
      <ReopenForm measureId={m.id} />
    </>
  ) : null;
  if (!content) return null;
  return (
    <Panel headingId="actions-heading" title={m.status === "done" ? "Aktionen" : `Aktionen in ${PHASE_NAME[m.phase]}`}>
      {content}
    </Panel>
  );
}

/** Reine Darstellung: Rechte und Übergänge kommen ausschliesslich aus `detail.allowedActions`. */
export function MeasureDetailView({ detail, history }: Props) {
  const m = detail.measure;
  const a = detail.allowedActions;
  return (
    <PdcaNoticeScope>
      <Header detail={detail} />
      <PdcaStepper phase={m.phase} status={m.status} />
      <ReadOnlyNote detail={detail} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-8">
          <Panel headingId="facts-text-heading" title="Sachverhalt">
            <ProseBlock text={m.description} empty="Es wurde keine Beschreibung erfasst." />
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <h3 className="type-eyebrow text-text-muted">Wirksamkeitskriterium</h3>
              {has(a, "set_criterion") ? (
                <CriterionForm measureId={m.id} value={m.effectivenessCriterion ?? ""} />
              ) : (
                <ProseBlock text={m.effectivenessCriterion} empty="Es wurde kein Wirksamkeitskriterium festgehalten." />
              )}
            </div>
          </Panel>
          <Checklist detail={detail} />
          <Review detail={detail} />
          {has(a, "close") && <Decision detail={detail} />}
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:col-span-4">
          <Actions detail={detail} />
          <Facts detail={detail} />
          {history && <HistoryTimeline entries={history} title="Verlauf der Massnahme" label="Änderungsverlauf dieser Massnahme, neueste zuerst" />}
        </div>
      </div>
    </PdcaNoticeScope>
  );
}
