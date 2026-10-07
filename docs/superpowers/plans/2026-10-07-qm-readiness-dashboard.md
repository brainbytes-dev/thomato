# QM Readiness-Dashboard Implementation Plan (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Startseite beantwortet «Sind wir bereit, was fehlt, bis wann?»: qualitativer Readiness-Status getrennt vom Dokumentationsfortschritt, darunter das Action Center («Braucht Aufmerksamkeit»), Fristen und Kapitelfortschritt, alles aus persistierten, mandantengetrennten Daten abgeleitet.

**Architecture:** Reine, testbare Fachfunktionen (`readiness.ts`, `dates.ts`, Action-Item-Ableitung) plus ein mandantengebundener Service `getDashboard(ctx, now)`, der Bewertungen und Fristen der Organisation liest und die Fachfunktionen aufruft. UI-Komponenten sind reine Server-Komponenten, die das Ergebnis darstellen. Keine Zahl im UI ist hartcodiert.

**Tech Stack:** Wie Plan 1 (Next.js 16 mit Cache Components, Drizzle, Better Auth, Vitest gegen echtes Postgres, pnpm).

**Spec:** `docs/implementation/BUILD_PLAN_TO_2026-11-17.md` (Roadmap, Plan 2), Layout `~/Downloads/Thomato_IVR_QM_Dashboard_Layout.md` (Reihenfolge Readiness, Action Center, Fristen, Fortschritt, Details; Readiness ist nicht Fortschritt), Design `qm/DESIGN.md`. Die Berechnung des Readiness-Status ist im Layout-Dokument ausdrücklich offen und wird in diesem Plan als nachprüfbare Regel festgelegt (siehe Global Constraints, Rulings R11 bis R13 im Ledger).

## Global Constraints

- Alle Constraints aus Plan 1 gelten weiter (pnpm, kein `any`, kein `db:push`, `organization_id NOT NULL` auf mandantenabhängigen Tabellen, Rollen exakt `owner`, `qm_admin`, `reviewer`, `editor`, `viewer`, Rechte nur aus `src/domain/rights.ts`, kein Produktnamen-Literal ausser `src/brand.ts`, Farben nur über Tokens in `globals.css`, keine Em-Dashes, Conventional Commits, kein `git push` ohne Freigabe von Henrik).
- **Readiness-Regel (verbindlich, testbar):** Im Geltungsbereich eines Verfahrens (`accreditation` oder `renewal`) liegen Kriterien, die in diesem Verfahren Muss oder Soll sind; alle anderen werden ignoriert. Kriterien mit Status `not_applicable` fallen aus Zähler und Nenner. Status: `not_assessed` wenn nichts anwendbar ist oder alle anwendbaren Kriterien `not_assessed` sind; sonst `critical` wenn mindestens ein Muss-Kriterium `critical` ist; sonst `action_needed` wenn mindestens ein Muss-Kriterium nicht `met` ist oder ein Soll-Kriterium `critical` ist; sonst `ready`.
- **Fortschritt** = erfüllte / anwendbare Kriterien im Geltungsbereich, auf ganze Prozent ABGERUNDET (`percentOf`, Ruling R16: 100 % nur wenn alles Anwendbare erfüllt ist), `null` wenn nichts anwendbar ist. Fortschritt beeinflusst den Status nie.
- Solange die aktive Standardversion `draft_extracted` ist, trägt das Ergebnis `basisValidated: false`, und die UI zeigt unter dem Readiness-Status: «Interne Arbeitsbewertung auf Basis eines nicht validierten Katalogs (Entwurf). Keine Entscheidung des IVR.»
- Vorgabe Henrik 2026-10-07: Audit-Log darf nur `owner` und `qm_admin` lesen. `viewer`, `editor` und `reviewer` nicht.
- Fristen sind Datumswerte (`date`), «heute» wird in `Europe/Zurich` bestimmt. Der Dienst nimmt `now: Date` als Parameter, kein verstecktes `new Date()` in der Fachlogik.
- Das Verfahren (`accreditation` oder `renewal`) ist in Plan 2 eine Konstante `DEFAULT_PROCEDURE = "accreditation"`; eine Organisationseinstellung folgt später (YAGNI).

## Review Focus

1. Ein Muss-Kriterium `critical`, `open` oder `not_assessed` kann nie zu Status `ready` führen, auch nicht bei 98 % Fortschritt (Task 3).
2. Zeitzonen-Kante: 22:30 UTC am 07.10. ist in Zürich bereits der 08.10.; Fristen dürfen nicht um einen Tag springen (Task 2).
3. Cross-Tenant: Dashboard und Fristen von Organisation A erscheinen nie bei Organisation B (Task 4).
4. `viewer` sieht das Dashboard, aber nicht das Audit-Log; `reviewer` und `editor` sehen das Audit-Log nicht (Task 1, 4).
5. Soll-Kriterium `critical` darf `ready` verhindern, ein unbewertetes oder offenes Soll-Kriterium nicht (Task 3).

## File Structure

```
qm/
  drizzle/0003_*.sql                               Migration: Tabelle deadline
  src/db/schema/domain.ts                          + DEADLINE_KINDS, deadline
  src/domain/rights.ts                             + Ressourcen audit, deadline (Lesen)
  src/domain/audit.ts                              listAuditEvents prüft audit.read
  src/domain/dates.ts                              zurichDate, daysUntil, urgency, monthsUntil, addDays, formatDate
  src/domain/deadlines.ts                          listDeadlines (mandantengebunden)
  src/domain/readiness.ts                          computeReadiness, readinessSummary (rein)
  src/domain/dashboard.ts                          buildActionItems, chapterProgress, getDashboard
  src/domain/assessments.ts                        listAssessments liefert zusätzlich die vier Muss/Soll-Flags
  src/domain/role-labels.ts                        deutsche Rollenbezeichnungen
  src/seed/demo.ts                                 Story nach Kapitel, Fristen, Fälligkeiten, optionales `now`
  src/components/app-nav.tsx                       linke Navigation (Client, aktive Route)
  src/components/dashboard/readiness-hero.tsx      Status, Fortschritt, Kennzahlen
  src/components/dashboard/action-center.tsx       Tabelle «Braucht Aufmerksamkeit»
  src/components/dashboard/deadline-list.tsx       Fristen als Tabelle
  src/components/dashboard/chapter-progress.tsx    Kapitelfortschritt als Tabelle
  src/app/(app)/layout.tsx                         Sidebar-Layout
  src/app/(app)/page.tsx                           Dashboard (ersetzt src/app/page.tsx)
  src/proxy.ts                                     Matcher inkl. "/"
```

---

### Task 1: Audit-Leserecht einschränken, Ressourcen audit und deadline

**Files:**
- Modify: `qm/src/domain/rights.ts`, `qm/src/domain/audit.ts`
- Test: `qm/src/domain/rights.test.ts` (Fälle ergänzen), `qm/src/domain/tenancy.test.ts` (Fälle ergänzen)

**Interfaces:**
- Produces: `RESOURCE_ACTIONS` kennt `audit: ["read"]` und `deadline: ["read"]`; `can(role, "audit", "read")` ist nur für `owner` und `qm_admin` wahr; `can(role, "deadline", "read")` für alle fünf Rollen; `listAuditEvents(ctx)` wirft `ForbiddenError` für die anderen Rollen.

- [ ] **Step 1: Failing tests**

An `qm/src/domain/rights.test.ts` ergänzen (bestehende Fälle unverändert lassen):

```ts
describe("audit and deadline rights", () => {
  it("only owner and qm_admin read the audit log", () => {
    expect(can("owner", "audit", "read")).toBe(true);
    expect(can("qm_admin", "audit", "read")).toBe(true);
    expect(can("reviewer", "audit", "read")).toBe(false);
    expect(can("editor", "audit", "read")).toBe(false);
    expect(can("viewer", "audit", "read")).toBe(false);
  });
  it("every role reads deadlines", () => {
    for (const role of ["owner", "qm_admin", "reviewer", "editor", "viewer"] as const) {
      expect(can(role, "deadline", "read")).toBe(true);
    }
  });
});
```

An `qm/src/domain/tenancy.test.ts` im `describe("permissions", ...)` ergänzen:

