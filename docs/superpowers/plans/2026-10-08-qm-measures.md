# QM Massnahmen Implementation Plan (Plan 4b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zu einem Kriterium können konkrete Massnahmen gepflegt werden (Titel, Beschreibung, Verantwortliche Person, Frist, Status, Erledigung). Sie sind persistent, mandantengetrennt, auditiert und wirken auf Dashboard und Action Center, ohne die Readiness-Regel zu verändern.

**Architecture:** Neue Tabelle `measure` (organisationsgebunden, zusammengesetzter Fremdschlüssel auf das Kriterium, CHECK für Status und Erledigungsdatum), Service im Muster der bisherigen (assertCan, Validierung, `withAudit`, Zeilensperre), Integration in `buildActionItems` und `getDashboard`, Sektion «Massnahmen» auf der Kriteriumsseite mit Server Actions.

**Tech Stack:** Wie Plan 4 (Next.js 16 Cache Components, Drizzle, Better Auth, Vitest gegen echtes Postgres, Zod, pnpm).

**Spec:** `docs/implementation/BUILD_PLAN_TO_2026-11-17.md`, Plan 4 (`2026-10-08-qm-evidence-documents.md`, Audit-Konvention `criterionNumbers`), Nachtauftrag 2026-10-08 (Abschnitt 7 und 8).

## Global Constraints

- Alle Constraints aus Plan 1 bis 4 gelten weiter (pnpm, kein `any`, kein `db:push`, `organization_id NOT NULL`, Rechte nur aus `src/domain/rights.ts`, kein Produktnamen-Literal ausser `src/brand.ts`, Tokens statt Hex, keine Em-Dashes auch nicht in UI-Texten, Conventional Commits, Client-Komponenten ohne Wert-Imports aus `@/db`, `@/db/schema`, `@/domain/*` ausser reinen Modulen).
- **Rulings (R31 bis R34):**
  - R31: Status einer Massnahme: `open`, `in_progress`, `done`. `done` setzt `completed_at` (serverseitig, `now`), jeder andere Status löscht es. Die Datenbank erzwingt das per CHECK. Es gibt kein Löschen (Nachvollziehbarkeit); fälschlich angelegte Massnahmen bleiben mit Status «Erledigt» und Beschreibung sichtbar, ein Abbruchstatus entfällt (YAGNI).
  - R32: Verantwortliche Person = Mitglied der eigenen Organisation (`owner_user_id`, im Service gegen `member` der Organisation geprüft, Select im Formular). Frist ist Pflicht (Datum, nicht in der Vergangenheit beim Anlegen? Vergangene Fristen sind erlaubt, weil Altlasten erfasst werden; die Oberfläche zeigt «überfällig»).
  - R33: Massnahmen verändern Readiness und Bewertungsstand nie. Sie erscheinen im Action Center: überfällig (Frist vor heute, Status nicht `done`) mit Priorität hoch und «Massnahme überfällig (seit N Tagen)», fällig innerhalb von 30 Tagen mit Priorität mittel und «Massnahme fällig in N Tagen»; weiter entfernte und erledigte Massnahmen erscheinen nicht. Das Dashboard zeigt die Zähler «Offene Massnahmen» und «Überfällige Massnahmen».
  - R34: Massnahmen-Events tragen `criterionNumbers: [nummer]` im Payload, damit die Kriterien-Historie sie anzeigt (gleiche Konvention wie Nachweise). Eventtypen: `measure.created`, `measure.updated`, `measure.status_changed`.
- Titel 3 bis 120 Zeichen (Codepunkte nach Trim), Beschreibung höchstens 1000 Zeichen (optional), Frist gültiges ISO-Datum.
- Rollen: `document`/`assessment` bleiben unberührt; für Massnahmen gilt `measure.read` (alle Rollen) und `measure.write` (owner, qm_admin, reviewer, editor); `viewer` nur lesen.

## Review Focus

