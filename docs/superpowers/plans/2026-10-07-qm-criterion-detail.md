# QM Kriterium-Detail und n/a-Regel Implementation Plan (Plan 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Kriterium lässt sich öffnen, bewerten und mit Frist versehen, jede Änderung ist auditiert und wirkt sofort auf das Dashboard. «Nicht anwendbar» ist nur mit Begründung zulässig, nachvollziehbar im Audit-Verlauf, im Dashboard ausgewiesen und in der Kriterienliste filterbar. Mit null anwendbaren Pflichtkriterien lautet die Readiness nie «Bereit».

**Architecture:** Wie Plan 1 und 2: reine Fachfunktionen (Readiness, Texte), mandantengebundene Services mit `withAudit`, Server Components hinter Suspense. Neu: eine Server Action, die die Services aufruft und die betroffenen Seiten revalidiert. Das Dashboard liest bei jedem Request neu, dadurch wirkt jede Änderung ohne eigenen «Recompute»-Schritt.

**Tech Stack:** Wie Plan 2 (Next.js 16 Cache Components, Drizzle, Better Auth, Vitest gegen echtes Postgres, Zod, pnpm).

**Spec:** `docs/implementation/BUILD_PLAN_TO_2026-11-17.md`, Plan 2 (Readiness-Regel R12 bis R19) und die Entscheidungen von Henrik vom 2026-10-07 (siehe Global Constraints). Nachweise und Dokumente folgen bewusst in Plan 4 (eigener Plan, weil Speicherung und Versionierung ein eigenes Teilsystem sind).

## Global Constraints

- Alle Constraints aus Plan 1 und 2 gelten weiter (pnpm, kein `any`, kein `db:push`, `organization_id NOT NULL`, Rechte nur aus `src/domain/rights.ts`, kein Produktnamen-Literal ausser `src/brand.ts`, Tokens statt Hex, keine Em-Dashes auch nicht in UI-Texten, Conventional Commits, kein `git push` ohne Freigabe).
- **Henrik 2026-10-07, verbindlich:**
  - «Nicht anwendbar» ist auch bei Pflichtkriterien zulässig, aber nur mit verpflichtender Begründung (Plan: mindestens 10, höchstens 500 Zeichen nach Trim).
  - Jede Änderung auf oder weg von «nicht anwendbar» erzeugt ein Audit-Event mit Actor, Zeitpunkt und Begründung (Eventtyp `criterion.not_applicable_changed`).
  - «Nicht anwendbar» wird aus dem Dokumentationsfortschritt herausgerechnet (bereits so) und erzeugt nicht automatisch einen kritischen Zustand. Es kommt keine Zahl nicht anwendbarer Pflichtkriterien in die Readiness-Formel.
  - Gibt es null anwendbare Pflichtkriterien (`mandatory.total === 0`), lautet das Ergebnis nie «Bereit», sondern «Nicht bewertet» mit eigenem Hinweistext.
  - Das Dashboard weist die Zahl aus: «N Pflichtkriterien als nicht anwendbar markiert»; die Kriterienliste macht den Zustand sichtbar und filterbar.
  - Eine abgelaufene Anerkennung bleibt ein separater kritischer Hinweis und verändert die Readiness-Regel nicht (R18 bestätigt). Audit-Log lesen nur `owner` und `qm_admin` (R11 bestätigt).
- Produktname bleibt der Arbeitstitel aus `src/brand.ts`.
- Begründung und Frist werden serverseitig validiert (Zod und Service). Der Client darf nichts erzwingen, was der Server nicht prüft.
- Zeitstempel im UI in `Europe/Zurich`, Format `TT.MM.JJJJ, HH:MM`.

## Review Focus

1. `not_applicable` ohne oder mit zu kurzer Begründung wird abgelehnt: keine Zeile, kein Audit-Event (Task 2).
2. Wechsel weg von `not_applicable` löscht die Begründung in der Zeile, das Audit-Event behält sie als `before` (Task 2).
3. Alle Pflichtkriterien `not_applicable` plus erfüllte Soll-Kriterien ergibt nie «Bereit» (Task 1).
4. Organisation B sieht und ändert nie die Bewertung, Frist, Begründung oder Historie von Organisation A, auch nicht mit einer fremden `assessmentId` (Task 2).
5. Ein `viewer` sieht die Detailseite schreibgeschützt und keine Historie; ein `editor` kann bewerten, sieht aber die Historie nicht (Task 2 und 4).

## File Structure

```
qm/
  drizzle/0004_*.sql                                 Migration: not_applicable_reason
  src/db/schema/domain.ts                            + criterionAssessment.notApplicableReason
  src/domain/org-context.ts                          + ValidationError
  src/domain/readiness.ts                            mandatory.notApplicable, mandatory.total === 0 nie ready
  src/domain/readiness-copy.ts                       naMandatoryNotice
  src/domain/assessments.ts                          setAssessmentStatus mit Begründung, setAssessmentDueDate,
                                                     getAssessmentByNumber, listCriterionHistory
  src/domain/audit-copy.ts                           describeAuditEvent (rein)
  src/domain/dates.ts                                + formatDateTime
  src/domain/criteria-filter.ts                      parseStatusFilter, countByStatus
  src/components/criteria/status-copy.ts             STATUS_LABEL, STATUS_TONE, scopeLabel (aus der Kriterienseite)
  src/components/dashboard/readiness-hero.tsx        + Hinweis nicht anwendbarer Pflichtkriterien
  src/app/(app)/criteria/page.tsx                    Filter, Links, Begründung
  src/app/(app)/criteria/[number]/page.tsx           Detailseite
  src/app/(app)/criteria/[number]/actions.ts         Server Action
  src/app/(app)/criteria/[number]/assessment-form.tsx  Formular (Client)
  src/seed/demo.ts                                   Begründungen, zweites n/a-Pflichtkriterium
```

---

### Task 1: Readiness-Regel für nicht anwendbare Pflichtkriterien (rein)

**Files:**
- Modify: `qm/src/domain/readiness.ts`, `qm/src/domain/readiness.test.ts`
- Create: `qm/src/domain/readiness-copy.ts`, `qm/src/domain/readiness-copy.test.ts`

**Interfaces:**
- Produces: `ReadinessResult.mandatory` bekommt `notApplicable: number` (Pflichtkriterien im Geltungsbereich mit Status `not_applicable`); `computeReadiness` liefert bei `mandatory.total === 0` nie `ready`; `naMandatoryNotice(n: number): string | null`.

- [ ] **Step 1: Failing tests**

An `qm/src/domain/readiness.test.ts` ergänzen (nichts bestehendes ändern; die Hilfsfunktionen `crit` und `should` existieren dort):