```ts
  it("only owner and qm_admin may read the audit log", async () => {
    const { a } = await setup();
    for (const role of ["reviewer", "editor", "viewer"] as const) {
      const u = await addMemberTo(a.org.id, role, role);
      await expect(listAuditEvents(ctxFor(a.org.id, u.id, role))).rejects.toBeInstanceOf(ForbiddenError);
    }
    const admin = await addMemberTo(a.org.id, "admin", "qm_admin");
    await expect(listAuditEvents(ctxFor(a.org.id, admin.id, "qm_admin"))).resolves.toEqual([]);
  });
```

Run: `pnpm test src/domain/rights.test.ts src/domain/tenancy.test.ts`
Expected: FAIL (Typfehler bzw. `audit` unbekannt, `listAuditEvents` wirft nicht).

- [ ] **Step 2: Rechte-Matrix erweitern**

In `qm/src/domain/rights.ts`:

```ts
export const RESOURCE_ACTIONS = {
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  assessment: ["read", "write", "approve"],
  measure: ["read", "write"],
  document: ["read", "write", "approve"],
  audit: ["read"],
  deadline: ["read"],
} as const;
```

`READ_ALL` bekommt `deadline: ["read"]`. In `ROLE_RIGHTS` bekommen `owner` und `qm_admin` zusätzlich `audit: ["read"]` und `deadline: ["read"]`; `reviewer` und `editor` bekommen zusätzlich `deadline: ["read"]`; `viewer` erbt über `READ_ALL`. `permissions.ts` leitet das Better-Auth-Statement aus `RESOURCE_ACTIONS` ab und braucht keine Änderung.

- [ ] **Step 3: listAuditEvents prüft das Recht**

In `qm/src/domain/audit.ts` `assertCan` importieren (`import { assertCan, type OrgContext } from "./org-context";`) und als erste Zeile von `listAuditEvents`:

```ts
  assertCan(ctx, "audit", "read");
```

- [ ] **Step 4: Tests, Typecheck, Commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: alles grün (bestehende Tests rufen `listAuditEvents` nur mit `owner`-Kontext auf).

```bash
git add qm/ && git commit -m "feat(qm): restrict audit log to owner and qm_admin and add deadline read right"
```

---

### Task 2: Datumslogik und Fristen

**Files:**
- Create: `qm/src/domain/dates.ts`, `qm/src/domain/deadlines.ts`
- Modify: `qm/src/db/schema/domain.ts`
- Create (generiert): `qm/drizzle/0003_*.sql`
- Test: `qm/src/domain/dates.test.ts`, `qm/src/domain/deadlines.test.ts`

**Interfaces:**
- Produces:
  - `zurichDate(now: Date): string` (YYYY-MM-DD), `daysUntil(due: string, now: Date): number`, `SOON_DAYS = 30`, `type DeadlineUrgency = "overdue" | "soon" | "upcoming"`, `urgency(days: number): DeadlineUrgency`, `monthsUntil(due: string, now: Date): number`, `addDays(iso: string, days: number): string`, `formatDate(iso: string): string` (TT.MM.JJJJ)
  - Schema: `DEADLINE_KINDS = ["application","dossier","expiry","custom"] as const`, `type DeadlineKind`, Tabelle `deadline` (`id`, `organizationId`, `kind`, `label`, `dueDate`, `createdAt`)
  - `type DeadlineView = { id: string; kind: DeadlineKind; label: string; dueDate: string; days: number; urgency: DeadlineUrgency }`, `listDeadlines(ctx: OrgContext, now?: Date): Promise<DeadlineView[]>`

- [ ] **Step 1: Failing tests für die Datumslogik**

Create `qm/src/domain/dates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addDays, daysUntil, formatDate, monthsUntil, urgency, zurichDate } from "./dates";

describe("dates (Europe/Zurich)", () => {
  it("uses the Zurich calendar day, not UTC", () => {
    // 22:30 UTC am 07.10.2026 ist in Zürich (UTC+2) bereits der 08.10.
    expect(zurichDate(new Date("2026-10-07T22:30:00Z"))).toBe("2026-10-08");
    expect(daysUntil("2026-10-08", new Date("2026-10-07T22:30:00Z"))).toBe(0);
    expect(daysUntil("2026-10-09", new Date("2026-10-07T22:30:00Z"))).toBe(1);
  });
  it("counts negative days for overdue dates", () => {
    expect(daysUntil("2026-10-01", new Date("2026-10-07T10:00:00Z"))).toBe(-6);
  });
  it("derives urgency with a 30 day window", () => {
    expect(urgency(-1)).toBe("overdue");
    expect(urgency(0)).toBe("soon");
    expect(urgency(30)).toBe("soon");
    expect(urgency(31)).toBe("upcoming");
  });
  it("counts full months until a date and never goes negative", () => {
    const now = new Date("2026-10-07T10:00:00Z");
    expect(monthsUntil("2028-06-30", now)).toBe(20);
    expect(monthsUntil("2026-12-05", now)).toBe(1);
    expect(monthsUntil("2026-12-07", now)).toBe(2);
    expect(monthsUntil("2026-09-01", now)).toBe(0);
  });
  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("formats dates the Swiss way", () => {
    expect(formatDate("2026-10-07")).toBe("07.10.2026");
  });
});
```

Run: `pnpm test src/domain/dates.test.ts`
Expected: FAIL, `./dates` fehlt.

- [ ] **Step 2: dates.ts**

Create `qm/src/domain/dates.ts`:

```ts
const ZURICH = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Zurich",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const SOON_DAYS = 30;
export type DeadlineUrgency = "overdue" | "soon" | "upcoming";

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

function dayNumber(iso: string): number {
  const [y, m, d] = parts(iso);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Kalendertag in Zürich als YYYY-MM-DD. */
export function zurichDate(now: Date): string {
  return ZURICH.format(now);
}

export function daysUntil(due: string, now: Date): number {
  return Math.round(dayNumber(due) - dayNumber(zurichDate(now)));
}

export function urgency(days: number): DeadlineUrgency {
  if (days < 0) return "overdue";
  return days <= SOON_DAYS ? "soon" : "upcoming";
}

/** Volle Monate bis zum Datum, nie negativ. */
export function monthsUntil(due: string, now: Date): number {
  const [ty, tm, td] = parts(zurichDate(now));
  const [dy, dm, dd] = parts(due);
  const months = (dy - ty) * 12 + (dm - tm) - (dd < td ? 1 : 0);
  return Math.max(0, months);
}

export function addDays(iso: string, days: number): string {
  return new Date((dayNumber(iso) + days) * 86_400_000).toISOString().slice(0, 10);
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
```

Run: `pnpm test src/domain/dates.test.ts`
Expected: PASS (6 Tests).

- [ ] **Step 3: Failing test für listDeadlines**

Create `qm/src/domain/deadlines.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { deadline } from "@/db/schema";
import { listDeadlines } from "./deadlines";
import { ctxFor, makeOrg, resetDb } from "@/test/helpers";

const NOW = new Date("2026-10-07T10:00:00Z");

describe("listDeadlines", () => {
  beforeEach(resetDb);

  it("returns only the deadlines of the own organisation, ordered by date, with days and urgency", async () => {
    const a = await makeOrg("dl-a");
    const b = await makeOrg("dl-b");
    await db.insert(deadline).values([
      { organizationId: a.org.id, kind: "dossier", label: "Dossier", dueDate: "2026-12-01" },
      { organizationId: a.org.id, kind: "application", label: "Antrag", dueDate: "2026-10-20" },
      { organizationId: a.org.id, kind: "custom", label: "Überfällig", dueDate: "2026-10-01" },
      { organizationId: b.org.id, kind: "expiry", label: "Fremd", dueDate: "2027-01-01" },
    ]);
    const list = await listDeadlines(ctxFor(a.org.id, a.user.id, "viewer"), NOW);
    expect(list.map((d) => d.label)).toEqual(["Überfällig", "Antrag", "Dossier"]);
    expect(list[0]).toMatchObject({ days: -6, urgency: "overdue" });
    expect(list[1]).toMatchObject({ days: 13, urgency: "soon" });
    expect(list[2]).toMatchObject({ days: 55, urgency: "upcoming" });
    expect(list.some((d) => d.label === "Fremd")).toBe(false);
  });
});
```