1. Organisation B kann Massnahmen von A weder lesen, ändern noch den Status ändern, auch nicht mit fremder `measureId` (Task 1, 3).
2. `done` setzt `completed_at`, jeder andere Status löscht es; die Datenbank lehnt Widersprüche ab (Task 1).
3. Als Verantwortliche kommen nur Mitglieder der eigenen Organisation in Frage; ein fremder User wird abgelehnt (Task 1).
4. Eine überfällige Massnahme ändert die Readiness nicht (Task 2).
5. Zwei gleichzeitige Statusänderungen erzeugen konsistente Audit-Ketten (Task 1).

## File Structure

```
qm/
  drizzle/0008_*.sql                                   Tabelle measure, CHECKs
  src/db/schema/domain.ts                              + MEASURE_STATUSES, measure
  src/domain/measures.ts                               Services (anlegen, ändern, Status, lesen, Mitglieder)
  src/domain/dashboard.ts                              measure-Items, Zähler, soonCount
  src/domain/audit-copy.ts                             + Texte measure.*
  src/components/criteria/status-copy.ts               + MEASURE_STATUS_LABEL
  src/components/dashboard/readiness-hero.tsx          + Massnahmen-Zähler
  src/app/(app)/criteria/[number]/measures-section.tsx Server: Tabelle
  src/app/(app)/criteria/[number]/measure-forms.tsx    Client: anlegen, ändern, Status
  src/app/(app)/criteria/[number]/measure-actions.ts   Server Actions
  src/app/(app)/criteria/[number]/measure-input.ts     Zod-Schemas (rein)
  src/seed/demo.ts                                     Demo-Massnahmen
```

---

### Task 1: Schema und Massnahmen-Services

**Files:**
- Modify: `qm/src/db/schema/domain.ts`, `qm/src/domain/audit-copy.ts`
- Create: `qm/drizzle/0008_*.sql` (generiert), `qm/src/domain/measures.ts`
- Test: `qm/src/domain/measures.test.ts`, `qm/src/domain/audit-copy.test.ts` (Fälle ergänzen), `qm/src/db/measure-schema.test.ts`

**Interfaces:**
- Produces:
  - `MEASURE_STATUSES = ["open", "in_progress", "done"] as const`, `type MeasureStatus`, Tabelle `measure` (`id`, `organizationId`, `standardVersionId`, `criterionNumber`, `title`, `description`, `ownerUserId`, `dueDate`, `status`, `completedAt`, `createdBy`, `createdAt`, `updatedAt`).
  - `createMeasure(ctx, input: { criterionNumber: string; title: string; description: string | null; ownerUserId: string; dueDate: string }): Promise<{ id: string }>`
  - `updateMeasure(ctx, id: string, input: { title: string; description: string | null; ownerUserId: string; dueDate: string }): Promise<void>`
  - `setMeasureStatus(ctx, id: string, status: MeasureStatus, now: Date): Promise<{ status: MeasureStatus; completedAt: Date | null }>`
  - `type MeasureView = { id: string; criterionNumber: string; title: string; description: string | null; ownerUserId: string; ownerName: string | null; dueDate: string; status: MeasureStatus; completedAt: Date | null; createdAt: Date; days: number; overdue: boolean }`
  - `listCriterionMeasures(ctx, number: string, now: Date): Promise<MeasureView[]>`, `listOpenMeasures(ctx, now: Date): Promise<MeasureView[]>` (alle nicht erledigten, für das Dashboard), `listOrgMembers(ctx): Promise<{ userId: string; name: string }[]>`.

Audit-Payloads (verbindlich, R34): `measure.created`: `before: null`, `after: { title, description, ownerUserId, ownerName, dueDate, status: "open", criterionNumbers: [n] }`; `measure.updated`: `before`/`after` mit denselben Feldern (nur die vier änderbaren plus `criterionNumbers`); `measure.status_changed`: `before: { status, completedAt, title, criterionNumbers }`, `after: { status, completedAt, title, criterionNumbers }`. Titel stehen im Payload, damit die Historie lesbar bleibt, auch wenn später ein Titel geändert wird.

- [ ] **Step 1: Failing tests**

Create `qm/src/domain/measures.test.ts` (vollständig, im Stil von `documents.test.ts`; `setup()` importiert einen Katalog mit `7.3.10` und `6.3.2`, legt Organisationen `mea-a` und `mea-b` an und fügt über `addMemberTo` ein zweites Mitglied `Kollegin` zu A hinzu):