```ts
describe("not applicable mandatory criteria (Henrik 2026-10-07)", () => {
  it("never yields ready when there is no applicable mandatory criterion", () => {
    const allNa = computeReadiness([crit("not_applicable"), crit("not_applicable"), should("met")], "accreditation", false);
    expect(allNa.status).toBe("not_assessed");
    expect(allNa.mandatory.total).toBe(0);
    expect(allNa.mandatory.notApplicable).toBe(2);
    const onlyShould = computeReadiness([should("met"), should("met")], "accreditation", false);
    expect(onlyShould.status).toBe("not_assessed");
  });

  it("counts not applicable mandatory criteria without changing the status of the rest", () => {
    const r = computeReadiness([crit("met"), crit("not_applicable"), crit("not_applicable")], "accreditation", false);
    expect(r.status).toBe("ready");
    expect(r.mandatory.notApplicable).toBe(2);
    expect(r.mandatory.total).toBe(1);
  });

  it("excludes not applicable criteria from the progress", () => {
    const r = computeReadiness([crit("met"), crit("not_applicable"), crit("open")], "accreditation", false);
    expect(r.progressPercent).toBe(50);
  });

  it("does not count not applicable should criteria as mandatory", () => {
    const r = computeReadiness([crit("met"), should("not_applicable")], "accreditation", false);
    expect(r.mandatory.notApplicable).toBe(0);
    expect(r.notApplicable).toBe(1);
  });

  it("explains the special case in the summary", () => {
    const r = computeReadiness([crit("not_applicable"), should("met")], "accreditation", false);
    expect(readinessSummary(r)).toBe("Keine anwendbaren Pflichtkriterien im Geltungsbereich.");
  });
});
```

Create `qm/src/domain/readiness-copy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { naMandatoryNotice } from "./readiness-copy";

describe("naMandatoryNotice", () => {
  it("is null for zero and uses singular and plural", () => {
    expect(naMandatoryNotice(0)).toBeNull();
    expect(naMandatoryNotice(1)).toBe("1 Pflichtkriterium als nicht anwendbar markiert");
    expect(naMandatoryNotice(3)).toBe("3 Pflichtkriterien als nicht anwendbar markiert");
  });
});
```

Run: `pnpm test src/domain/readiness.test.ts src/domain/readiness-copy.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implementation**

In `qm/src/domain/readiness.ts`:

- Typ: `mandatory: { total: number; met: number; critical: number; open: number; notAssessed: number; notApplicable: number }`.
- In `computeReadiness` die Initialisierung `const mandatory = { total: 0, met: 0, critical: 0, open: 0, notAssessed: 0, notApplicable: 0 };` und im Zweig `if (c.status === "not_applicable")` vor dem `continue`: `if (scope.mandatory) mandatory.notApplicable += 1;`.
- Status: `if (applicable === 0 || notAssessed === applicable || mandatory.total === 0) status = "not_assessed";` (alle anderen Zweige unverändert).
- In `readinessSummary` den Zweig `not_assessed` ersetzen durch:

```ts
  if (r.status === "not_assessed") {
    if (r.applicable === 0) return "Keine anwendbaren Kriterien im Geltungsbereich.";
    if (r.mandatory.total === 0) return "Keine anwendbaren Pflichtkriterien im Geltungsbereich.";
    return "Noch kein Kriterium bewertet.";
  }
```

Create `qm/src/domain/readiness-copy.ts`:

```ts
/** Hinweis im Dashboard, wenn Pflichtkriterien als nicht anwendbar markiert sind. */
export function naMandatoryNotice(n: number): string | null {
  if (n <= 0) return null;
  return n === 1
    ? "1 Pflichtkriterium als nicht anwendbar markiert"
    : `${n} Pflichtkriterien als nicht anwendbar markiert`;
}
```

- [ ] **Step 3: Tests, Typecheck, Commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: alles grün. Falls ein bestehender Test, der nur Soll-Kriterien oder gar keine Pflichtkriterien enthält, jetzt `ready` erwartet hat, ist das ein Fund: melden, nicht anpassen.

```bash
git add qm/ && git commit -m "feat(qm): never report ready without applicable mandatory criteria and count not applicable ones"
```

---

### Task 2: Begründungspflicht, Frist und Detail-Services mit Audit

**Files:**
- Modify: `qm/src/db/schema/domain.ts`, `qm/src/domain/org-context.ts`, `qm/src/domain/assessments.ts`, `qm/src/domain/dates.ts`, `qm/src/seed/demo.ts` (nur Begründung für 7.9), `qm/src/domain/dashboard.test.ts` (nur der Hilfsbau `row()` bekommt das neue Feld)
- Create: `qm/drizzle/0004_*.sql` (generiert), `qm/src/domain/audit-copy.ts`
- Test: `qm/src/domain/assessment-na.test.ts`, `qm/src/domain/assessment-detail.test.ts`, `qm/src/domain/audit-copy.test.ts`, `qm/src/domain/dates.test.ts` (Fall ergänzen)

**Interfaces:**
- Consumes: `withAudit`, `assertCan`, `listAuditEvents`-Muster, Test-Helper.
- Produces:
  - `class ValidationError extends Error` in `org-context.ts`
  - `NA_REASON_MIN = 10`, `NA_REASON_MAX = 500`
  - `AssessmentRow` zusätzlich `notApplicableReason: string | null`
  - `setAssessmentStatus(ctx, criterionId, status, opts?: { reason?: string | null })`
  - `setAssessmentDueDate(ctx, criterionId, dueDate: string | null): Promise<{ id: string; dueDate: string | null }>`
  - `type AssessmentDetail = AssessmentRow & { assessmentId: string | null; updatedAt: Date | null; standardVersionLabel: string; standardValidated: boolean }`
  - `getAssessmentByNumber(ctx, number: string): Promise<AssessmentDetail | null>`
  - `type HistoryEntry = { id: string; createdAt: Date; eventType: string; actorName: string | null; before: unknown; after: unknown }`
  - `listCriterionHistory(ctx, assessmentId: string): Promise<HistoryEntry[]>` (verlangt `audit.read`)
  - `describeAuditEvent(e: { eventType: string; before: unknown; after: unknown }): string` (rein)
  - `formatDateTime(d: Date): string`

- [ ] **Step 1: Failing tests (Begründungspflicht)**

Create `qm/src/domain/assessment-na.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION, criterion, criterionAssessment } from "@/db/schema";
import { listAssessments, setAssessmentDueDate, setAssessmentStatus } from "./assessments";
import { listAuditEvents } from "./audit";
import { importCatalog } from "./catalog";
import { ForbiddenError, ValidationError } from "./org-context";
import { addMemberTo, ctxFor, makeOrg, resetDb } from "@/test/helpers";

const REASON = "Der Rettungsdienst betreibt keinen Rettungshelikopter.";

async function setup() {
  await importCatalog(db, {
    standardVersionId: ACTIVE_STANDARD_VERSION,
    label: "t",
    rows: [
      { nummer: "7.9", titel: "Helikopter", kapitel: "Prozess", anerkennung_muss: true, anerkennung_soll: false, erneuerung_muss: true, erneuerung_soll: false, sortierung: 1 },
    ],
  });
  const [c] = await db.select().from(criterion).where(eq(criterion.standardVersionId, ACTIVE_STANDARD_VERSION));
  const a = await makeOrg("na-a");
  const b = await makeOrg("na-b");
  return { c, a, b, ctxA: ctxFor(a.org.id, a.user.id, "owner"), ctxB: ctxFor(b.org.id, b.user.id, "owner") };
}