Run: `pnpm test src/domain/deadlines.test.ts`
Expected: FAIL (Schema `deadline`, `./deadlines` fehlen).

- [ ] **Step 4: Schema, Migration, Service**

In `qm/src/db/schema/domain.ts` ergänzen:

```ts
export const DEADLINE_KINDS = ["application", "dossier", "expiry", "custom"] as const;
export type DeadlineKind = (typeof DEADLINE_KINDS)[number];

export const deadline = pgTable(
  "deadline",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id),
    kind: text("kind", { enum: DEADLINE_KINDS }).notNull(),
    label: text("label").notNull(),
    dueDate: date("due_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("deadline_org_due_idx").on(t.organizationId, t.dueDate)],
);
```

```bash
cd qm && pnpm db:generate && pnpm db:migrate
```

Expected: `drizzle/0003_*.sql` mit `CREATE TABLE "deadline"`, auf `qm_dev` angewendet (die Test-DB migriert der Global-Setup).

Create `qm/src/domain/deadlines.ts`:

```ts
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { deadline, type DeadlineKind } from "@/db/schema";
import { daysUntil, urgency, type DeadlineUrgency } from "./dates";
import { assertCan, type OrgContext } from "./org-context";

export type DeadlineView = {
  id: string;
  kind: DeadlineKind;
  label: string;
  dueDate: string;
  days: number;
  urgency: DeadlineUrgency;
};

export async function listDeadlines(ctx: OrgContext, now: Date = new Date()): Promise<DeadlineView[]> {
  assertCan(ctx, "deadline", "read");
  const rows = await db
    .select()
    .from(deadline)
    .where(eq(deadline.organizationId, ctx.organizationId))
    .orderBy(asc(deadline.dueDate));
  return rows.map((r) => {
    const days = daysUntil(r.dueDate, now);
    return { id: r.id, kind: r.kind, label: r.label, dueDate: r.dueDate, days, urgency: urgency(days) };
  });
}
```

`resetDb` in `src/test/helpers.ts` führt die Tabelle `deadline` noch nicht in `TABLES`: `"deadline"` vor `"audit_event"` in die Liste aufnehmen. Dasselbe gilt für die `TRUNCATE`-Liste in `src/seed/demo.ts` (`deadline` ergänzen).

- [ ] **Step 5: Tests, Typecheck, Commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: alles grün.

```bash
git add qm/ && git commit -m "feat(qm): add zurich date helpers, deadline table and tenant-scoped deadline listing"
```

---

### Task 3: Readiness-Engine

**Files:**
- Create: `qm/src/domain/readiness.ts`
- Test: `qm/src/domain/readiness.test.ts`

**Interfaces:**
- Produces:
  - `type ProcedureMode = "accreditation" | "renewal"`, `type ReadinessStatus = "ready" | "action_needed" | "critical" | "not_assessed"`
  - `type CriterionInput = { number: string; chapter: string; mandatoryAccreditation: boolean; shouldAccreditation: boolean; mandatoryRenewal: boolean; shouldRenewal: boolean; status: AssessmentStatus }`
  - `type ReadinessResult = { status: ReadinessStatus; basisValidated: boolean; progressPercent: number | null; applicable: number; met: number; notApplicable: number; mandatory: { total: number; met: number; critical: number; open: number; notAssessed: number }; shouldCritical: number; blockers: string[] }`
  - `computeReadiness(criteria: readonly CriterionInput[], mode: ProcedureMode, basisValidated: boolean): ReadinessResult`
  - `readinessSummary(result: ReadinessResult): string`

- [ ] **Step 1: Failing tests**

Create `qm/src/domain/readiness.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AssessmentStatus } from "@/db/schema";
import { computeReadiness, readinessSummary, type CriterionInput } from "./readiness";

let n = 0;
function crit(
  status: AssessmentStatus,
  opts: Partial<Omit<CriterionInput, "status">> = {},
): CriterionInput {
  n += 1;
  return {
    number: `c${n}`,
    chapter: "Prozess",
    mandatoryAccreditation: true,
    shouldAccreditation: false,
    mandatoryRenewal: true,
    shouldRenewal: false,
    status,
    ...opts,
  };
}
const should = (status: AssessmentStatus) =>
  crit(status, { mandatoryAccreditation: false, shouldAccreditation: true, mandatoryRenewal: false, shouldRenewal: true });

describe("computeReadiness", () => {
  it("is not_assessed for an empty list and for nothing assessed", () => {
    expect(computeReadiness([], "accreditation", false)).toMatchObject({ status: "not_assessed", progressPercent: null });
    const r = computeReadiness([crit("not_assessed"), crit("not_assessed")], "accreditation", false);
    expect(r.status).toBe("not_assessed");
    expect(r.progressPercent).toBe(0);
  });

  it("is ready only when every mandatory criterion is met", () => {
    const r = computeReadiness([crit("met"), crit("met"), should("not_assessed"), should("open")], "accreditation", false);
    expect(r.status).toBe("ready");
  });

  it("a mandatory critical criterion makes it critical even at 98 percent progress", () => {
    const list = [...Array.from({ length: 98 }, () => crit("met")), crit("critical"), crit("met")];
    const r = computeReadiness(list, "accreditation", false);
    expect(r.status).toBe("critical");
    expect(r.progressPercent).toBe(99);
    expect(r.blockers).toHaveLength(1);
  });

  it("a mandatory open criterion means action_needed, never ready", () => {
    expect(computeReadiness([crit("met"), crit("open")], "accreditation", false).status).toBe("action_needed");
  });

  it("a mandatory not_assessed criterion next to assessed ones means action_needed", () => {
    expect(computeReadiness([crit("met"), crit("not_assessed")], "accreditation", false).status).toBe("action_needed");
  });

  it("a critical should criterion prevents ready but is not critical", () => {
    const r = computeReadiness([crit("met"), should("critical")], "accreditation", false);
    expect(r.status).toBe("action_needed");
    expect(r.shouldCritical).toBe(1);
  });

  it("not_applicable criteria drop out of numerator and denominator", () => {
    const r = computeReadiness([crit("met"), crit("not_applicable")], "accreditation", false);
    expect(r.status).toBe("ready");
    expect(r.applicable).toBe(1);
    expect(r.notApplicable).toBe(1);
    expect(r.progressPercent).toBe(100);
  });

  it("ignores criteria outside the scope of the procedure", () => {
    const onlyRenewal = crit("critical", { mandatoryAccreditation: false, mandatoryRenewal: true });
    expect(computeReadiness([crit("met"), onlyRenewal], "accreditation", false).status).toBe("ready");
    expect(computeReadiness([crit("met"), onlyRenewal], "renewal", false).status).toBe("critical");
    const neither = crit("critical", { mandatoryAccreditation: false, mandatoryRenewal: false });
    expect(computeReadiness([neither], "accreditation", false).status).toBe("not_assessed");
  });

  it("passes the validation flag through and never derives ready from it", () => {
    expect(computeReadiness([crit("met")], "accreditation", false).basisValidated).toBe(false);
    expect(computeReadiness([crit("open")], "accreditation", true)).toMatchObject({ basisValidated: true, status: "action_needed" });
  });
});

describe("readinessSummary", () => {
  it("names the blocking points in German with correct singular and plural", () => {
    const one = computeReadiness([crit("met"), crit("critical")], "accreditation", false);
    expect(readinessSummary(one)).toBe("1 kritischer Punkt verhindert aktuell vollständige Readiness.");
    const two = computeReadiness([crit("critical"), crit("critical"), crit("met")], "accreditation", false);
    expect(readinessSummary(two)).toBe("2 kritische Punkte verhindern aktuell vollständige Readiness.");
    const open = computeReadiness([crit("met"), crit("open")], "accreditation", false);
    expect(readinessSummary(open)).toBe("1 Pflichtkriterium ist noch offen oder nicht bewertet.");
    const openMany = computeReadiness([crit("open"), crit("not_assessed"), crit("met")], "accreditation", false);
    expect(readinessSummary(openMany)).toBe("2 Pflichtkriterien sind noch offen oder nicht bewertet.");
    expect(readinessSummary(computeReadiness([crit("met")], "accreditation", false))).toBe("Alle Pflichtkriterien sind erfüllt.");
    expect(readinessSummary(computeReadiness([], "accreditation", false))).toBe("Noch kein Kriterium bewertet.");
    const shouldOnly = computeReadiness([crit("met"), should("critical")], "accreditation", false);
    expect(readinessSummary(shouldOnly)).toBe("1 Soll-Kriterium ist kritisch.");
  });
});
```