Gruppen und Fälle:
1. `createMeasure` legt Massnahme mit Status `open`, `completedAt` null und genau einem Audit-Event `measure.created` an; der Payload enthält `criterionNumbers: ["7.3.10"]` und `ownerName`; `listCriterionMeasures` liefert sie mit `days` und `overdue` (Frist gestern: `overdue === true`; Frist heute: `overdue === false`; Zeitzone Zürich über `zurichDate(now)` bzw. `daysUntil`).
2. Ablehnung ohne Schreiben und ohne Audit-Event (jeweils `ValidationError`): Titel mit 2 Zeichen, Titel mit 121 Zeichen, Beschreibung mit 1001 Zeichen, Frist `2026-02-30` und `""`, unbekannte Kriteriennummer `9.9.9`, `ownerUserId` eines Nutzers, der nicht Mitglied der Organisation ist (auch ein Mitglied der Organisation B), `ownerUserId` keine UUID bzw. unbekannt.
3. `viewer` darf lesen (`listCriterionMeasures`, `listOpenMeasures`, `listOrgMembers`), aber nicht anlegen, ändern oder den Status setzen (`ForbiddenError`).
4. `setMeasureStatus`: `open` zu `in_progress` (completedAt null), zu `done` (completedAt = `now`), zurück zu `open` (completedAt null); jeder Schritt schreibt `measure.status_changed` mit richtigem before/after; gleicher Status erneut setzen schreibt kein Event und ändert nichts (No-op); Status ausserhalb der Liste wird abgelehnt.
5. `updateMeasure` ändert Titel/Beschreibung/Verantwortliche/Frist, schreibt `measure.updated` mit before/after und lässt Status und `completedAt` unberührt; ein unveränderter Aufruf schreibt kein Event.
6. Mandanten: Organisation B sieht keine Massnahme von A in `listCriterionMeasures`/`listOpenMeasures`; `updateMeasure(ctxB, idVonA, ...)` und `setMeasureStatus(ctxB, idVonA, ...)` werfen `ValidationError("Massnahme nicht gefunden.")` (gleiche Meldung wie für unbekannte IDs, auch für Nicht-UUIDs) und ändern nichts; `listOrgMembers(ctxB)` enthält keinen Nutzer von A.
7. Nebenläufigkeit: `Promise.all([setMeasureStatus(ctxA, id, "in_progress", NOW), setMeasureStatus(ctxA, id, "done", NOW)])` auf einer offenen Massnahme (mehrere Runden): genau zwei Events, genau eines hat `before.status === "open"`, das andere hat als `before` den `after`-Stand des ersten, die Endzeile ist konsistent (`done` mit `completedAt` oder `in_progress` ohne), nie `done` ohne Datum.
8. Keine Seiteneffekte: Eine Massnahme verändert `criterion_assessment` nie (Zeile bleibt unberührt bzw. nicht vorhanden).

Create `qm/src/db/measure-schema.test.ts`: (a) direkter Insert mit `status = 'done'` und `completed_at` NULL wird von der Datenbank abgelehnt (Constraint-Name `measure_status_completed_check`), (b) `status = 'open'` mit gesetztem `completed_at` abgelehnt, (c) unbekannter Status abgelehnt (`measure_status_check` oder Enum), (d) Insert mit einer Kriteriennummer, die nicht existiert, abgelehnt (`foreign key`), (e) Insert mit `organization_id`, das zu keiner Organisation gehört, abgelehnt, (f) gültiger Insert erfolgreich.

Ergänze `audit-copy.test.ts`:

```ts
  it("describes measure events", () => {
    const base = { title: "Hygieneschulung planen", criterionNumbers: ["7.3.10"] };
    expect(describeAuditEvent({ eventType: "measure.created", before: null, after: { ...base, ownerName: "Demo editor", dueDate: "2026-11-15", status: "open" } }))
      .toBe("Massnahme «Hygieneschulung planen» angelegt (verantwortlich: Demo editor, Frist 15.11.2026)");
    expect(describeAuditEvent({ eventType: "measure.status_changed", before: { ...base, status: "open", completedAt: null }, after: { ...base, status: "done", completedAt: "2026-10-08T10:00:00.000Z" } }))
      .toBe("Massnahme «Hygieneschulung planen»: Status von «Offen» zu «Erledigt»");
    expect(describeAuditEvent({ eventType: "measure.updated", before: { ...base, ownerName: "A", dueDate: "2026-11-15", description: null }, after: { ...base, ownerName: "B", dueDate: "2026-12-01", description: null } }))
      .toBe("Massnahme «Hygieneschulung planen» geändert (verantwortlich: A zu B, Frist 15.11.2026 zu 01.12.2026)");
    expect(describeAuditEvent({ eventType: "measure.status_changed", before: 1, after: null })).toBe("measure.status_changed");
  });
```

Run: `pnpm test`
Expected: FAIL.

- [ ] **Step 2: Schema und Migration**

In `qm/src/db/schema/domain.ts` (Importe `check` ergänzen, falls nicht vorhanden):

```ts
export const MEASURE_STATUSES = ["open", "in_progress", "done"] as const;
export type MeasureStatus = (typeof MEASURE_STATUSES)[number];

export const measure = pgTable(
  "measure",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id),
    standardVersionId: text("standard_version_id").notNull(),
    criterionNumber: text("criterion_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id),
    dueDate: date("due_date").notNull(),
    status: text("status", { enum: MEASURE_STATUSES }).notNull().default("open"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "measure_criterion_fk",
      columns: [t.standardVersionId, t.criterionNumber],
      foreignColumns: [criterion.standardVersionId, criterion.number],
    }),
    check("measure_status_check", sql`${t.status} in ('open', 'in_progress', 'done')`),
    check(
      "measure_status_completed_check",
      sql`(${t.status} = 'done' AND ${t.completedAt} IS NOT NULL) OR (${t.status} <> 'done' AND ${t.completedAt} IS NULL)`,
    ),
    index("measure_org_criterion_idx").on(t.organizationId, t.criterionNumber),
    index("measure_org_due_idx").on(t.organizationId, t.dueDate),
  ],
);
```

(`sql` aus `drizzle-orm` importieren, falls nicht vorhanden.) `pnpm db:generate && pnpm db:migrate`, Migration `0008` committen. `measure` in `TABLES` von `src/test/helpers.ts` und in die `TRUNCATE`-Liste von `src/seed/demo.ts` aufnehmen (vor `audit_event`).

- [ ] **Step 3: Service `measures.ts`**

Verbindliche Eigenschaften (Muster wie `documents.ts`):
1. Jede Funktion: `assertCan(ctx, "measure", "read" | "write")` zuerst, dann Eingabevalidierung (Titel in Codepunkten 3 bis 120 nach Trim, Beschreibung nach Trim höchstens 1000 Codepunkte, leere Beschreibung wird `null`, Frist über `isValidIsoDate`, Status aus `MEASURE_STATUSES`, Kriteriennummer existiert in `ACTIVE_STANDARD_VERSION`, `ownerUserId` ist `member` der eigenen Organisation), dann `withAudit`. Fehler: `ValidationError` mit deutscher Meldung. Fremde, unbekannte und Nicht-UUID-IDs führen zur identischen Meldung «Massnahme nicht gefunden.».
2. `updateMeasure` und `setMeasureStatus`: innerhalb von `withAudit` die Zeile mit `select ... for("update")` laden (gefiltert auf `id` UND `organizationId`), `before` aus der gesperrten Zeile bilden, dann `update` (setzt `updatedAt`). `setMeasureStatus` setzt `completedAt = now` bei `done`, sonst `null`; derselbe Status wie bisher: kein Update, kein Event (der Service gibt den Ist-Zustand zurück). Ein No-op bei `updateMeasure` (alle vier Felder gleich) ebenfalls ohne Event.
3. Lesefunktionen: alle Queries filtern `organizationId`; `ownerName` über `leftJoin` auf `user` (nur `name`); `days`/`overdue` über `daysUntil(dueDate, now)` (überfällig, wenn `days < 0` und Status ungleich `done`); Sortierung: nicht erledigte zuerst nach Frist, dann erledigte nach Erledigungsdatum absteigend. `listOpenMeasures` liefert nur Status `open` und `in_progress`, zusätzlich `criterionTitle` (Join auf `criterion` über Version und Nummer) für das Action Center: Typ `OpenMeasureView = MeasureView & { criterionTitle: string }`.
4. `listOrgMembers(ctx)`: `assertCan(ctx, "measure", "read")`, liefert `{ userId, name }` der Mitglieder der eigenen Organisation, nach Name sortiert (nur diese zwei Felder).
5. Keine Funktion schreibt `criterion_assessment`.
6. `measure` braucht das Recht `measure.write`: in `rights.ts` haben `owner`, `qm_admin`, `reviewer`, `editor` es bereits; `viewer` hat `measure.read`. Falls ein Test das Gegenteil zeigt: melden, nicht anpassen.