describe("not applicable needs a reason", () => {
  beforeEach(resetDb);

  it.each([undefined, null, "", "   ", "zu kurz", "x".repeat(501)])("rejects reason %j without writing anything", async (reason) => {
    const { c, ctxA } = await setup();
    await expect(setAssessmentStatus(ctxA, c.id, "not_applicable", { reason })).rejects.toBeInstanceOf(ValidationError);
    expect(await db.select().from(criterionAssessment)).toHaveLength(0);
    expect(await listAuditEvents(ctxA)).toHaveLength(0);
  });

  it("stores the trimmed reason and audits actor, before and after", async () => {
    const { c, ctxA } = await setup();
    await setAssessmentStatus(ctxA, c.id, "open");
    await setAssessmentStatus(ctxA, c.id, "not_applicable", { reason: `  ${REASON}  ` });
    const rows = await listAssessments(ctxA);
    expect(rows[0]).toMatchObject({ status: "not_applicable", notApplicableReason: REASON });
    const [latest] = await listAuditEvents(ctxA);
    expect(latest.eventType).toBe("criterion.not_applicable_changed");
    expect(latest.actorUserId).toBe(ctxA.userId);
    expect(latest.beforeJson).toEqual({ status: "open", reason: null });
    expect(latest.afterJson).toEqual({ status: "not_applicable", reason: REASON });
  });

  it("clears the reason when leaving not applicable and keeps it as before in the audit event", async () => {
    const { c, ctxA } = await setup();
    await setAssessmentStatus(ctxA, c.id, "not_applicable", { reason: REASON });
    await setAssessmentStatus(ctxA, c.id, "met", { reason: "wird ignoriert" });
    const [row] = await db.select().from(criterionAssessment);
    expect(row.status).toBe("met");
    expect(row.notApplicableReason).toBeNull();
    const [latest] = await listAuditEvents(ctxA);
    expect(latest.eventType).toBe("criterion.not_applicable_changed");
    expect(latest.beforeJson).toEqual({ status: "not_applicable", reason: REASON });
    expect(latest.afterJson).toEqual({ status: "met", reason: null });
  });

  it("uses the normal event type for changes that do not touch not applicable", async () => {
    const { c, ctxA } = await setup();
    await setAssessmentStatus(ctxA, c.id, "open");
    const [e] = await listAuditEvents(ctxA);
    expect(e.eventType).toBe("criterion.status_changed");
    expect(e.afterJson).toEqual({ status: "open", reason: null });
  });

  it("is forbidden for a viewer and leaves other organisations untouched", async () => {
    const { c, a, ctxA, ctxB } = await setup();
    const v = await addMemberTo(a.org.id, "viewer", "viewer");
    await expect(
      setAssessmentStatus(ctxFor(a.org.id, v.id, "viewer"), c.id, "not_applicable", { reason: REASON }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await setAssessmentStatus(ctxA, c.id, "not_applicable", { reason: REASON });
    const seenByB = await listAssessments(ctxB);
    expect(seenByB[0]).toMatchObject({ status: "not_assessed", notApplicableReason: null });
  });
});

describe("due date", () => {
  beforeEach(resetDb);

  it("sets, changes and clears the due date with audit events", async () => {
    const { c, ctxA } = await setup();
    await setAssessmentDueDate(ctxA, c.id, "2026-11-15");
    await setAssessmentDueDate(ctxA, c.id, "2026-12-01");
    await setAssessmentDueDate(ctxA, c.id, null);
    const [row] = await db.select().from(criterionAssessment);
    expect(row.dueDate).toBeNull();
    expect(row.status).toBe("not_assessed");
    const events = (await listAuditEvents(ctxA)).filter((e) => e.eventType === "criterion.due_date_changed");
    expect(events).toHaveLength(3);
    expect(events[0].beforeJson).toEqual({ dueDate: "2026-12-01" });
    expect(events[0].afterJson).toEqual({ dueDate: null });
  });

  it.each(["2026-13-01", "2026-02-30", "15.11.2026", "morgen", ""])("rejects %j", async (value) => {
    const { c, ctxA } = await setup();
    await expect(setAssessmentDueDate(ctxA, c.id, value)).rejects.toBeInstanceOf(ValidationError);
    expect(await db.select().from(criterionAssessment)).toHaveLength(0);
  });

  it("keeps the status when only the due date changes and is scoped to the organisation", async () => {
    const { c, ctxA, ctxB } = await setup();
    await setAssessmentStatus(ctxA, c.id, "critical");
    await setAssessmentDueDate(ctxA, c.id, "2026-11-15");
    const a = await listAssessments(ctxA);
    expect(a[0]).toMatchObject({ status: "critical", dueDate: "2026-11-15" });
    const b = await listAssessments(ctxB);
    expect(b[0]).toMatchObject({ status: "not_assessed", dueDate: null });
    const rows = await db.select().from(criterionAssessment).where(and(eq(criterionAssessment.organizationId, ctxB.organizationId)));
    expect(rows).toHaveLength(0);
  });
});
```

Create `qm/src/domain/assessment-detail.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION, criterion, criterionAssessment } from "@/db/schema";
import { getAssessmentByNumber, listCriterionHistory, setAssessmentStatus } from "./assessments";
import { importCatalog } from "./catalog";
import { ForbiddenError } from "./org-context";
import { addMemberTo, ctxFor, makeOrg, resetDb } from "@/test/helpers";

async function setup() {
  await importCatalog(db, {
    standardVersionId: ACTIVE_STANDARD_VERSION,
    label: "Entwurf",
    rows: [
      { nummer: "7.3.10", titel: "Hygiene", kapitel: "Prozess", anerkennung_muss: true, anerkennung_soll: false, erneuerung_muss: true, erneuerung_soll: false, sortierung: 1 },
    ],
  });
  const [c] = await db.select().from(criterion).where(eq(criterion.standardVersionId, ACTIVE_STANDARD_VERSION));
  const a = await makeOrg("det-a");
  const b = await makeOrg("det-b");
  return { c, a, b, ctxA: ctxFor(a.org.id, a.user.id, "owner"), ctxB: ctxFor(b.org.id, b.user.id, "owner") };
}

describe("getAssessmentByNumber", () => {
  beforeEach(resetDb);

  it("returns null for an unknown number and the not assessed default for an untouched criterion", async () => {
    const { ctxA } = await setup();
    expect(await getAssessmentByNumber(ctxA, "9.9.9")).toBeNull();
    const d = await getAssessmentByNumber(ctxA, "7.3.10");
    expect(d).toMatchObject({
      number: "7.3.10", status: "not_assessed", assessmentId: null, updatedAt: null,
      standardVersionLabel: "Entwurf", standardValidated: false, notApplicableReason: null,
    });
  });

  it("is scoped to the own organisation", async () => {
    const { c, ctxA, ctxB } = await setup();
    await setAssessmentStatus(ctxA, c.id, "critical");
    expect((await getAssessmentByNumber(ctxA, "7.3.10"))?.status).toBe("critical");
    expect((await getAssessmentByNumber(ctxB, "7.3.10"))?.status).toBe("not_assessed");
  });

  it("is readable for a viewer", async () => {
    const { a } = await setup();
    const v = await addMemberTo(a.org.id, "v", "viewer");
    await expect(getAssessmentByNumber(ctxFor(a.org.id, v.id, "viewer"), "7.3.10")).resolves.not.toBeNull();
  });
});

describe("listCriterionHistory", () => {
  beforeEach(resetDb);

  it("lists the events of one assessment newest first with the actor name", async () => {
    const { c, ctxA } = await setup();
    await setAssessmentStatus(ctxA, c.id, "open");
    await setAssessmentStatus(ctxA, c.id, "critical");
    const d = await getAssessmentByNumber(ctxA, "7.3.10");
    const history = await listCriterionHistory(ctxA, d!.assessmentId!);
    expect(history).toHaveLength(2);
    expect(history[0].after).toEqual({ status: "critical", reason: null });
    expect(history[0].actorName).toMatch(/^user-det-a/);
  });

  it("is only readable with the audit right", async () => {
    const { c, a, ctxA } = await setup();
    await setAssessmentStatus(ctxA, c.id, "open");
    const id = (await db.select().from(criterionAssessment))[0].id;
    for (const role of ["reviewer", "editor", "viewer"] as const) {
      const u = await addMemberTo(a.org.id, role, role);
      await expect(listCriterionHistory(ctxFor(a.org.id, u.id, role), id)).rejects.toBeInstanceOf(ForbiddenError);
    }
  });

  it("never returns events of another organisation, even with a foreign assessment id", async () => {
    const { c, ctxA, ctxB } = await setup();
    await setAssessmentStatus(ctxA, c.id, "open");
    const id = (await db.select().from(criterionAssessment))[0].id;
    expect(await listCriterionHistory(ctxB, id)).toEqual([]);
  });
});
```

Create `qm/src/domain/audit-copy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { describeAuditEvent } from "./audit-copy";

describe("describeAuditEvent", () => {
  it("describes plain status changes", () => {
    expect(
      describeAuditEvent({ eventType: "criterion.status_changed", before: { status: "open", reason: null }, after: { status: "met", reason: null } }),
    ).toBe("Stand von «Offen» zu «Erfüllt»");
  });
  it("describes marking as not applicable with the reason", () => {
    expect(
      describeAuditEvent({
        eventType: "criterion.not_applicable_changed",
        before: { status: "open", reason: null },
        after: { status: "not_applicable", reason: "Kein Helikopter im Betrieb." },
      }),
    ).toBe("Stand von «Offen» zu «Entfällt», Begründung: Kein Helikopter im Betrieb.");
  });
  it("describes leaving not applicable and keeps the old reason", () => {
    expect(
      describeAuditEvent({
        eventType: "criterion.not_applicable_changed",
        before: { status: "not_applicable", reason: "Kein Helikopter im Betrieb." },
        after: { status: "open", reason: null },
      }),
    ).toBe("Stand von «Entfällt» zu «Offen», frühere Begründung: Kein Helikopter im Betrieb.");
  });
  it("describes due date changes", () => {
    expect(describeAuditEvent({ eventType: "criterion.due_date_changed", before: { dueDate: null }, after: { dueDate: "2026-11-15" } })).toBe("Frist gesetzt: 15.11.2026");
    expect(describeAuditEvent({ eventType: "criterion.due_date_changed", before: { dueDate: "2026-11-15" }, after: { dueDate: "2026-12-01" } })).toBe("Frist von 15.11.2026 zu 01.12.2026");
    expect(describeAuditEvent({ eventType: "criterion.due_date_changed", before: { dueDate: "2026-11-15" }, after: { dueDate: null } })).toBe("Frist entfernt (war 15.11.2026)");
  });
  it("falls back to the event type for unknown or malformed events", () => {
    expect(describeAuditEvent({ eventType: "x.y", before: null, after: null })).toBe("x.y");
    expect(describeAuditEvent({ eventType: "criterion.status_changed", before: 5, after: "kaputt" })).toBe("criterion.status_changed");
  });
});
```

An `qm/src/domain/dates.test.ts` ergänzen:

```ts
  it("formats timestamps in Zurich time", () => {
    expect(formatDateTime(new Date("2026-10-07T12:05:00Z"))).toBe("07.10.2026, 14:05");
    expect(formatDateTime(new Date("2026-01-15T23:30:00Z"))).toBe("16.01.2026, 00:30");
  });
```

(`formatDateTime` im Import ergänzen.) Falls `Intl` die Trennung anders ausgibt (z.B. ohne Komma), im Test das tatsächliche Format der Zielumgebung festlegen, aber `TT.MM.JJJJ, HH:MM` ist das Ziel; ggf. mit `formatToParts` zusammensetzen.

Run: `pnpm test`
Expected: FAIL (Spalte, Typen, Funktionen fehlen).

- [ ] **Step 2: Schema und Migration**

In `qm/src/db/schema/domain.ts` der Tabelle `criterionAssessment` die Spalte `notApplicableReason: text("not_applicable_reason"),` hinzufügen (nach `note`).

```bash
cd qm && pnpm db:generate && pnpm db:migrate
```

Expected: `drizzle/0004_*.sql` mit `ALTER TABLE "criterion_assessment" ADD COLUMN "not_applicable_reason" text`, auf `qm_dev` angewendet.

- [ ] **Step 3: ValidationError, Datumsformat, Audit-Texte**

In `qm/src/domain/org-context.ts` ergänzen:

```ts
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
```

In `qm/src/domain/dates.ts` ergänzen:

```ts
const ZURICH_DATE_TIME = new Intl.DateTimeFormat("de-CH", {
  timeZone: "Europe/Zurich",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** TT.MM.JJJJ, HH:MM in Zürcher Zeit. */
export function formatDateTime(d: Date): string {
  const p = Object.fromEntries(ZURICH_DATE_TIME.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}.${p.month}.${p.year}, ${p.hour}:${p.minute}`;
}
```

Create `qm/src/domain/audit-copy.ts`:

```ts
import { formatDate } from "./dates";

const STATUS_WORD: Record<string, string> = {
  not_assessed: "Nicht bewertet",
  met: "Erfüllt",
  open: "Offen",
  critical: "Kritisch",
  not_applicable: "Entfällt",
};

type StatusPayload = { status: string; reason: string | null };
type DuePayload = { dueDate: string | null };

function asStatus(v: unknown): StatusPayload | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.status !== "string") return null;
  return { status: o.status, reason: typeof o.reason === "string" ? o.reason : null };
}

function asDue(v: unknown): DuePayload | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (!("dueDate" in o)) return null;
  return { dueDate: typeof o.dueDate === "string" ? o.dueDate : null };
}

const word = (s: string) => STATUS_WORD[s] ?? s;

/** Menschenlesbare Beschreibung eines Audit-Events zu einem Kriterium. Unbekanntes fällt auf den Eventtyp zurück. */
export function describeAuditEvent(e: { eventType: string; before: unknown; after: unknown }): string {
  if (e.eventType === "criterion.status_changed" || e.eventType === "criterion.not_applicable_changed") {
    const b = asStatus(e.before);
    const a = asStatus(e.after);
    if (!b || !a) return e.eventType;
    const base = `Stand von «${word(b.status)}» zu «${word(a.status)}»`;
    if (a.status === "not_applicable" && a.reason) return `${base}, Begründung: ${a.reason}`;
    if (b.status === "not_applicable" && b.reason) return `${base}, frühere Begründung: ${b.reason}`;
    return base;
  }
  if (e.eventType === "criterion.due_date_changed") {
    const b = asDue(e.before);
    const a = asDue(e.after);
    if (!b || !a) return e.eventType;
    if (a.dueDate && !b.dueDate) return `Frist gesetzt: ${formatDate(a.dueDate)}`;
    if (!a.dueDate && b.dueDate) return `Frist entfernt (war ${formatDate(b.dueDate)})`;
    if (a.dueDate && b.dueDate) return `Frist von ${formatDate(b.dueDate)} zu ${formatDate(a.dueDate)}`;
  }
  return e.eventType;
}
```

- [ ] **Step 4: Services**

In `qm/src/domain/assessments.ts`:

1. Imports ergänzen: `desc` aus drizzle-orm, `auditEvent`, `standardVersion`, `user` aus dem Schema, `assertCan`, `ValidationError`.
2. `AssessmentRow` um `notApplicableReason: string | null;` erweitern; in `listAssessments` im `select` `notApplicableReason: criterionAssessment.notApplicableReason,` ergänzen (der `map` setzt weiter nur den Status-Default).
3. Konstanten und Validierung:

```ts
export const NA_REASON_MIN = 10;
export const NA_REASON_MAX = 500;

function requireReason(reason: string | null | undefined): string {
  const trimmed = (reason ?? "").trim();
  if (trimmed.length < NA_REASON_MIN || trimmed.length > NA_REASON_MAX) {
    throw new ValidationError(
      `Für «Entfällt» ist eine Begründung mit ${NA_REASON_MIN} bis ${NA_REASON_MAX} Zeichen nötig.`,
    );
  }
  return trimmed;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
```

4. `setAssessmentStatus` mit vierter Parameter-`opts: { reason?: string | null } = {}`: nach `assertCan` `const reason = status === "not_applicable" ? requireReason(opts.reason) : null;` (Validierung vor `withAudit`). Im Insert `notApplicableReason: reason`, im `set` `{ status, notApplicableReason: reason, updatedAt: new Date() }`. Audit:

```ts
    const beforeStatus = before?.status ?? "not_assessed";
    const touchesNa = beforeStatus === "not_applicable" || after.status === "not_applicable";
    ...
      event: {
        eventType: touchesNa ? "criterion.not_applicable_changed" : "criterion.status_changed",
        entityType: "criterion_assessment",
        entityId: after.id,
        before: { status: beforeStatus, reason: before?.notApplicableReason ?? null },
        after: { status: after.status, reason: after.notApplicableReason },
      },
```

5. `setAssessmentDueDate`:

```ts
export async function setAssessmentDueDate(
  ctx: OrgContext,
  criterionId: string,
  dueDate: string | null,
): Promise<{ id: string; dueDate: string | null }> {
  assertCan(ctx, "assessment", "write");
  if (dueDate !== null && !isValidIsoDate(dueDate)) {
    throw new ValidationError("Die Frist muss ein gültiges Datum sein.");
  }
  return withAudit(ctx, async (tx) => {
    const [before] = await tx
      .select()
      .from(criterionAssessment)
      .where(and(eq(criterionAssessment.organizationId, ctx.organizationId), eq(criterionAssessment.criterionId, criterionId)));
    const [after] = await tx
      .insert(criterionAssessment)
      .values({ organizationId: ctx.organizationId, criterionId, dueDate })
      .onConflictDoUpdate({
        target: [criterionAssessment.organizationId, criterionAssessment.criterionId],
        set: { dueDate, updatedAt: new Date() },
      })
      .returning();
    return {
      result: { id: after.id, dueDate: after.dueDate },
      event: {
        eventType: "criterion.due_date_changed",
        entityType: "criterion_assessment",
        entityId: after.id,
        before: { dueDate: before?.dueDate ?? null },
        after: { dueDate: after.dueDate },
      },
    };
  });
}
```

6. `getAssessmentByNumber` und `listCriterionHistory`:

```ts
export type AssessmentDetail = AssessmentRow & {
  assessmentId: string | null;
  updatedAt: Date | null;
  standardVersionLabel: string;
  standardValidated: boolean;
};

export async function getAssessmentByNumber(ctx: OrgContext, number: string): Promise<AssessmentDetail | null> {
  assertCan(ctx, "assessment", "read");
  const [r] = await db
    .select({
      criterionId: criterion.id,
      number: criterion.number,
      title: criterion.title,
      chapter: criterion.chapter,
      mandatoryAccreditation: criterion.mandatoryAccreditation,
      shouldAccreditation: criterion.shouldAccreditation,
      mandatoryRenewal: criterion.mandatoryRenewal,
      shouldRenewal: criterion.shouldRenewal,
      status: criterionAssessment.status,
      dueDate: criterionAssessment.dueDate,
      notApplicableReason: criterionAssessment.notApplicableReason,
      assessmentId: criterionAssessment.id,
      updatedAt: criterionAssessment.updatedAt,
      standardVersionLabel: standardVersion.label,
      standardValidationStatus: standardVersion.validationStatus,
    })
    .from(criterion)
    .innerJoin(standardVersion, eq(standardVersion.id, criterion.standardVersionId))
    .leftJoin(
      criterionAssessment,
      and(
        eq(criterionAssessment.criterionId, criterion.id),
        eq(criterionAssessment.organizationId, ctx.organizationId),
      ),
    )
    .where(and(eq(criterion.standardVersionId, ACTIVE_STANDARD_VERSION), eq(criterion.number, number)));
  if (!r) return null;
  const { standardValidationStatus, ...rest } = r;
  return { ...rest, status: r.status ?? "not_assessed", standardValidated: standardValidationStatus === "validated" };
}

export type HistoryEntry = {
  id: string;
  createdAt: Date;
  eventType: string;
  actorName: string | null;
  before: unknown;
  after: unknown;
};

export async function listCriterionHistory(ctx: OrgContext, assessmentId: string): Promise<HistoryEntry[]> {
  assertCan(ctx, "audit", "read");
  const rows = await db
    .select({
      id: auditEvent.id,
      createdAt: auditEvent.createdAt,
      eventType: auditEvent.eventType,
      actorName: user.name,
      before: auditEvent.beforeJson,
      after: auditEvent.afterJson,
    })
    .from(auditEvent)
    .leftJoin(user, eq(user.id, auditEvent.actorUserId))
    .where(
      and(
        eq(auditEvent.organizationId, ctx.organizationId),
        eq(auditEvent.entityType, "criterion_assessment"),
        eq(auditEvent.entityId, assessmentId),
      ),
    )
    .orderBy(desc(auditEvent.createdAt), desc(auditEvent.id))
    .limit(100);
  return rows;
}
```

Hinweis: Wenn zwei Events im selben Millisekunden-Zeitstempel liegen (gleiche Transaktionszeit ist nicht möglich, aber schnelle Folgen), ordnet `desc(auditEvent.id)` nicht chronologisch. Reihenfolge-Tests laufen mit je einer Transaktion pro Aufruf, deren `now()` sich unterscheidet; falls ein Test flackert, ein zusätzliches `await new Promise((r) => setTimeout(r, 5))` zwischen den Aufrufen im Test einfügen, nicht die Fachlogik ändern.

7. In `qm/src/domain/dashboard.test.ts` im Hilfsbau `row()` das Feld `notApplicableReason: null,` ergänzen (sonst Typfehler); keine Assertion ändern.
8. Seed-Minimalfix (damit die Suite grün bleibt): in `qm/src/seed/demo.ts` bekommt der Override `"7.9"` ein Feld `reason: "Der Rettungsdienst betreibt keinen Rettungshelikopter (Demo-Angabe)."` (Typ von `OVERRIDES` um `reason?: string` erweitern) und der Aufruf `setAssessmentStatus(ctx, c.id, status)` wird zu `setAssessmentStatus(ctx, c.id, status, { reason: o?.reason })`. Das zweite n/a-Kriterium und der Seed-Test folgen in Task 5.
9. Die Audit-Payload hat jetzt die Form `{ status, reason }` statt `{ status }`. Bestehende Tests, die `beforeJson`/`afterJson` mit `toEqual({ status: ... })` prüfen (u.a. in `qm/src/domain/tenancy.test.ts`), werden auf `{ status: ..., reason: null }` angepasst: gleiche Strenge, nur die neue Form. Keine Assertion entfällt oder wird lockerer.

- [ ] **Step 5: Tests, Typecheck, Commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: alles grün.

```bash
git add qm/ && git commit -m "feat(qm): require a reason for not applicable, add due date and detail services with audit history"
```

---

### Task 3: Kriterienliste mit Filter, Detail-Links und Dashboard-Hinweis

**Files:**
- Create: `qm/src/domain/criteria-filter.ts`, `qm/src/domain/criteria-filter.test.ts`, `qm/src/components/criteria/status-copy.ts`
- Modify: `qm/src/app/(app)/criteria/page.tsx`, `qm/src/components/dashboard/readiness-hero.tsx`

**Interfaces:**
- Produces: `type StatusFilter = AssessmentStatus | "all"`, `parseStatusFilter(value: string | string[] | undefined): StatusFilter`, `countByStatus(rows: readonly { status: AssessmentStatus }[]): Record<AssessmentStatus, number>`; `STATUS_LABEL`, `STATUS_TONE`, `scopeLabel(row)` in `components/criteria/status-copy.ts`.

- [ ] **Step 1: Failing tests**

Create `qm/src/domain/criteria-filter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { countByStatus, parseStatusFilter } from "./criteria-filter";

describe("parseStatusFilter", () => {
  it("accepts the known statuses and all, and falls back to all for anything else", () => {
    expect(parseStatusFilter("not_applicable")).toBe("not_applicable");
    expect(parseStatusFilter("critical")).toBe("critical");
    expect(parseStatusFilter("all")).toBe("all");
    expect(parseStatusFilter(undefined)).toBe("all");
    expect(parseStatusFilter("drop table")).toBe("all");
    expect(parseStatusFilter(["met", "open"])).toBe("met");
    expect(parseStatusFilter([])).toBe("all");
  });
});

describe("countByStatus", () => {
  it("counts every status including zero counts", () => {
    expect(countByStatus([{ status: "met" }, { status: "met" }, { status: "critical" }])).toEqual({
      not_assessed: 0, met: 2, open: 0, critical: 1, not_applicable: 0,
    });
  });
});
```

Run: `pnpm test src/domain/criteria-filter.test.ts`
Expected: FAIL.

- [ ] **Step 2: Filter-Helfer**

Create `qm/src/domain/criteria-filter.ts`:

```ts
import { ASSESSMENT_STATUSES, type AssessmentStatus } from "@/db/schema";

export type StatusFilter = AssessmentStatus | "all";

export function parseStatusFilter(value: string | string[] | undefined): StatusFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return (ASSESSMENT_STATUSES as readonly string[]).includes(v ?? "") ? (v as AssessmentStatus) : "all";
}

export function countByStatus(rows: readonly { status: AssessmentStatus }[]): Record<AssessmentStatus, number> {
  const counts = Object.fromEntries(ASSESSMENT_STATUSES.map((s) => [s, 0])) as Record<AssessmentStatus, number>;
  for (const r of rows) counts[r.status] += 1;
  return counts;
}
```

- [ ] **Step 3: Gemeinsame Texte, Kriterienseite, Dashboard-Hinweis**

Create `qm/src/components/criteria/status-copy.ts` (Inhalt aus `criteria/page.tsx` ausgelagert, plus `scopeLabel`):

```ts
import type { AssessmentStatus } from "@/db/schema";
import { DEFAULT_PROCEDURE } from "@/domain/dashboard";
import { scopeOf, type CriterionInput } from "@/domain/readiness";

export const STATUS_LABEL: Record<AssessmentStatus, string> = {
  not_assessed: "Nicht bewertet",
  met: "Erfüllt",
  open: "Offen",
  critical: "Kritisch",
  not_applicable: "Entfällt",
};

export const STATUS_TONE: Record<AssessmentStatus, string> = {
  not_assessed: "text-text-muted",
  met: "text-success",
  open: "text-warning",
  critical: "text-critical",
  not_applicable: "text-text-muted",
};

export function scopeLabel(r: Omit<CriterionInput, "status">): string {
  const scope = scopeOf({ ...r, status: "not_assessed" }, DEFAULT_PROCEDURE);
  if (scope.mandatory) return "Muss";
  return scope.should ? "Soll" : "- (nicht im Verfahren)";
}
```

`qm/src/app/(app)/criteria/page.tsx` überarbeiten:

- `export default function CriteriaPage({ searchParams }: { searchParams: Promise<{ status?: string | string[] }> })`, Rendering weiter hinter `<Suspense>`; die async Komponente erhält `searchParams`-Promise, `await`et es und ruft `parseStatusFilter`.
- Filterleiste oberhalb der Tabelle: `<nav aria-label="Filter nach Stand">` mit Links (`<Link href="/criteria">` für «Alle (n)» und `/criteria?status=<status>` je Status mit Zahl aus `countByStatus`), aktiver Link mit `aria-current="true"` und `font-semibold`, Status immer als Text; die Leiste umbricht auf kleinen Bildschirmen.
- Tabelle: Nummer als `<Link href={`/criteria/${r.number}`}>` (Primärfarbe, unterstrichen bei Hover, sichtbarer Fokus), Spalte «Stand» zeigt `STATUS_LABEL`; bei `not_applicable` unter dem Label eine zweite Zeile «Begründung: …» in `text-text-muted` (volle Zeile, kein Abschneiden). Leere Treffer: «Keine Kriterien mit diesem Stand.»
- `STATUS_LABEL`, `STATUS_TONE`, `scopeLabel` aus `@/components/criteria/status-copy`; die lokalen Kopien in der Seite entfallen.

`qm/src/components/dashboard/readiness-hero.tsx`: unter der Summary-Zeile (vor dem Katalog-Hinweis), wenn `naMandatoryNotice(r.mandatory.notApplicable)` nicht `null` ist:

```tsx
        {naNotice && (
          <p className="mt-1">
            {naNotice}{" "}
            <Link href="/criteria?status=not_applicable" className="text-primary underline">
              Begründungen ansehen
            </Link>
          </p>
        )}
```

(`import Link from "next/link";` und `import { naMandatoryNotice } from "@/domain/readiness-copy";` ergänzen; `const naNotice = naMandatoryNotice(r.mandatory.notApplicable);`.)

- [ ] **Step 4: Verifikation und Commit**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: grün.

```bash
git add qm/ && git commit -m "feat(qm): filterable criteria list with detail links and not applicable notice on the dashboard"
```

---

### Task 4: Detailseite mit Bewertungsformular und Verlauf

**Files:**
- Create: `qm/src/app/(app)/criteria/[number]/page.tsx`, `qm/src/app/(app)/criteria/[number]/actions.ts`, `qm/src/app/(app)/criteria/[number]/assessment-form.tsx`

**Interfaces:**
- Consumes: `getAssessmentByNumber`, `setAssessmentStatus`, `setAssessmentDueDate`, `listCriterionHistory`, `describeAuditEvent`, `formatDateTime`, `formatDate`, `can`, `STATUS_LABEL`, `STATUS_TONE`, `scopeLabel`, `ValidationError`, `ForbiddenError`.
- Produces: Route `/criteria/[number]`; `updateAssessmentAction(prev: FormState, formData: FormData): Promise<FormState>`; `type FormState = { ok: boolean; message: string } | null`.

Client-Komponenten (hier das Formular) importieren NICHTS als Wert aus `@/db/schema`, `@/db` oder `@/domain/dashboard`; die Status-Optionen kommen als Props von der Server-Seite (siehe Code unten). Vor dem ersten `.tsx`: `impeccable:impeccable` versuchen (sonst nach `DESIGN.md` arbeiten). Tokens, Textlabels, Tabellen mit caption und th scope, sichtbarer Fokus, keine Em-Dashes. Dynamische Daten (Session, DB, `params`) stehen in einer async Komponente hinter `<Suspense>`.

- [ ] **Step 1: Server Action**

Create `qm/src/app/(app)/criteria/[number]/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ASSESSMENT_STATUSES } from "@/db/schema";
import { getAssessmentByNumber, setAssessmentDueDate, setAssessmentStatus } from "@/domain/assessments";
import { ForbiddenError, ValidationError } from "@/domain/org-context";
import { requireOrgContextOrRedirect } from "@/domain/request-context";

export type FormState = { ok: boolean; message: string } | null;

const input = z.object({
  number: z.string().min(1).max(40),
  status: z.enum(ASSESSMENT_STATUSES),
  reason: z.string().max(2000).optional(),
  dueDate: z.string().max(20).optional(),
});

export async function updateAssessmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = input.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Eingabe unvollständig oder ungültig." };
  const { number, status, reason, dueDate } = parsed.data;
  const ctx = await requireOrgContextOrRedirect();
  const detail = await getAssessmentByNumber(ctx, number);
  if (!detail) return { ok: false, message: "Kriterium nicht gefunden." };

  const due = dueDate && dueDate.length > 0 ? dueDate : null;
  const trimmedReason = (reason ?? "").trim();
  const statusUnchanged =
    status === detail.status &&
    (status !== "not_applicable" || trimmedReason === (detail.notApplicableReason ?? ""));

  try {
    // Zwei getrennte, je auditierte Schritte: Stand und Frist.
    if (!statusUnchanged) await setAssessmentStatus(ctx, detail.criterionId, status, { reason });
    if (due !== detail.dueDate) await setAssessmentDueDate(ctx, detail.criterionId, due);
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, message: e.message };
    if (e instanceof ForbiddenError) return { ok: false, message: "Keine Berechtigung für diese Änderung." };
    throw e;
  }

  revalidatePath("/");
  revalidatePath("/criteria");
  revalidatePath(`/criteria/${number}`);
  return { ok: true, message: "Gespeichert." };
}
```

- [ ] **Step 2: Formular (Client)**

Create `qm/src/app/(app)/criteria/[number]/assessment-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import type { AssessmentStatus } from "@/db/schema";
import { updateAssessmentAction, type FormState } from "./actions";

export function AssessmentForm(props: {
  number: string;
  status: AssessmentStatus;
  reason: string | null;
  dueDate: string | null;
  statusOptions: { value: AssessmentStatus; label: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateAssessmentAction, null);
  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="number" value={props.number} />
      <label className="flex flex-col gap-1">
        <span className="text-text-muted">Stand</span>
        <select
          name="status"
          defaultValue={props.status}
          className="h-10 rounded-[var(--radius)] border border-field-border bg-surface px-3"
        >
          {props.statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-text-muted">Begründung (Pflicht bei «Entfällt», 10 bis 500 Zeichen)</span>
        <textarea
          name="reason"
          rows={3}
          maxLength={500}
          defaultValue={props.reason ?? ""}
          className="rounded-[var(--radius)] border border-field-border bg-surface px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-text-muted">Frist</span>
        <input
          type="date"
          name="dueDate"
          defaultValue={props.dueDate ?? ""}
          className="h-10 rounded-[var(--radius)] border border-field-border bg-surface px-3"
        />
      </label>
      {state && (
        <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-success" : "text-critical"}>
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-10 self-start rounded-[var(--radius)] bg-primary px-4 font-medium text-on-primary disabled:opacity-60"
      >
        {pending ? "Speichern..." : "Speichern"}
      </button>
    </form>
  );
}
```

Falls das Token `text-on-primary` unter diesem Namen nicht existiert, den im Login-Formular benutzten Klassennamen für die Schrift auf der Primärfläche übernehmen (kein Hex).

- [ ] **Step 3: Seite**

Create `qm/src/app/(app)/criteria/[number]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { STATUS_LABEL, STATUS_TONE, scopeLabel } from "@/components/criteria/status-copy";
import { ASSESSMENT_STATUSES } from "@/db/schema";
import { getAssessmentByNumber, listCriterionHistory } from "@/domain/assessments";
import { describeAuditEvent } from "@/domain/audit-copy";
import { formatDate, formatDateTime } from "@/domain/dates";
import { requireOrgContextOrRedirect } from "@/domain/request-context";
import { can } from "@/domain/rights";
import { AssessmentForm } from "./assessment-form";

async function Detail({ params }: { params: Promise<{ number: string }> }) {
  const { number: raw } = await params;
  const number = decodeURIComponent(raw);
  const ctx = await requireOrgContextOrRedirect();
  const detail = await getAssessmentByNumber(ctx, number);
  if (!detail) notFound();
  const canWrite = can(ctx.role, "assessment", "write");
  const history =
    can(ctx.role, "audit", "read") && detail.assessmentId
      ? await listCriterionHistory(ctx, detail.assessmentId)
      : null;

  return (
    <>
      <header className="flex flex-col gap-1">
        <Link href="/criteria" className="text-primary underline">Zurück zu den Kriterien</Link>
        <h1 className="text-xl font-semibold">
          <span className="font-mono">{detail.number}</span> {detail.title}
        </h1>
      </header>

      <section aria-labelledby="facts-heading" className="flex flex-col gap-3">
        <h2 id="facts-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">Angaben</h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <div><dt className="text-text-muted">Kapitel</dt><dd>{detail.chapter}</dd></div>
          <div><dt className="text-text-muted">Pflicht im Verfahren</dt><dd>{scopeLabel(detail)}</dd></div>
          <div>
            <dt className="text-text-muted">Standardversion</dt>
            <dd>
              {detail.standardVersionLabel}
              {!detail.standardValidated && <span className="text-text-muted"> (Entwurf, nicht validiert)</span>}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Stand</dt>
            <dd className={`font-medium ${STATUS_TONE[detail.status]}`}>{STATUS_LABEL[detail.status]}</dd>
          </div>
          <div><dt className="text-text-muted">Frist</dt><dd>{detail.dueDate ? formatDate(detail.dueDate) : "ohne Frist"}</dd></div>
          <div>
            <dt className="text-text-muted">Zuletzt geändert</dt>
            <dd>{detail.updatedAt ? formatDateTime(detail.updatedAt) : "noch nie"}</dd>
          </div>
          {detail.status === "not_applicable" && (
            <div className="sm:col-span-2">
              <dt className="text-text-muted">Begründung «Entfällt»</dt>
              <dd>{detail.notApplicableReason}</dd>
            </div>
          )}
        </dl>
      </section>

      <section aria-labelledby="assess-heading" className="flex flex-col gap-3">
        <h2 id="assess-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">Bewertung</h2>
        {canWrite ? (
          <AssessmentForm
            number={detail.number}
            status={detail.status}
            reason={detail.notApplicableReason}
            dueDate={detail.dueDate}
            statusOptions={ASSESSMENT_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          />
        ) : (
          <p className="text-text-muted">Mit Ihrer Rolle ist die Bewertung schreibgeschützt.</p>
        )}
      </section>

      {history && (
        <section aria-labelledby="history-heading" className="flex flex-col gap-3">
          <h2 id="history-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">Verlauf</h2>
          {history.length === 0 ? (
            <p className="text-text-muted">Noch keine Änderungen.</p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Änderungsverlauf dieses Kriteriums</caption>
                <thead className="bg-surface-subtle text-text-muted">
                  <tr>
                    <th scope="col" className="whitespace-nowrap px-3 py-2">Zeitpunkt</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-2">Person</th>
                    <th scope="col" className="px-3 py-2">Änderung</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2">{formatDateTime(h.createdAt)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{h.actorName ?? "unbekannt"}</td>
                      <td className="px-3 py-2">{describeAuditEvent(h)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

export default function CriterionPage({ params }: { params: Promise<{ number: string }> }) {
  return (
    <main className="flex flex-col gap-6">
      <Suspense fallback={<p className="text-text-muted">Kriterium wird geladen...</p>}>
        <Detail params={params} />
      </Suspense>
    </main>
  );
}
```

`scopeLabel(detail)` erwartet `Omit<CriterionInput, "status">`; `AssessmentDetail` ist eine Obermenge davon. Falls `notFound()` unter Cache Components ein Problem macht, die Dokumentation von Next 16 zu `notFound` in Suspense prüfen und den Aufruf entsprechend platzieren.

- [ ] **Step 4: Verifikation**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: grün.

Ende-zu-Ende per Headless-Chromium (Skript im Scratchpad; `~/.local/pipx/venvs/scrapling/bin/python -I`, das installierte Chromium über `executable_path`, wie in den früheren Prüfungen): `pnpm seed:demo -- --yes-reset`, Dev-Server auf Port 3100 mit `BETTER_AUTH_URL=http://localhost:3100`. Als `owner@demo.qm.test` (Passwort `Demo-QM-2026`):
1. `/criteria/7.3.10` öffnen: Titel, Angaben, Formular und Verlauf sichtbar.
2. Stand auf «Erfüllt» setzen, speichern, Meldung «Gespeichert.»; danach `/`: «Kritische Pflichtkriterien» ist von 2 auf 1 gesunken, die Zeile 7.3.10 ist aus dem Action Center verschwunden, Dokumentationsstand gestiegen.
3. Auf `/criteria/6.5.2` «Entfällt» OHNE Begründung speichern: Fehlermeldung, kein Stand geändert. Mit Begründung speichern: Stand «Entfällt», Dashboard zeigt «1 Pflichtkriterium als nicht anwendbar markiert» (oder mehr, je nach Seed), Verlauf zeigt die Begründung.
4. `/criteria?status=not_applicable` zeigt nur die Entfällt-Kriterien mit Begründung.
5. Als `editor@demo.qm.test`: Formular sichtbar, Verlauf nicht. Als `viewer@demo.qm.test`: weder Formular noch Verlauf.
6. Dev-Log ohne `uncached data`- und Hydration-Meldungen. Server beenden (Port 3100 frei), Screenshots vom Desktop löschen.

```bash
git add qm/ && git commit -m "feat(qm): add criterion detail page with audited assessment form and history"
```

---

### Task 5: Seed mit Begründungen

**Files:**
- Modify: `qm/src/seed/demo.ts`, `qm/src/seed/demo.test.ts`

**Interfaces:**
- Consumes: `setAssessmentStatus(ctx, id, status, { reason })`.

- [ ] **Step 1: Failing test**

An `qm/src/seed/demo.test.ts` im Dashboard-Story-Test ergänzen:

```ts
    expect(dash.readiness.mandatory.notApplicable).toBe(2);
    const na = (await listAssessments(ctx)).filter((r) => r.status === "not_applicable");
    expect(na.map((r) => r.number).sort()).toEqual(["6.10", "7.9"]);
    expect(na.every((r) => (r.notApplicableReason ?? "").length >= 10)).toBe(true);
```

(`listAssessments` aus `@/domain/assessments` importieren, falls noch nicht vorhanden.)

Run: `pnpm test src/seed/demo.test.ts`
Expected: FAIL (nur 7.9 ist im Seed als nicht anwendbar markiert, 6.10 fehlt).

- [ ] **Step 2: Seed anpassen**

In `qm/src/seed/demo.ts` (der Typ `reason?: string` und der Aufruf mit `{ reason: o?.reason }` existieren seit Task 2) das zweite n/a-Pflichtkriterium ergänzen; der Eintrag für 7.9 steht schon da:

```ts
  "7.9": { status: "not_applicable", reason: "Der Rettungsdienst betreibt keinen Rettungshelikopter (Demo-Angabe)." },
  "6.10": { status: "not_applicable", reason: "Notärzte werden vom Spital gestellt, der Rettungsdienst delegiert keine Notarzt-Tätigkeiten (Demo-Angabe)." },
```


- [ ] **Step 3: Tests, Seed gegen qm_dev, Commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: alles grün.

Run: `pnpm seed:demo -- --yes-reset` und `docker compose exec db psql -U qm -d qm_dev -c "select c.number, a.not_applicable_reason from criterion_assessment a join criterion c on c.id = a.criterion_id where a.status = 'not_applicable' order by 1"`
Expected: zwei Zeilen (6.10 und 7.9) mit Begründung.

```bash
git add qm/ && git commit -m "feat(qm): seed not applicable criteria with reasons"
```

---

## Abschluss Plan 3 (Definition of Done)

- `pnpm test`, `typecheck`, `lint`, `build` grün.
- «Nicht anwendbar» ohne Begründung wird serverseitig abgelehnt (kein Datensatz, kein Audit-Event); mit Begründung wird sie gespeichert und im Verlauf angezeigt; Wechsel weg löscht die Begründung und bewahrt sie im Audit-Event.
- Null anwendbare Pflichtkriterien ergibt nie «Bereit».
- Dashboard weist die Zahl nicht anwendbarer Pflichtkriterien aus; die Kriterienliste filtert nach Stand.
- Detailseite: Bewertung und Frist änderbar (nur Rollen mit Schreibrecht), Verlauf nur für `owner` und `qm_admin`; Änderungen wirken sofort auf das Dashboard.
- Nichts gepusht ohne Freigabe.

## Self-Review (vom Plan-Autor durchgeführt)

- **Spec-Abdeckung:** Alle sieben Punkte der Entscheidung von Henrik (Begründungspflicht, Audit-Event mit Actor/Zeit/Begründung, Fortschritt herausgerechnet, kein automatischer Kritisch-Zustand, null Pflicht nie Bereit, UI-Ausweis, Filterbarkeit) sind Tasks 1 bis 4 zugeordnet. R18 und R11 bleiben unverändert.
- **Platzhalter-Scan:** keine. Bewusste Grenzen: Nachweise und Dokumente (Plan 4), Massnahmen (Plan 5), Verfahren als Konstante.
- **Typkonsistenz:** `AssessmentRow.notApplicableReason` (Task 2) wird in Task 3 bis 5 und in `dashboard.test.ts` benutzt; `mandatory.notApplicable` (Task 1) in Task 3 und 5; `setAssessmentStatus(…, opts)` (Task 2) in Task 4 und 5; `STATUS_LABEL` (Task 3) in Task 4.
- **Bekannte Lücken:** Stand und Frist werden in zwei getrennten Transaktionen gespeichert (je auditiert). Die Detailseite hat keine Nachweise (Plan 4). `requireOrgContextOrRedirect` in Server Actions leitet bei fehlender Sitzung per Redirect um.