Run: `pnpm test src/domain/readiness.test.ts`
Expected: FAIL, `./readiness` fehlt.

- [ ] **Step 2: Implementation**

Create `qm/src/domain/readiness.ts`:

```ts
import type { AssessmentStatus } from "@/db/schema";

export type ProcedureMode = "accreditation" | "renewal";
export type ReadinessStatus = "ready" | "action_needed" | "critical" | "not_assessed";

export type CriterionInput = {
  number: string;
  chapter: string;
  mandatoryAccreditation: boolean;
  shouldAccreditation: boolean;
  mandatoryRenewal: boolean;
  shouldRenewal: boolean;
  status: AssessmentStatus;
};

export type ReadinessResult = {
  status: ReadinessStatus;
  basisValidated: boolean;
  progressPercent: number | null;
  applicable: number;
  met: number;
  notApplicable: number;
  mandatory: { total: number; met: number; critical: number; open: number; notAssessed: number };
  shouldCritical: number;
  blockers: string[];
};

export function scopeOf(c: CriterionInput, mode: ProcedureMode): { mandatory: boolean; should: boolean } {
  return mode === "accreditation"
    ? { mandatory: c.mandatoryAccreditation, should: c.shouldAccreditation }
    : { mandatory: c.mandatoryRenewal, should: c.shouldRenewal };
}

export function computeReadiness(
  criteria: readonly CriterionInput[],
  mode: ProcedureMode,
  basisValidated: boolean,
): ReadinessResult {
  let applicable = 0;
  let met = 0;
  let notApplicable = 0;
  let notAssessed = 0;
  let shouldCritical = 0;
  const mandatory = { total: 0, met: 0, critical: 0, open: 0, notAssessed: 0 };
  const blockers: string[] = [];

  for (const c of criteria) {
    const scope = scopeOf(c, mode);
    if (!scope.mandatory && !scope.should) continue;
    if (c.status === "not_applicable") {
      notApplicable += 1;
      continue;
    }
    applicable += 1;
    if (c.status === "met") met += 1;
    if (c.status === "not_assessed") notAssessed += 1;
    if (scope.mandatory) {
      mandatory.total += 1;
      if (c.status === "met") mandatory.met += 1;
      else if (c.status === "critical") {
        mandatory.critical += 1;
        blockers.push(c.number);
      } else if (c.status === "open") mandatory.open += 1;
      else mandatory.notAssessed += 1;
    } else if (c.status === "critical") {
      shouldCritical += 1;
    }
  }

  let status: ReadinessStatus;
  if (applicable === 0 || notAssessed === applicable) status = "not_assessed";
  else if (mandatory.critical > 0) status = "critical";
  else if (mandatory.met < mandatory.total || shouldCritical > 0) status = "action_needed";
  else status = "ready";

  return {
    status,
    basisValidated,
    progressPercent: applicable === 0 ? null : Math.round((met / applicable) * 100),
    applicable,
    met,
    notApplicable,
    mandatory,
    shouldCritical,
    blockers,
  };
}

export function readinessSummary(r: ReadinessResult): string {
  if (r.status === "not_assessed") return "Noch kein Kriterium bewertet.";
  if (r.status === "critical") {
    const n = r.mandatory.critical;
    return n === 1
      ? "1 kritischer Punkt verhindert aktuell vollständige Readiness."
      : `${n} kritische Punkte verhindern aktuell vollständige Readiness.`;
  }
  if (r.status === "action_needed") {
    const k = r.mandatory.open + r.mandatory.notAssessed;
    if (k > 0) {
      return k === 1
        ? "1 Pflichtkriterium ist noch offen oder nicht bewertet."
        : `${k} Pflichtkriterien sind noch offen oder nicht bewertet.`;
    }
    return r.shouldCritical === 1
      ? "1 Soll-Kriterium ist kritisch."
      : `${r.shouldCritical} Soll-Kriterien sind kritisch.`;
  }
  return "Alle Pflichtkriterien sind erfüllt.";
}
```

- [ ] **Step 3: Tests, Typecheck, Commit**

Run: `pnpm test src/domain/readiness.test.ts && pnpm typecheck && pnpm lint`
Expected: PASS (10 Tests), sauber.

```bash
git add qm/ && git commit -m "feat(qm): add readiness engine separating qualitative status from progress"
```

---

### Task 4: Action Center, Kapitelfortschritt und Dashboard-Service

**Files:**
- Modify: `qm/src/domain/assessments.ts` (Flags in `AssessmentRow` und `listAssessments`)
- Create: `qm/src/domain/dashboard.ts`
- Test: `qm/src/domain/dashboard.test.ts`

**Interfaces:**
- Consumes: `listAssessments` (jetzt mit den vier Flags), `listDeadlines`, `computeReadiness`, `daysUntil`, `monthsUntil`, `standardVersion`, `ACTIVE_STANDARD_VERSION`.
- Produces:
  - `AssessmentRow` zusätzlich: `mandatoryAccreditation: boolean; shouldAccreditation: boolean; mandatoryRenewal: boolean; shouldRenewal: boolean`
  - `DEFAULT_PROCEDURE: ProcedureMode = "accreditation"`, `ACTION_CENTER_LIMIT = 10`
  - `type ActionPriority = "critical" | "high" | "medium"`
  - `type ActionItem = { key: string; priority: ActionPriority; criterionNumber: string | null; topic: string; dueDate: string | null; dueInDays: number | null; statusLabel: string; source: "criterion" | "deadline" }`
  - `buildActionItems(criteria: readonly AssessmentRow[], deadlines: readonly DeadlineView[], mode: ProcedureMode, now: Date): ActionItem[]`
  - `type ChapterProgress = { chapter: string; met: number; applicable: number; percent: number | null }`, `chapterProgress(criteria: readonly AssessmentRow[], mode: ProcedureMode): ChapterProgress[]`
  - `type DashboardData = { readiness: ReadinessResult; actions: ActionItem[]; deadlines: DeadlineView[]; chapters: ChapterProgress[]; monthsToExpiry: number | null; soonCount: number }`
  - `getDashboard(ctx: OrgContext, now?: Date, mode?: ProcedureMode): Promise<DashboardData>`

- [ ] **Step 1: listAssessments liefert die Flags**

In `qm/src/domain/assessments.ts` den Typ `AssessmentRow` um die vier Felder erweitern (`mandatory` bleibt unverändert und entspricht `mandatoryAccreditation`) und im `select` ergänzen:

```ts
      mandatoryAccreditation: criterion.mandatoryAccreditation,
      shouldAccreditation: criterion.shouldAccreditation,
      mandatoryRenewal: criterion.mandatoryRenewal,
      shouldRenewal: criterion.shouldRenewal,
```

- [ ] **Step 2: Failing tests**