- [ ] **Step 4: audit-copy**

In `audit-copy.ts` Zweige für `measure.created`, `measure.updated`, `measure.status_changed` mit exakt den Texten aus dem Test. Status-Wörter: `open` → «Offen», `in_progress` → «In Bearbeitung», `done` → «Erledigt». Fehlende oder falsch geformte Payloads fallen auf den Eventtyp zurück.

- [ ] **Step 5: Tests, Typecheck, Commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: alles grün; `measures.test.ts` mehrfach laufen lassen (Nebenläufigkeit).

```bash
git add qm/ && git commit -m "feat(qm): add tenant-scoped measures with status, locking and audit"
```

---

### Task 2: Dashboard und Action Center kennen Massnahmen

**Files:**
- Modify: `qm/src/domain/dashboard.ts`, `qm/src/components/dashboard/readiness-hero.tsx`, `qm/src/components/criteria/status-copy.ts`
- Test: `qm/src/domain/dashboard.test.ts` (Fälle ergänzen)

**Interfaces:**
- Produces: `ActionItem.source` zusätzlich `"measure"`; `buildActionItems(criteria, deadlines, evidence, measures: readonly OpenMeasureView[], mode, now)` (neues Argument; bestehende Aufrufer erhalten `[]`); `DashboardData.measures: { open: number; overdue: number }`; `MEASURE_STATUS_LABEL = { open: "Offen", in_progress: "In Bearbeitung", done: "Erledigt" }` (client-sicher).

Regeln (R33): Pro Massnahme mit Status `open` oder `in_progress`: überfällig (`days < 0`): Item `{ priority: "high", statusLabel: "Massnahme überfällig (seit N Tagen)" (Dativ, 1 Tag), dueDate, topic: "<Titel> (<Nummer> <Kriterientitel>)", href: "/criteria/<nummer>", source: "measure" }`; fällig innerhalb von `SOON_DAYS` (`0 <= days <= 30`): `priority: "medium"`, `statusLabel: "Massnahme fällig in N Tagen"` bzw. «heute»; alles Weitere erscheint nicht. `soonCount` zählt Kriterien-, Fristen- UND Massnahmen-Items mit Fälligkeit innerhalb von 30 Tagen oder überfällig, weiterhin NICHT Nachweis-Items. Zähler: `open` = Anzahl nicht erledigter Massnahmen, `overdue` = davon überfällig. Die Readiness bleibt unverändert.

- [ ] **Step 1: Failing tests** (reine Tests für `buildActionItems`: überfällig/fällig/zu weit weg/erledigt, Singular, Sortierung hoch vor mittel; Integrationstest `getDashboard`: Massnahmen von A erscheinen nur bei A, Zähler stimmen, Readiness-Status mit und ohne überfällige Massnahme identisch; `soonCount` enthält eine fällige Massnahme und keine Nachweis-Items). Bestehende Aufrufe in Tests erhalten das neue Argument.
- [ ] **Step 2: Implementation** wie oben; `getDashboard` lädt `listOpenMeasures(ctx, now)` parallel; Hero zeigt unter den Nachweiszählern «Offene Massnahmen» und «Überfällige Massnahmen» (Textlabels, überfällig in der kritischen Farbe wenn grösser als 0).
- [ ] **Step 3: Verifikation und Commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: grün.