Create `qm/src/domain/dashboard.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION, criterion, deadline } from "@/db/schema";
import type { AssessmentRow } from "./assessments";
import { setAssessmentStatus } from "./assessments";
import { importCatalog } from "./catalog";
import { buildActionItems, chapterProgress, getDashboard } from "./dashboard";
import type { DeadlineView } from "./deadlines";
import { ForbiddenError } from "./org-context";
import { ctxFor, makeOrg, resetDb } from "@/test/helpers";
import { eq } from "drizzle-orm";

const NOW = new Date("2026-10-07T10:00:00Z");

let k = 0;
function row(over: Partial<AssessmentRow>): AssessmentRow {
  k += 1;
  return {
    criterionId: `id${k}`,
    number: `${k}`,
    title: `Titel ${k}`,
    chapter: "Prozess",
    mandatory: true,
    mandatoryAccreditation: true,
    shouldAccreditation: false,
    mandatoryRenewal: true,
    shouldRenewal: false,
    status: "not_assessed",
    dueDate: null,
    ...over,
  };
}
const dl = (over: Partial<DeadlineView>): DeadlineView => ({
  id: "d", kind: "custom", label: "Frist", dueDate: "2026-12-01", days: 55, urgency: "upcoming", ...over,
});

describe("buildActionItems", () => {
  it("ranks critical before open before not assessed and drops met, n/a and unassessed should items", () => {
    const items = buildActionItems(
      [
        row({ number: "a", status: "not_assessed" }),
        row({ number: "b", status: "open" }),
        row({ number: "c", status: "critical" }),
        row({ number: "d", status: "met" }),
        row({ number: "e", status: "not_applicable" }),
        row({ number: "f", status: "not_assessed", mandatoryAccreditation: false, shouldAccreditation: true }),
        row({ number: "g", status: "critical", mandatoryAccreditation: false, shouldAccreditation: true }),
      ],
      [],
      "accreditation",
      NOW,
    );
    expect(items.map((i) => [i.criterionNumber, i.priority])).toEqual([
      ["c", "critical"],
      ["b", "high"],
      ["g", "high"],
      ["a", "medium"],
    ]);
    expect(items[0].statusLabel).toBe("Kritisch");
  });

  it("sorts by due date within a priority, undated last, and keeps catalog order as tie-break", () => {
    const items = buildActionItems(
      [
        row({ number: "x", status: "critical" }),
        row({ number: "y", status: "critical", dueDate: "2026-10-20" }),
        row({ number: "z", status: "critical", dueDate: "2026-10-10" }),
      ],
      [],
      "accreditation",
      NOW,
    );
    expect(items.map((i) => i.criterionNumber)).toEqual(["z", "y", "x"]);
    expect(items[0].dueInDays).toBe(3);
  });

  it("turns overdue and soon deadlines into action items and ignores distant ones", () => {
    const items = buildActionItems(
      [],
      [
        dl({ id: "1", label: "Überfällig", days: -6, urgency: "overdue", dueDate: "2026-10-01" }),
        dl({ id: "2", label: "Bald", days: 13, urgency: "soon", dueDate: "2026-10-20" }),
        dl({ id: "3", label: "Heute", days: 0, urgency: "soon", dueDate: "2026-10-07" }),
        dl({ id: "4", label: "Fern", days: 90, urgency: "upcoming", dueDate: "2027-01-05" }),
      ],
      "accreditation",
      NOW,
    );
    expect(items.map((i) => [i.topic, i.priority, i.statusLabel])).toEqual([
      ["Überfällig", "critical", "Frist überschritten (seit 6 Tagen)"],
      ["Heute", "high", "Frist heute"],
      ["Bald", "high", "Frist in 13 Tagen"],
    ]);
  });
});

describe("chapterProgress", () => {
  it("groups in-scope applicable criteria by chapter in order of appearance", () => {
    const rows = [
      row({ chapter: "Antrag", status: "met" }),
      row({ chapter: "Antrag", status: "open" }),
      row({ chapter: "Struktur", status: "met" }),
      row({ chapter: "Struktur", status: "not_applicable" }),
      row({ chapter: "Ergebnis", mandatoryAccreditation: false, shouldAccreditation: false }),
    ];
    expect(chapterProgress(rows, "accreditation")).toEqual([
      { chapter: "Antrag", met: 1, applicable: 2, percent: 50 },
      { chapter: "Struktur", met: 1, applicable: 1, percent: 100 },
    ]);
  });
});

describe("getDashboard", () => {
  beforeEach(resetDb);

  async function seedCatalog() {
    const rows = ["5.2.1", "6.1", "7.3.10", "7.3.8"].map((nr, i) => ({
      nummer: nr, titel: `K ${nr}`, kapitel: i < 2 ? "Antrag" : "Prozess",
      anerkennung_muss: true, anerkennung_soll: false, erneuerung_muss: true, erneuerung_soll: false,
      sortierung: 100 + i,
    }));
    await importCatalog(db, { standardVersionId: ACTIVE_STANDARD_VERSION, label: "t", rows });
    const crits = await db.select().from(criterion).where(eq(criterion.standardVersionId, ACTIVE_STANDARD_VERSION)).orderBy(criterion.sortOrder);
    return crits;
  }

  it("derives status, progress, actions and deadlines from the persisted data of the own organisation only", async () => {
    const crits = await seedCatalog();
    const a = await makeOrg("dash-a");
    const b = await makeOrg("dash-b");
    const ctxA = ctxFor(a.org.id, a.user.id, "owner");
    const ctxB = ctxFor(b.org.id, b.user.id, "owner");
    await setAssessmentStatus(ctxA, crits[0].id, "met");
    await setAssessmentStatus(ctxA, crits[1].id, "met");
    await setAssessmentStatus(ctxA, crits[2].id, "critical");
    await db.insert(deadline).values([
      { organizationId: a.org.id, kind: "application", label: "Antrag", dueDate: "2026-10-20" },
      { organizationId: a.org.id, kind: "expiry", label: "Ablauf", dueDate: "2028-06-30" },
    ]);

    const dashA = await getDashboard(ctxA, NOW);
    expect(dashA.readiness.status).toBe("critical");
    expect(dashA.readiness.progressPercent).toBe(50);
    expect(dashA.readiness.basisValidated).toBe(false);
    expect(dashA.actions[0]).toMatchObject({ criterionNumber: "7.3.10", priority: "critical" });
    expect(dashA.deadlines.map((d) => d.label)).toEqual(["Antrag", "Ablauf"]);
    expect(dashA.monthsToExpiry).toBe(20);
    expect(dashA.soonCount).toBe(1);

    const dashB = await getDashboard(ctxB, NOW);
    expect(dashB.readiness.status).toBe("not_assessed");
    expect(dashB.deadlines).toEqual([]);
    expect(dashB.monthsToExpiry).toBeNull();
    expect(dashB.actions.every((i) => i.source === "criterion" && i.priority === "medium")).toBe(true);
  });

  it("is readable for a viewer", async () => {
    await seedCatalog();
    const a = await makeOrg("dash-v", "viewer");
    await expect(getDashboard(ctxFor(a.org.id, a.user.id, "viewer"), NOW)).resolves.toBeDefined();
  });

  it("a mandatory critical item is never hidden by high progress", async () => {
    const crits = await seedCatalog();
    const a = await makeOrg("dash-c");
    const ctx = ctxFor(a.org.id, a.user.id, "owner");
    for (const c of crits.slice(0, 3)) await setAssessmentStatus(ctx, c.id, "met");
    await setAssessmentStatus(ctx, crits[3].id, "critical");
    const dash = await getDashboard(ctx, NOW);
    expect(dash.readiness.progressPercent).toBe(75);
    expect(dash.readiness.status).toBe("critical");
  });
});
```

`ForbiddenError` ist importiert und wird im nächsten Schritt benutzt: Den Import entfernen, falls `pnpm lint` ihn als ungenutzt meldet.

Run: `pnpm test src/domain/dashboard.test.ts`
Expected: FAIL, `./dashboard` fehlt.

- [ ] **Step 3: Implementation**