```bash
git add qm/ && git commit -m "feat(qm): show measures in the action center and dashboard counters without touching readiness"
```

---

### Task 3: Massnahmen auf der Kriteriumsseite

**Files:**
- Create: `qm/src/app/(app)/criteria/[number]/measure-input.ts`, `measure-input.test.ts`, `measure-actions.ts`, `measures-section.tsx`, `measure-forms.tsx`
- Modify: `qm/src/app/(app)/criteria/[number]/page.tsx`

**Interfaces:**
- Produces: Zod-Schemas `createMeasureInput`, `updateMeasureInput`, `statusInput` (rein, testbar), Server Actions `createMeasureAction`, `updateMeasureAction`, `setMeasureStatusAction` (`(prev: MeasureFormState, formData: FormData) => Promise<MeasureFormState>`, `type MeasureFormState = { ok: boolean; message: string } | null`).

Reihenfolge je Action: Zod parse → `requireOrgContextOrRedirect()` → `can(ctx.role, "measure", "write")` sonst Meldung «Keine Berechtigung für diese Änderung.» → Service → `ValidationError`/`ForbiddenError` als Meldung, Rest weiterwerfen → `revalidatePath("/")`, `revalidatePath("/criteria")`, `revalidatePath(`/criteria/${encodeURIComponent(number)}`)` → Erfolgsmeldung («Massnahme angelegt.», «Massnahme gespeichert.», «Status geändert.»). `now` wird in der Action erzeugt (`new Date()`), nicht im Service.

UI (Muster der Bewertungsform: manuelles `onSubmit` mit `preventDefault` und `startTransition`, damit Eingaben nach Fehlern stehen bleiben; immer gerenderte `role="status"`/`role="alert"`-Absätze; keine Wert-Imports aus `@/db`/`@/domain/measures` in Client-Dateien, Mitglieder und Optionen als Props):
- `measures-section.tsx` (Server, in eigener `<Suspense>`-Grenze): Tabelle (Titel mit Beschreibung darunter, Verantwortliche, Frist mit «überfällig»-Textlabel, Status, Erledigt am), je Zeile für Schreibberechtigte ein Statusformular (Auswahl «Offen»/«In Bearbeitung»/«Erledigt» und Button «Status setzen») und `<details>` «Bearbeiten» (Titel, Beschreibung, Verantwortliche, Frist). Darunter für Schreibberechtigte «Massnahme anlegen» (Titel, Beschreibung, Verantwortliche aus den Mitgliedern, Frist). Leerzustand «Für dieses Kriterium gibt es noch keine Massnahme.». Nicht schreibberechtigte Rollen: nur die Tabelle und der Satz «Mit Ihrer Rolle sind Massnahmen schreibgeschützt.».
- `page.tsx`: Sektion unter «Nachweise» (oder unter «Bewertung», falls Nachweise noch fehlen) einbinden; die Historie zeigt die Massnahmen-Events über die bestehende `criterionNumbers`-Abfrage.

- [ ] **Step 1: Failing tests** für `measure-input.ts` (UUIDs, Titel- und Beschreibungsgrenzen, ungültiges Datum, Status-Whitelist, unbekannte Felder werden entfernt, Beschreibung optional).
- [ ] **Step 2: Implementation** (Schemas, Actions, Komponenten).
- [ ] **Step 3: Verifikation** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, dann Browser (Headless-Chromium, scrapling-venv; Vorlage im Scratchpad: `detail.py`): als `owner` auf `/criteria/6.3.2` eine Massnahme mit Frist in 10 Tagen anlegen (Meldung «Massnahme angelegt.», Zeile sichtbar, Verantwortliche gewählt), Dashboard zeigt «Offene Massnahmen» plus Action-Center-Zeile «Massnahme fällig in 10 Tagen» und die Readiness bleibt «Kritisch»; Status auf «Erledigt» setzen: Zeile verschwindet aus dem Action Center, «Erledigt am» steht in der Tabelle, Historie zeigt beide Ereignisse; ungültige Frist und zu kurzer Titel: Fehlermeldung, Eingaben bleiben stehen; `viewer`: Tabelle ohne Formulare; Konsole leer; Dev-Log ohne `uncached data` und Hydration-Meldungen.