Create `qm/src/domain/dashboard.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION, standardVersion } from "@/db/schema";
import { listAssessments, type AssessmentRow } from "./assessments";
import { daysUntil, monthsUntil, SOON_DAYS } from "./dates";
import { listDeadlines, type DeadlineView } from "./deadlines";
import { assertCan, type OrgContext } from "./org-context";
import { computeReadiness, percentOf, scopeOf, type ProcedureMode, type ReadinessResult } from "./readiness";

export const DEFAULT_PROCEDURE: ProcedureMode = "accreditation";
export const ACTION_CENTER_LIMIT = 10;

export type ActionPriority = "critical" | "high" | "medium";
export type ActionItem = {
  key: string;
  priority: ActionPriority;
  criterionNumber: string | null;
  topic: string;
  dueDate: string | null;
  dueInDays: number | null;
  statusLabel: string;
  source: "criterion" | "deadline";
};

const RANK: Record<ActionPriority, number> = { critical: 0, high: 1, medium: 2 };
const NO_DATE = "9999-12-31";

function criterionPriority(c: AssessmentRow, mandatory: boolean): { priority: ActionPriority; label: string } | null {
  if (c.status === "met" || c.status === "not_applicable") return null;
  if (mandatory) {
    if (c.status === "critical") return { priority: "critical", label: "Kritisch" };
    if (c.status === "open") return { priority: "high", label: "Offen" };
    return { priority: "medium", label: "Nicht bewertet" };
  }
  if (c.status === "critical") return { priority: "high", label: "Kritisch" };
  if (c.status === "open") return { priority: "medium", label: "Offen" };
  return null;
}

function deadlineLabel(days: number): string {
  if (days < 0) return `Frist überschritten (seit ${-days} ${-days === 1 ? "Tag" : "Tagen"})`;
  if (days === 0) return "Frist heute";
  return `Frist in ${days} ${days === 1 ? "Tag" : "Tagen"}`;
}

export function buildActionItems(
  criteria: readonly AssessmentRow[],
  deadlines: readonly DeadlineView[],
  mode: ProcedureMode,
  now: Date,
): ActionItem[] {
  const items: ActionItem[] = [];
  for (const c of criteria) {
    const scope = scopeOf(c, mode);
    if (!scope.mandatory && !scope.should) continue;
    const p = criterionPriority(c, scope.mandatory);
    if (!p) continue;
    items.push({
      key: `criterion:${c.criterionId}`,
      priority: p.priority,
      criterionNumber: c.number,
      topic: `${c.number} ${c.title}`,
      dueDate: c.dueDate,
      dueInDays: c.dueDate ? daysUntil(c.dueDate, now) : null,
      statusLabel: p.label,
      source: "criterion",
    });
  }
  for (const d of deadlines) {
    if (d.days > SOON_DAYS) continue;
    items.push({
      key: `deadline:${d.id}`,
      priority: d.days < 0 ? "critical" : "high",
      criterionNumber: null,
      topic: d.label,
      dueDate: d.dueDate,
      dueInDays: d.days,
      statusLabel: deadlineLabel(d.days),
      source: "deadline",
    });
  }
  // Array.prototype.sort ist stabil: gleiche Priorität und gleiches Datum behalten die Katalogreihenfolge.
  return items.sort(
    (a, b) => RANK[a.priority] - RANK[b.priority] || (a.dueDate ?? NO_DATE).localeCompare(b.dueDate ?? NO_DATE),
  );
}

export type ChapterProgress = { chapter: string; met: number; applicable: number; percent: number | null };

export function chapterProgress(criteria: readonly AssessmentRow[], mode: ProcedureMode): ChapterProgress[] {
  const byChapter = new Map<string, { met: number; applicable: number }>();
  for (const c of criteria) {
    const scope = scopeOf(c, mode);
    if (!scope.mandatory && !scope.should) continue;
    if (c.status === "not_applicable") continue;
    const entry = byChapter.get(c.chapter) ?? { met: 0, applicable: 0 };
    entry.applicable += 1;
    if (c.status === "met") entry.met += 1;
    byChapter.set(c.chapter, entry);
  }
  return [...byChapter].map(([chapter, e]) => ({
    chapter,
    met: e.met,
    applicable: e.applicable,
    percent: percentOf(e.met, e.applicable),
  }));
}

export type DashboardData = {
  readiness: ReadinessResult;
  actions: ActionItem[];
  deadlines: DeadlineView[];
  chapters: ChapterProgress[];
  monthsToExpiry: number | null;
  soonCount: number;
};

export async function getDashboard(
  ctx: OrgContext,
  now: Date = new Date(),
  mode: ProcedureMode = DEFAULT_PROCEDURE,
): Promise<DashboardData> {
  assertCan(ctx, "assessment", "read");
  const [criteria, deadlines, versions] = await Promise.all([
    listAssessments(ctx),
    listDeadlines(ctx, now),
    db
      .select({ status: standardVersion.validationStatus })
      .from(standardVersion)
      .where(eq(standardVersion.id, ACTIVE_STANDARD_VERSION)),
  ]);
  const basisValidated = versions[0]?.status === "validated";
  const actions = buildActionItems(criteria, deadlines, mode, now);
  const expiry = deadlines.find((d) => d.kind === "expiry" && d.days >= 0);
  return {
    readiness: computeReadiness(criteria, mode, basisValidated),
    actions,
    deadlines,
    chapters: chapterProgress(criteria, mode),
    monthsToExpiry: expiry ? monthsUntil(expiry.dueDate, now) : null,
    soonCount: actions.filter((a) => a.dueInDays !== null && a.dueInDays <= SOON_DAYS).length,
  };
}
```

`soonCount` zählt Action-Items mit Fälligkeit innerhalb von 30 Tagen oder überfällig (Layout-Kennzahl «≤30 Tage»). Im Test hat Organisation A genau die Frist «Antrag» in 13 Tagen, daher 1.

- [ ] **Step 4: Tests, Typecheck, Commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: alles grün.

```bash
git add qm/ && git commit -m "feat(qm): add action center derivation, chapter progress and tenant-scoped dashboard service"
```

---

### Task 5: Seed-Story für das Dashboard

**Files:**
- Modify: `qm/src/seed/demo.ts`
- Test: `qm/src/seed/demo.test.ts` (Fälle ergänzen)

**Interfaces:**
- Consumes: `getDashboard`, `addDays`, `zurichDate`, `deadline`, `criterionAssessment`.
- Produces: `seedDemo({ catalog, now? })` (neues optionales `now: Date`, Standard `new Date()`); Story: Kapitel Antrag, Struktur und Prozess sind `met`, Kapitel Ergebnis bleibt unbewertet, mit Ausnahmen (siehe unten); vier Fristen relativ zu `now`.

- [ ] **Step 1: Failing tests**

An `qm/src/seed/demo.test.ts` ergänzen (bestehende Tests unverändert):

```ts
import { getDashboard } from "@/domain/dashboard";

describe("seedDemo dashboard story", () => {
  beforeEach(resetDb);
  const NOW = new Date("2026-10-07T10:00:00Z");

  it("shows high progress but critical readiness, with deadlines and dated critical items", async () => {
    await seedDemo({ catalog, now: NOW });
    const [org] = await db.select().from(organization);
    const owner = (await db.select().from(member)).find((m) => m.role === "owner");
    const ctx = { organizationId: org.id, userId: owner!.userId, role: "owner" as const };
    const dash = await getDashboard(ctx, NOW);
    expect(dash.readiness.status).toBe("critical");
    expect(dash.readiness.progressPercent).toBeGreaterThan(50);
    expect(dash.readiness.mandatory.critical).toBe(2);
    expect(dash.deadlines.map((d) => d.kind).sort()).toEqual(["application", "custom", "dossier", "expiry"]);
    const critical = dash.actions.filter((a) => a.priority === "critical" && a.source === "criterion");
    expect(critical.map((a) => a.criterionNumber).sort()).toEqual(["6.3.2", "7.3.10"]);
    expect(critical.every((a) => a.dueInDays !== null && a.dueInDays > 0)).toBe(true);
    expect(dash.monthsToExpiry).toBeGreaterThan(12);
    expect(dash.chapters.map((c) => c.chapter)).toContain("Ergebnis");
  });
});
```

Run: `pnpm test src/seed/demo.test.ts`
Expected: FAIL (Story liefert nur 5 bewertete Kriterien, keine Fristen).

- [ ] **Step 2: Seed erweitern**

In `qm/src/seed/demo.ts`: Die Konstante `STORY` ersetzen durch Kapitelregel und Ausnahmen:

```ts
// Story: Antrag, Struktur und Prozess sind weitgehend erfüllt (hoher Fortschritt), Ergebnis ist unbewertet.
// Zwei kritische Pflichtpunkte machen den Status trotzdem kritisch: Fortschritt ist nicht Readiness.
const CHAPTER_DEFAULT: Record<string, AssessmentStatus | undefined> = {
  Antrag: "met",
  Struktur: "met",
  Prozess: "met",
};
const OVERRIDES: Record<string, { status: AssessmentStatus; dueInDays?: number }> = {
  "6.3.2": { status: "critical", dueInDays: 25 },
  "7.3.10": { status: "critical", dueInDays: 12 },
  "6.5.2": { status: "open", dueInDays: 40 },
  "7.3.8": { status: "open", dueInDays: 40 },
  "7.3.2": { status: "open" },
  "7.9": { status: "not_applicable" },
  "8.1": { status: "open" },
};
```

`seedDemo`-Signatur `seedDemo(input: { catalog: unknown; now?: Date })`. Statt der Schleife über `STORY` (am Ende der Funktion) alle Kriterien der aktiven Version lesen und bewerten:

```ts
  const now = input.now ?? new Date();
  const catalogRows = await db
    .select({ id: criterion.id, number: criterion.number, chapter: criterion.chapter })
    .from(criterion)
    .where(eq(criterion.standardVersionId, ACTIVE_STANDARD_VERSION))
    .orderBy(criterion.sortOrder);
  const known = new Set(catalogRows.map((c) => c.number));
  for (const nr of Object.keys(OVERRIDES)) {
    if (!known.has(nr)) throw new Error(`Kriterium ${nr} fehlt im Katalog (Story-Schritt nicht ausführbar)`);
  }
  const today = zurichDate(now);
  for (const c of catalogRows) {
    const o = OVERRIDES[c.number];
    const status = o?.status ?? CHAPTER_DEFAULT[c.chapter];
    if (!status) continue;
    await setAssessmentStatus(ctx, c.id, status);
    if (o?.dueInDays !== undefined) {
      await db
        .update(criterionAssessment)
        .set({ dueDate: addDays(today, o.dueInDays) })
        .where(and(eq(criterionAssessment.organizationId, org.id), eq(criterionAssessment.criterionId, c.id)));
    }
  }
  await db.insert(deadline).values([
    { organizationId: org.id, kind: "application", label: "Antrag einreichen", dueDate: addDays(today, 20) },
    { organizationId: org.id, kind: "custom", label: "Besuchstermin der Expertinnen und Experten", dueDate: addDays(today, 60) },
    { organizationId: org.id, kind: "dossier", label: "Vollständiges Dossier abgeben", dueDate: addDays(today, 95) },
    { organizationId: org.id, kind: "expiry", label: "Ablauf der Anerkennung", dueDate: addDays(today, 640) },
  ]);
```

Imports ergänzen: `criterionAssessment`, `deadline` aus `@/db/schema`; `addDays`, `zurichDate` aus `@/domain/dates`. Der bestehende Test «leaves a story» bleibt gültig (7.3.10 kritisch und Pflicht, Kapitel Ergebnis unbewertet); die bisherige Story-Konstante und ihre Schleife entfallen komplett. Die Prüfung, dass die Overrides im Katalog existieren, bleibt laut («fehlt im Katalog», wie bisher).

- [ ] **Step 3: Tests, Seed gegen qm_dev, Commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: alles grün.

Run: `pnpm seed:demo -- --yes-reset` und `docker compose exec db psql -U qm -d qm_dev -c "select status, count(*) from criterion_assessment group by 1 order by 1"`
Expected: Verteilung mit `met` als grösstem Block, 2 `critical`, 4 `open`, 1 `not_applicable`.

```bash
git add qm/ && git commit -m "feat(qm): extend demo seed with chapter-based story, dated criticals and deadlines"
```

---

### Task 6: Dashboard-UI mit Navigation

**Files:**
- Create: `qm/src/domain/role-labels.ts`, `qm/src/components/app-nav.tsx`, `qm/src/components/dashboard/readiness-hero.tsx`, `qm/src/components/dashboard/action-center.tsx`, `qm/src/components/dashboard/deadline-list.tsx`, `qm/src/components/dashboard/chapter-progress.tsx`, `qm/src/app/(app)/page.tsx`
- Modify: `qm/src/app/(app)/layout.tsx`, `qm/src/app/login/login-form.tsx`, `qm/src/proxy.ts`, `qm/src/app/globals.css` (nur falls ein Token fehlt)
- Delete: `qm/src/app/page.tsx`

**Interfaces:**
- Consumes: `getDashboard`, `ACTION_CENTER_LIMIT`, `readinessSummary`, `formatDate`, `BRAND`, `requireOrgContextOrRedirect`.
- Produces: Route `/` (Dashboard); Layout mit linker Navigation (Übersicht, Kriterien) und Organisationskopf.

Vor dem ersten `.tsx`: `qm/DESIGN.md` existiert (Design-Gate erfüllt). Vor UI-Code `impeccable:impeccable` versuchen (Fallback `frontend-design:frontend-design`), sonst nach Plan und `DESIGN.md` arbeiten. Farben nur über Tokens (`text-critical`, `text-warning`, `text-success`, `bg-surface`, `border-border`, `text-text-muted` usw.), keine Hex-Werte, keine Em-Dashes, Status immer mit Textlabel. Dynamische Daten stehen in Komponenten hinter `<Suspense>` (Cache Components).

- [ ] **Step 1: Rollenlabels**

Create `qm/src/domain/role-labels.ts`:

```ts
import type { Role } from "./rights";

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Inhaber",
  qm_admin: "QM-Verantwortliche",
  reviewer: "Reviewer",
  editor: "Bearbeitung",
  viewer: "Lesezugriff",
};
```

- [ ] **Step 2: Navigation**

Create `qm/src/components/app-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Übersicht" },
  { href: "/criteria", label: "Kriterien" },
] as const;

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Hauptnavigation" className="flex flex-col gap-1">
      {ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-[var(--radius)] px-3 py-2 ${
              active ? "bg-primary-subtle font-medium text-primary" : "text-text-muted hover:text-text"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Layout mit Sidebar**

`qm/src/app/(app)/layout.tsx` ersetzt `Shell` durch ein zweispaltiges Layout (Sidebar links ab `md`, darüber ein kompakter Kopf auf schmalen Bildschirmen). Die Suspense-Struktur und `requireOrgContextOrRedirect()` bleiben:

```tsx
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { AppNav } from "@/components/app-nav";
import { BRAND } from "@/brand";
import { db } from "@/db";
import { organization } from "@/db/schema";
import { requireOrgContextOrRedirect } from "@/domain/request-context";
import { ROLE_LABEL } from "@/domain/role-labels";