```bash
git add qm/ && git commit -m "feat(qm): add measures section with audited create, edit and status forms"
```

---

### Task 4: Demo-Massnahmen im Seed

**Files:**
- Modify: `qm/src/seed/demo.ts`, `qm/src/seed/demo.test.ts`

Seed-Massnahmen (alle über `createMeasure`/`setMeasureStatus`, auditiert; Verantwortliche = Demo-Nutzer; Fristen relativ zu `now`; Texte synthetisch mit «(Demo)»):

| Kriterium | Massnahme | Verantwortlich | Frist | Status |
|---|---|---|---|---|
| 7.3.10 | Hygienekonzept überarbeiten und neu freigeben (Demo) | `qm_admin` | `heute + 12` | `in_progress` |
| 6.3.2 | Statusmeldungen an die SNZ 144 technisch sicherstellen (Demo) | `editor` | `heute + 25` | `open` |
| 7.3.8 | Wartungsplan für Fahrzeuge vervollständigen (Demo) | `reviewer` | `heute - 4` | `open` (überfällig) |
| 5.2.2 | Organigramm aktualisiert (Demo) | `owner` | `heute - 30` | `done` |

Test (zu `demo.test.ts`, fester `NOW`): `dash.measures` ergibt `open: 3, overdue: 1`; das Action Center enthält «Massnahme überfällig (seit 4 Tagen)» zu 7.3.8 und «Massnahme fällig in 12 Tagen» zu 7.3.10; die Readiness bleibt `critical` mit genau zwei kritischen Pflichtkriterien; die erledigte Massnahme erscheint nicht im Action Center; `listCriterionMeasures(ctx, "7.3.10", NOW)` liefert die Massnahme mit Verantwortlicher.

- [ ] **Step 1: Test schreiben und fehlschlagen sehen, Step 2: Seed ergänzen, Step 3: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`, `pnpm seed:demo -- --yes-reset`, Commit**

```bash
git add qm/ && git commit -m "feat(qm): seed demo measures with owners, due dates and one overdue item"
```

---

## Abschluss Plan 4b (Definition of Done)

- `pnpm test`, `typecheck`, `lint`, `build` grün; Migration `0008` auf frischer Datenbank anwendbar.
- Massnahmen sind persistent, mandantengetrennt, auditiert und in der Kriterien-Historie sichtbar; Status und Erledigungsdatum sind auch in der Datenbank konsistent erzwungen.
- Dashboard und Action Center zeigen überfällige und fällige Massnahmen und Zähler; die Readiness bleibt unverändert.
- Browserpfad belegt (anlegen, Status, Historie, Rollen).
- Nichts nach `main` gemerged.

## Self-Review (vom Plan-Autor durchgeführt)

- **Spec-Abdeckung:** Nachtauftrag Abschnitt 7 (Titel/Beschreibung, Verantwortlichkeit, Frist, Status, Erledigung, Zugehörigkeit zu einem Kriterium, offen/in Bearbeitung/erledigt) in Task 1 bis 3; Abschnitt 8 (reale persistente Daten, fällige und überfällige Massnahmen, Readiness unberührt) in Task 2 und 4.
- **Platzhalter-Scan:** keine. Services und Aktionen sind über verbindliche Eigenschaften plus vollständige Testfälle spezifiziert, Schema und Texte sind ausformuliert.
- **Typkonsistenz:** `MeasureView`/`OpenMeasureView` (Task 1) in Task 2 und 3; `MEASURE_STATUS_LABEL` (Task 2) in Task 3; `criterionNumbers` im Payload konsistent mit Plan 4.
- **Bekannte Grenzen:** kein Löschen und kein Abbruchstatus (R31); Verantwortliche nur aus der eigenen Organisation (R32); keine Benachrichtigungen.