async function Shell({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContextOrRedirect();
  const [org] = await db.select().from(organization).where(eq(organization.id, ctx.organizationId));
  return (
    <div className="min-h-screen md:grid md:grid-cols-[14rem_1fr]">
      <aside className="flex flex-col gap-6 border-b border-border bg-sidebar px-4 py-4 md:border-b-0 md:border-r">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted">{BRAND.name}</p>
          <p className="font-semibold">{org?.name}</p>
          <p className="text-text-muted">{ROLE_LABEL[ctx.role]}</p>
        </div>
        <AppNav />
      </aside>
      <div className="px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-8">{children}</div>
      </div>
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
```

- [ ] **Step 4: Readiness-Hero**

Create `qm/src/components/dashboard/readiness-hero.tsx`:

```tsx
import type { DashboardData } from "@/domain/dashboard";
import { readinessSummary, type ReadinessStatus } from "@/domain/readiness";

const LABEL: Record<ReadinessStatus, string> = {
  ready: "Bereit",
  action_needed: "Handlungsbedarf",
  critical: "Kritisch",
  not_assessed: "Nicht bewertet",
};

const TONE: Record<ReadinessStatus, string> = {
  ready: "text-success",
  action_needed: "text-warning",
  critical: "text-critical",
  not_assessed: "text-text-muted",
};

export function ReadinessHero({ data }: { data: DashboardData }) {
  const r = data.readiness;
  const open = r.mandatory.open + r.mandatory.notAssessed;
  return (
    <section aria-labelledby="readiness-heading" className="flex flex-col gap-4">
      <h2 id="readiness-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        Readiness
      </h2>
      <div>
        <p className={`text-3xl font-semibold ${TONE[r.status]}`}>{LABEL[r.status]}</p>
        <p className="mt-1">{readinessSummary(r)}</p>
        {!r.basisValidated && (
          <p className="mt-1 text-text-muted">
            Interne Arbeitsbewertung auf Basis eines nicht validierten Katalogs (Entwurf). Keine Entscheidung des IVR.
          </p>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 border-t border-border pt-4 sm:grid-cols-3">
        <div>
          <dt className="text-text-muted">Dokumentationsstand</dt>
          <dd className="text-2xl font-semibold">{r.progressPercent === null ? "k. A." : `${r.progressPercent} %`}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Kriterien erfüllt</dt>
          <dd className="text-2xl font-semibold">{r.met} / {r.applicable}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Bis Ablauf der Anerkennung</dt>
          <dd className="text-2xl font-semibold">
            {data.monthsToExpiry === null ? "k. A." : `${data.monthsToExpiry} Monate`}
          </dd>
        </div>
      </dl>
      <ul className="flex flex-wrap gap-x-8 gap-y-2 border-t border-border pt-4">
        <li><span className="font-semibold text-critical">Kritisch {r.mandatory.critical}</span></li>
        <li><span className="font-semibold text-warning">Offen {open}</span></li>
        <li><span className="font-semibold">Fällig in 30 Tagen {data.soonCount}</span></li>
      </ul>
    </section>
  );
}
```

- [ ] **Step 5: Action Center**

Create `qm/src/components/dashboard/action-center.tsx`:

```tsx
import Link from "next/link";
import type { ActionItem, ActionPriority } from "@/domain/dashboard";
import { formatDate } from "@/domain/dates";

const PRIORITY_LABEL: Record<ActionPriority, string> = { critical: "Kritisch", high: "Hoch", medium: "Mittel" };
const PRIORITY_TONE: Record<ActionPriority, string> = {
  critical: "text-critical",
  high: "text-warning",
  medium: "text-text-muted",
};

export function ActionCenter({ items, total }: { items: ActionItem[]; total: number }) {
  return (
    <section aria-labelledby="actions-heading" className="flex flex-col gap-3">
      <h2 id="actions-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        Braucht Aufmerksamkeit
      </h2>
      {items.length === 0 ? (
        <p className="text-text-muted">Aktuell gibt es nichts, das Aufmerksamkeit braucht.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Offene Punkte nach Priorität</caption>
            <thead className="bg-surface-subtle text-text-muted">
              <tr>
                <th scope="col" className="whitespace-nowrap px-3 py-2">Priorität</th>
                <th scope="col" className="px-3 py-2">Thema</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2">Fällig</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2">Stand</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.key} className="border-t border-border">
                  <td className={`whitespace-nowrap px-3 py-2 font-medium ${PRIORITY_TONE[i.priority]}`}>
                    {PRIORITY_LABEL[i.priority]}
                  </td>
                  <td className="px-3 py-2">{i.topic}</td>
                  <td className="whitespace-nowrap px-3 py-2">{i.dueDate ? formatDate(i.dueDate) : "ohne Frist"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{i.statusLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > items.length && (
        <p className="text-text-muted">
          {items.length} von {total} Punkten.{" "}
          <Link href="/criteria" className="text-primary underline">Alle Kriterien ansehen</Link>
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Fristen und Kapitelfortschritt**

Create `qm/src/components/dashboard/deadline-list.tsx`:

```tsx
import type { DeadlineView } from "@/domain/deadlines";
import { formatDate } from "@/domain/dates";

function relative(d: DeadlineView): string {
  if (d.days < 0) return `seit ${-d.days} ${-d.days === 1 ? "Tag" : "Tagen"} überfällig`;
  if (d.days === 0) return "heute";
  return `in ${d.days} ${d.days === 1 ? "Tag" : "Tagen"}`;
}

const TONE = { overdue: "text-critical", soon: "text-warning", upcoming: "text-text-muted" } as const;

export function DeadlineList({ deadlines }: { deadlines: DeadlineView[] }) {
  return (
    <section aria-labelledby="deadlines-heading" className="flex flex-col gap-3">
      <h2 id="deadlines-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">Fristen</h2>
      {deadlines.length === 0 ? (
        <p className="text-text-muted">Keine Fristen erfasst.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Fristen in zeitlicher Reihenfolge</caption>
            <thead className="bg-surface-subtle text-text-muted">
              <tr>
                <th scope="col" className="whitespace-nowrap px-3 py-2">Datum</th>
                <th scope="col" className="px-3 py-2">Frist</th>
                <th scope="col" className="whitespace-nowrap px-3 py-2">Abstand</th>
              </tr>
            </thead>
            <tbody>
              {deadlines.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{formatDate(d.dueDate)}</td>
                  <td className="px-3 py-2">{d.label}</td>
                  <td className={`whitespace-nowrap px-3 py-2 font-medium ${TONE[d.urgency]}`}>{relative(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
```

Create `qm/src/components/dashboard/chapter-progress.tsx`:

```tsx
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
```

- [ ] **Step 7: Seite, Proxy, Login-Ziel, alte Startseite entfernen**

Create `qm/src/app/(app)/page.tsx`:

```tsx
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
```

- `qm/src/app/page.tsx` löschen (`git rm`), sonst kollidiert es mit `(app)/page.tsx`.
- `qm/src/proxy.ts`: `export const config = { matcher: ["/", "/criteria/:path*"] };`
- `qm/src/app/login/login-form.tsx`: Ziel nach erfolgreichem Login `router.push("/")` statt `"/criteria"`.

- [ ] **Step 8: Verifikation**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: alles grün (der Build läuft auch ohne `.env`).

Danach `pnpm seed:demo -- --yes-reset` und Dev-Server auf Port 3100 mit `BETTER_AUTH_URL=http://localhost:3100 pnpm exec next dev -p 3100`. Per `curl` (Anmeldung über `POST /api/auth/sign-in/email`, Cookie mitsenden):
1. `GET /` ohne Cookie: Weiterleitung auf `/login`.
2. `GET /` als `owner@demo.qm.test`: HTML enthält «Kritisch», «Interne Arbeitsbewertung», «Braucht Aufmerksamkeit», «Fristen», «7.3.10» und «6.3.2».
3. Als `viewer@demo.qm.test` ebenfalls 200.
4. Dev-Log: kein `uncached data`-Fehler.
Server beenden. Den visuellen Check (Screenshots Light und Dark) macht der Controller selbst; Agenten machen keine Screenshots.

- [ ] **Step 9: Quality-Gate und Commit**

Run: `python3 ~/.claude/scripts/quality-gate.py "/Users/henrik/Documents/VS Code/thomato/qm"`
Expected: Exit 0.

```bash
git add qm/ && git commit -m "feat(qm): add readiness dashboard with action center, deadlines and chapter progress"
```

---

## Abschluss Plan 2 (Definition of Done)

- `pnpm test`, `typecheck`, `lint`, `build` grün, Build auch ohne `.env`.
- Startseite zeigt Readiness (qualitativ), Dokumentationsstand (separat), Action Center, Fristen und Kapitelfortschritt aus persistierten Daten; im Seed hoher Fortschritt bei Status «Kritisch».
- Cross-Tenant-Test für Dashboard und Fristen grün; Audit-Log nur `owner` und `qm_admin`.
- Nichts gepusht ohne Freigabe.

## Self-Review (vom Plan-Autor durchgeführt)

- **Spec-Abdeckung:** Layout-Reihenfolge (Readiness, Action Center, Fristen, Fortschritt) in Task 6, qualitativ vs. quantitativ in Task 3 und 6, Audit-Vorgabe in Task 1, Cross-Tenant in Task 2 und 4, Zeitzone in Task 2. Details-Drill-down, Qualitätskreisläufe und Handbuch-Hinweise folgen in den Plänen 3 und 4 (Kriterium-Detail, Nachweise, Massnahmen).
- **Platzhalter-Scan:** keine. Bewusste Vereinfachungen sind benannt (Verfahren als Konstante, Fristen nur lesend).
- **Typkonsistenz:** `AssessmentRow` (Task 4) wird in `dashboard.ts`, in den Tests und im Seed mit denselben Feldern benutzt; `DeadlineView` (Task 2) in Task 4 und 6; `ReadinessResult.mandatory.*` in Task 3, 4 und 6; `ACTION_CENTER_LIMIT` in Task 4 und 6.
- **Bekannte Lücke:** Die Fristen sind in Plan 2 nur über den Seed befüllbar (keine Erfassungsmaske). Das gehört zu Plan 4 (Massnahmen und Fristen mit Schreibrechten).
