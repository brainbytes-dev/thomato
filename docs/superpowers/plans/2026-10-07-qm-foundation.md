# QM Fundament Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine neue Next.js-App `qm/` mit Better Auth (Organizations und Rollen), Postgres über Drizzle, importiertem Kriterienkatalog, harter Mandantentrennung, atomarem Audit-Log, Demo-Seed und einer eingeloggten Kriterienliste.

**Architecture:** Modularer Monolith in `qm/`. Jede mandantenabhängige Tabelle trägt `organization_id NOT NULL`. Alle Datenzugriffe laufen über Service-Funktionen, die einen `OrgContext` (Organisation, User, Rolle) erhalten und jede Query darauf einschränken. Schreibende Funktionen laufen durch `withAudit`, das Änderung und Audit-Event in derselben Transaktion schreibt.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`), TypeScript strict, Drizzle ORM plus drizzle-kit, `pg`, Better Auth (organization plugin, access control), Zod, Vitest, pnpm, Postgres 17 (Docker lokal, Neon später).

**Spec:** `docs/implementation/BUILD_PLAN_TO_2026-11-17.md` (Entscheidungen E1-E6), Architekturpapier `~/Downloads/IVR_QM_SaaS_Tech_Stack_Architecture.md` (Kapitel 7, 8, 9, 12), Design `~/Downloads/Thomato IVR QM — Design System.md`.

## Global Constraints

- Package manager: pnpm. Kein npm, kein yarn.
- TypeScript: kein `any`. `unknown` plus Narrowing oder ein sauberer Typ.
- Kein `db:push`. Schemaänderungen nur als committed SQL-Migration (`drizzle-kit generate` plus `migrate`).
- `organization_id NOT NULL` auf jeder mandantenabhängigen Domain-Tabelle.
- Rollen exakt: `owner`, `qm_admin`, `reviewer`, `editor`, `viewer`.
- Standardversion bleibt `draft_extracted`. Eine einzelne validierte Regel macht die Version nie `validated`.
- Keine Patientendaten, keine echten Personen in Seeds oder Tests. Demo-Organisation: «Rettungsdienst Musterstadt - Demo».
- Farben nur über Tokens in `globals.css`, nie hartcodiertes Hex in Komponenten.
- Code und Identifier Englisch, UI-Texte Deutsch (Schweizer Schreibweise, echte Umlaute, ss statt ß).
- Keine Em-Dashes im Output. Commits: Conventional Commits, Imperativ, keine Emojis. Autor `BrainBytes <info@brainbyt.es>`.
- `git push` nur nach ausdrücklicher Freigabe von Henrik (Push löst Vercel-Build aus).
- Better-Auth- und Drizzle-APIs ändern sich: Wo ein Schritt eine Signatur annimmt, entscheidet `pnpm typecheck` und die offizielle Doku (better-auth.com/docs, orm.drizzle.team) über die Details. Abweichungen im Commit-Text notieren.

## Review Focus

1. User in Organisation B ruft `listAssessments`/`setAssessmentStatus` auf Kriterien auf, die Organisation A bewertet hat: sieht nur `not_assessed`, ändert nur eigene Zeilen (Task 5).
2. Rolle `viewer` versucht zu schreiben: `ForbiddenError`, keine Zeile, kein Audit-Event (Task 5).
3. Fehler mitten in einer Schreibaktion: weder Änderung noch Audit-Event bleiben stehen (Task 5).
4. Katalog-Import zweimal ausgeführt oder mit kaputter Zeile (fehlende Nummer): idempotent bzw. ganzer Import bricht ab (Task 4).
5. Audit-Event per UPDATE oder DELETE verändern: Datenbank lehnt ab (Task 4).

## File Structure

```
qm/
  package.json, tsconfig.json, next.config.ts      Scaffold
  docker-compose.yml                               Postgres lokal, DBs qm_dev und qm_test
  drizzle.config.ts                                drizzle-kit Konfiguration
  vitest.config.ts, vitest.global-setup.ts         Testlauf, Migration der Test-DB
  DESIGN.md                                        Design-Gate und Token-Referenz
  .env.example                                     Variablen ohne Werte
  drizzle/                                         generierte SQL-Migrationen (committed)
  src/brand.ts                                     Produktname und Tagline, einzige Quelle
  src/db/index.ts                                  Pool, db, Typen Db und Tx
  src/db/schema/auth.ts                            GENERIERT durch Better Auth CLI
  src/db/schema/domain.ts                          standard_version, criterion, criterion_assessment, audit_event
  src/db/schema/index.ts                           Re-Exports
  src/domain/rights.ts                             Rollen-Rechte-Matrix, can()
  src/domain/org-context.ts                        OrgContext, Fehler, assertCan (ohne Next-/Auth-Imports)
  src/domain/request-context.ts                    requireOrgContext (Session, Next headers)
  src/domain/audit.ts                              withAudit, listAuditEvents
  src/domain/catalog.ts                            Zod-Schema und importCatalog
  src/domain/assessments.ts                        listAssessments, setAssessmentStatus
  src/auth/permissions.ts                          Better-Auth-Access-Control aus rights.ts
  src/auth/auth.ts                                 betterAuth Instanz
  src/auth/client.ts                               authClient
  src/app/api/auth/[...all]/route.ts               Better-Auth-Handler
  src/app/login/page.tsx, login-form.tsx           Login
  src/app/(app)/layout.tsx, criteria/page.tsx      geschützter Bereich
  src/proxy.ts                                     Cookie-Check, Redirect auf /login
  src/seed/demo.ts, scripts/seed-demo.ts           Demo-Seed und CLI
  scripts/import-catalog.ts                        CLI für den Katalog-Import
  src/test/helpers.ts                              resetDb, makeUser, makeOrg, ctxFor
```

---

### Task 1: Scaffold, lokale Datenbank, Testlauf, DESIGN.md

**Files:**
- Create: `qm/` (Next-Scaffold), `qm/docker-compose.yml`, `qm/docker/init-test-db.sql`, `qm/.env.example`, `qm/vitest.config.ts`, `qm/DESIGN.md`
- Modify: `qm/package.json` (Scripts)

**Interfaces:**
- Produces: `pnpm test`, `pnpm typecheck`, `pnpm db:generate`, `pnpm db:migrate`; Umgebungsvariablen `DATABASE_URL`, `DATABASE_URL_DIRECT`, `TEST_DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`.

- [ ] **Step 1: Branch und Scaffold**

```bash
cd "/Users/henrik/Documents/VS Code/thomato"
git checkout -b feat/qm-foundation
pnpm create next-app@latest qm --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --yes
cd qm
pnpm add drizzle-orm pg better-auth @better-auth/drizzle-adapter zod
pnpm add -D drizzle-kit @types/pg vitest tsx dotenv
```

Expected: `qm/src/app/page.tsx` existiert, `pnpm build` läuft. Falls `@better-auth/drizzle-adapter` nicht auflösbar ist, den Import später auf `better-auth/adapters/drizzle` umstellen.

- [ ] **Step 2: Postgres lokal**

Create `qm/docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_USER: qm
      POSTGRES_PASSWORD: qm
      POSTGRES_DB: qm_dev
    ports:
      - "5437:5432"
    volumes:
      - qm-pgdata:/var/lib/postgresql/data
      - ./docker/init-test-db.sql:/docker-entrypoint-initdb.d/init-test-db.sql:ro
volumes:
  qm-pgdata:
```

Create `qm/docker/init-test-db.sql`:

```sql
CREATE DATABASE qm_test;
```

Create `qm/.env.example`:

```bash
DATABASE_URL=postgres://qm:qm@localhost:5437/qm_dev
DATABASE_URL_DIRECT=postgres://qm:qm@localhost:5437/qm_dev
TEST_DATABASE_URL=postgres://qm:qm@localhost:5437/qm_test
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
```

```bash
cp .env.example .env
# BETTER_AUTH_SECRET mit `openssl rand -base64 32` füllen
docker compose up -d db
```

Run: `docker compose exec db psql -U qm -c '\l'`
Expected: Liste enthält `qm_dev` und `qm_test`.

- [ ] **Step 3: Scripts**

In `qm/package.json` unter `scripts` ergänzen:

```json
"typecheck": "tsc --noEmit",
"test": "vitest run",
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"seed:demo": "tsx scripts/seed-demo.ts",
"import:catalog": "tsx scripts/import-catalog.ts"
```

- [ ] **Step 3b: Markenname aus einer Quelle**

Der Produktname ist offen (Branding-Runde steht aus). Bis dahin gilt ein neutraler Arbeitstitel, und jeder sichtbare Text liest ihn aus genau einer Datei.

Create `qm/src/brand.ts`:

```ts
export const BRAND = {
  /** Arbeitstitel, bis die Branding-Runde einen Namen liefert. */
  name: "QM Rettungsdienst",
  tagline: "Interne Arbeitsbewertung, keine IVR-Entscheidung.",
} as const;
```

Kein Produktname als Literal in Komponenten, Seed, Mails oder Metadaten. Beim Umbenennen ändert sich nur diese Datei (plus Repo, Domain und `package.json`-Name).

- [ ] **Step 4: Vitest-Konfiguration**

Create `qm/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { config } from "dotenv";
import path from "node:path";

config({ path: ".env" });

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    globalSetup: ["./vitest.global-setup.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      ALLOW_DEMO_RESET: "1",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-1234",
      BETTER_AUTH_URL: "http://localhost:3000",
    },
  },
});
```

`fileParallelism: false`, weil alle Tests dieselbe Test-DB benutzen und sie leeren.

- [ ] **Step 5: DESIGN.md (Gate für UI-Code)**

Create `qm/DESIGN.md`:

```markdown
# QM Design

Quelle: «Thomato IVR QM — Design System» (17.09.2026), verbindlich. Diese Datei hält nur, was Code und Hook brauchen.

## 1. Dials (Vorschlag, von Henrik anzupassen)

- DESIGN_VARIANCE: 0.2
- MOTION_INTENSITY: 0.1
- VISUAL_DENSITY: 0.6

## 2. Richtung

Swiss Clinical Minimalism. Tabellen statt Kartenfriedhof, dezente Linien statt Schatten, Radien 4 bis 7 px, 4/8-px-Raster, System-Sans, linke Desktop-Navigation, `:focus-visible` auf allem Interaktiven.

## 3. Farb-Tokens (Light)

background #EEF2F9, surface #FFFFFF, surface-subtle #F3F6FB, sidebar #F7F9FD, text #050F1E, text-muted #4D5F7D, border #DDE5F0, field-border #8095B3, primary #0052A8, primary-deep #003B7A, primary-subtle #E7EFFB, critical #B3261E, warning #8A5A00, success #1A6B3C, violet #5B46C4.

## 4. Farb-Tokens (Dark)

background #050F1E, surface #0A1830, surface-subtle #102341, sidebar #040C18, text #EEF5FF, text-muted #9DB6D8, primary #3C8CFF, critical #FF9B91, warning #E0B45C, success #76D3A1.

## 5. Regeln

Rot nie als Markenfarbe. Readiness ist ein qualitativer Status, getrennt vom Prozentwert. Nach dem Status folgt «Braucht Aufmerksamkeit». Status immer mit Textlabel, nie nur Farbe. Icons: lucide-react, keine Emojis.
```

- [ ] **Step 6: Leerer Testlauf als Gate**

Create `qm/vitest.global-setup.ts` (Platzhalter-frei, wird in Task 2 erweitert):

```ts
export default async function setup() {}
```

Create `qm/src/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("test runner", () => {
  it("runs against the test database url", () => {
    expect(process.env.DATABASE_URL).toContain("qm_test");
  });
});
```

Run: `pnpm test`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
cd "/Users/henrik/Documents/VS Code/thomato"
git add qm/ docs/
git commit -m "feat(qm): scaffold next app with local postgres and test runner"
```

Hinweis: `git add qm/` nimmt `.env` nicht mit (vom Next-Scaffold per `.env*` ignoriert). Mit `git status` prüfen, dass `.env` nicht gestaged ist.

---

### Task 2: Drizzle-Client und Migrationslauf im Test

**Files:**
- Create: `qm/drizzle.config.ts`, `qm/src/db/index.ts`, `qm/src/db/schema/index.ts`, `qm/src/db/schema/auth.ts` (leer), `qm/src/db/schema/domain.ts` (leer)
- Modify: `qm/vitest.global-setup.ts`
- Test: `qm/src/db/db.test.ts`

**Interfaces:**
- Produces: `db`, `type Db`, `type Tx` aus `@/db`; Schema-Barrel `@/db/schema`.

- [ ] **Step 1: Failing test**

Create `qm/src/db/db.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";

describe("db", () => {
  it("opens a transaction that rolls back on error", async () => {
    await db.execute(sql`CREATE TEMP TABLE t (x int)`).catch(() => undefined);
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(sql`SELECT 1`);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const res = await db.execute(sql`SELECT 1 AS one`);
    expect(res.rows[0]).toEqual({ one: 1 });
  });
});
```

Run: `pnpm test src/db/db.test.ts`
Expected: FAIL, Modul `@/db` nicht gefunden.

- [ ] **Step 2: Client und Config**

Create `qm/src/db/schema/auth.ts`:

```ts
export {};
```

Create `qm/src/db/schema/domain.ts`:

```ts
export {};
```

Create `qm/src/db/schema/index.ts`:

```ts
export * from "./auth";
export * from "./domain";
```

Create `qm/src/db/index.ts`:

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: Pool };

const pool =
  globalForDb.pool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
```

Create `qm/drizzle.config.ts`:

```ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL ?? "",
  },
});
```

- [ ] **Step 3: Migrationen im Global-Setup**

Replace `qm/vitest.global-setup.ts`:

```ts
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "node:path";
import { existsSync } from "node:fs";

config({ path: ".env" });

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL fehlt (siehe .env.example)");
  const folder = path.resolve(__dirname, "drizzle");
  if (!existsSync(path.join(folder, "meta", "_journal.json"))) return;
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: folder });
  } finally {
    await pool.end();
  }
}
```

- [ ] **Step 4: Test grün**

Run: `pnpm test src/db/db.test.ts && pnpm typecheck`
Expected: PASS, kein Typfehler. (Der Eintrag `.catch(() => undefined)` im Test ist harmlos, kann aber entfallen, falls `pnpm lint` ihn bemängelt.)

- [ ] **Step 5: Commit**

```bash
git add qm/ && git commit -m "feat(qm): add drizzle client and migration step for tests"
```

---

### Task 3: Better Auth mit Organizations und Rollen

**Files:**
- Create: `qm/src/domain/rights.ts`, `qm/src/auth/permissions.ts`, `qm/src/auth/auth.ts`, `qm/src/auth/client.ts`, `qm/src/app/api/auth/[...all]/route.ts`
- Replace (generiert): `qm/src/db/schema/auth.ts`
- Create (generiert): `qm/drizzle/0000_*.sql`
- Test: `qm/src/domain/rights.test.ts`, `qm/src/auth/auth.test.ts`

**Interfaces:**
- Produces:
  - `type Role = "owner" | "qm_admin" | "reviewer" | "editor" | "viewer"`
  - `ROLE_RIGHTS: Record<Role, Rights>`, `can(role: Role, resource: Resource, action: string): boolean`
  - `auth` (betterAuth Instanz), `authClient`
  - Schema-Exporte `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`.

- [ ] **Step 1: Failing test für die Rechte-Matrix**

Create `qm/src/domain/rights.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { can } from "./rights";

describe("rights", () => {
  it("viewer reads but never writes", () => {
    expect(can("viewer", "assessment", "read")).toBe(true);
    expect(can("viewer", "assessment", "write")).toBe(false);
  });
  it("editor writes but does not approve", () => {
    expect(can("editor", "assessment", "write")).toBe(true);
    expect(can("editor", "document", "approve")).toBe(false);
  });
  it("reviewer approves", () => {
    expect(can("reviewer", "document", "approve")).toBe(true);
  });
  it("only owner manages the organization", () => {
    expect(can("owner", "organization", "delete")).toBe(true);
    expect(can("qm_admin", "organization", "delete")).toBe(false);
  });
  it("qm_admin manages members", () => {
    expect(can("qm_admin", "member", "update")).toBe(true);
    expect(can("reviewer", "member", "update")).toBe(false);
  });
});
```

Run: `pnpm test src/domain/rights.test.ts`
Expected: FAIL, `./rights` fehlt.

- [ ] **Step 2: Rechte-Matrix (einzige Quelle)**

Create `qm/src/domain/rights.ts`:

```ts
export const ROLES = ["owner", "qm_admin", "reviewer", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export type Rights = Partial<Record<string, readonly string[]>>;

const READ_ALL = {
  assessment: ["read"],
  measure: ["read"],
  document: ["read"],
} as const;

export const ROLE_RIGHTS = {
  owner: {
    organization: ["update", "delete"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    assessment: ["read", "write", "approve"],
    measure: ["read", "write"],
    document: ["read", "write", "approve"],
  },
  qm_admin: {
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    assessment: ["read", "write", "approve"],
    measure: ["read", "write"],
    document: ["read", "write", "approve"],
  },
  reviewer: {
    assessment: ["read", "write", "approve"],
    measure: ["read", "write"],
    document: ["read", "write", "approve"],
  },
  editor: {
    assessment: ["read", "write"],
    measure: ["read", "write"],
    document: ["read", "write"],
  },
  viewer: READ_ALL,
} as const satisfies Record<Role, Rights>;

export type Resource = "organization" | "member" | "invitation" | "assessment" | "measure" | "document";

export function can(role: Role, resource: Resource, action: string): boolean {
  const rights: Rights = ROLE_RIGHTS[role];
  return rights[resource]?.includes(action) ?? false;
}
```

Run: `pnpm test src/domain/rights.test.ts`
Expected: PASS (5 Tests).

- [ ] **Step 3: Better-Auth-Access-Control aus derselben Matrix**

Create `qm/src/auth/permissions.ts`:

```ts
import { createAccessControl } from "better-auth/plugins/access";
import { ROLE_RIGHTS } from "@/domain/rights";

export const statement = {
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  assessment: ["read", "write", "approve"],
  measure: ["read", "write"],
  document: ["read", "write", "approve"],
} as const;

export const ac = createAccessControl(statement);

export const roles = {
  owner: ac.newRole(ROLE_RIGHTS.owner),
  qm_admin: ac.newRole(ROLE_RIGHTS.qm_admin),
  reviewer: ac.newRole(ROLE_RIGHTS.reviewer),
  editor: ac.newRole(ROLE_RIGHTS.editor),
  viewer: ac.newRole(ROLE_RIGHTS.viewer),
};
```

Falls `pnpm typecheck` bei `newRole` wegen readonly-Arrays meckert: `ROLE_RIGHTS.x` als `{ ... } as const`-Typ belassen und das `statement` um die fehlenden Schlüssel ergänzen. Die Doku zu `createAccessControl` ist massgeblich.

- [ ] **Step 4: Auth-Instanz**

Create `qm/src/auth/auth.ts`:

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { ac, roles } from "./permissions";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    // E-Mail-Verifikation und Reset kommen mit Resend nach dem Pitch.
    requireEmailVerification: false,
  },
  plugins: [
    organization({ ac, roles, creatorRole: "owner" }),
    nextCookies(),
  ],
  databaseHooks: {
    session: {
      create: {
        // Ein Rettungsdienst pro User: die erste Mitgliedschaft wird aktiv.
        before: async (session) => {
          const [first] = await db
            .select({ organizationId: schema.member.organizationId })
            .from(schema.member)
            .where(eq(schema.member.userId, session.userId))
            .limit(1);
          return {
            data: { ...session, activeOrganizationId: first?.organizationId ?? null },
          };
        },
      },
    },
  },
});
```

Create `qm/src/auth/client.ts`:

```ts
import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { ac, roles } from "./permissions";

export const authClient = createAuthClient({
  plugins: [organizationClient({ ac, roles })],
});
```

Create `qm/src/app/api/auth/[...all]/route.ts`:

```ts
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/auth/auth";

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 5: Schema generieren, Migration erzeugen und anwenden**

```bash
cd qm
pnpm dlx auth@latest generate --config src/auth/auth.ts --output src/db/schema/auth.ts -y
```

Falls die CLI wegen des leeren Schemas beim Laden der Config scheitert: in `auth.ts` temporär `drizzleAdapter(db, { provider: "pg" })` ohne `schema` verwenden, generieren, dann `schema` wieder einsetzen.

Prüfen: `src/db/schema/auth.ts` exportiert `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`, und `session` hat `activeOrganizationId`.

```bash
pnpm db:generate
pnpm db:migrate
```

Expected: `drizzle/0000_*.sql` angelegt, Tabellen in `qm_dev` vorhanden. (`DATABASE_URL_DIRECT` zeigt lokal auf dieselbe DB.)

- [ ] **Step 6: Integrationstest echter Flow**

Create `qm/src/auth/auth.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { auth } from "./auth";
import { resetDb } from "@/test/helpers";

describe("auth", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("signs up a user and creates an organization with owner membership", async () => {
    const { user } = await auth.api.signUpEmail({
      body: { email: "a@example.test", password: "correct-horse-battery-1", name: "A" },
    });
    const org = await auth.api.createOrganization({
      body: { name: "Org A", slug: "org-a", userId: user.id },
    });
    const members = await db
      .select()
      .from(schema.member)
      .where(eq(schema.member.organizationId, org.id));
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe("owner");
  });
});
```

Der Test importiert `resetDb`, das in Task 5 vervollständigt wird. Jetzt eine erste Fassung anlegen:

Create `qm/src/test/helpers.ts`:

```ts
import { sql } from "drizzle-orm";
import { db } from "@/db";

const TABLES = [
  "audit_event",
  "criterion_assessment",
  "criterion",
  "standard_version",
  "invitation",
  "member",
  "session",
  "account",
  "verification",
  "organization",
  '"user"',
];

export async function resetDb() {
  if (process.env.ALLOW_DEMO_RESET !== "1") {
    throw new Error("resetDb nur mit ALLOW_DEMO_RESET=1");
  }
  const existing = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  const have = new Set(existing.rows.map((r) => r.tablename));
  const present = TABLES.filter((t) => have.has(t.replaceAll('"', "")));
  if (present.length === 0) return;
  await db.execute(sql.raw(`TRUNCATE ${present.join(", ")} RESTART IDENTITY CASCADE`));
}
```

Run: `pnpm test`
Expected: PASS (Rechte-Tests, Auth-Flow, Smoke, DB). Falls `createOrganization` mit `userId` ohne Session nicht erlaubt ist, laut Doku die serverseitige Variante prüfen. Schlägt auch das fehl, im Test die Organisation und die Mitgliedschaft direkt per `db.insert` anlegen und den Test auf «signUp liefert einen User und der Handler antwortet» reduzieren. Im Commit festhalten.

- [ ] **Step 7: Typecheck und Commit**

Run: `pnpm typecheck && pnpm lint`
Expected: ohne Fehler.

```bash
git add qm/ && git commit -m "feat(qm): add better auth with organizations and role matrix"
```

---

### Task 4: Domain-Schema, Audit-Trigger, Katalog-Import

**Files:**
- Replace: `qm/src/db/schema/domain.ts`
- Create: `qm/drizzle/0001_*.sql` (generiert), `qm/drizzle/0002_audit_append_only.sql` (custom), `qm/src/domain/catalog.ts`, `qm/scripts/import-catalog.ts`
- Test: `qm/src/domain/catalog.test.ts`, `qm/src/db/audit-immutable.test.ts`

**Interfaces:**
- Produces:
  - Tabellen `standardVersion`, `criterion`, `criterionAssessment`, `auditEvent`
  - `ASSESSMENT_STATUSES = ["not_assessed","met","open","critical","not_applicable"] as const`, `type AssessmentStatus`
  - `catalogRowSchema`, `importCatalog(db: Db, input: { standardVersionId: string; label: string; rows: unknown[] }): Promise<{ imported: number }>`
  - `ACTIVE_STANDARD_VERSION = "ivr-rd-draft"`

- [ ] **Step 1: Failing tests**

Create `qm/src/domain/catalog.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { criterion, standardVersion } from "@/db/schema";
import { importCatalog } from "./catalog";
import { resetDb } from "@/test/helpers";

const row = (nummer: string, titel = "Titel") => ({
  nummer,
  titel,
  kapitel: "Prozess",
  anerkennung_muss: true,
  anerkennung_soll: false,
  erneuerung_muss: true,
  erneuerung_soll: false,
  sortierung: 80100,
});

describe("importCatalog", () => {
  beforeEach(resetDb);

  it("imports rows and keeps the version draft_extracted", async () => {
    await importCatalog(db, { standardVersionId: "v", label: "V", rows: [row("8.1"), row("8.2")] });
    expect(await db.select().from(criterion)).toHaveLength(2);
    const [v] = await db.select().from(standardVersion).where(eq(standardVersion.id, "v"));
    expect(v.validationStatus).toBe("draft_extracted");
  });

  it("is idempotent and updates changed titles", async () => {
    await importCatalog(db, { standardVersionId: "v", label: "V", rows: [row("8.1", "Alt")] });
    await importCatalog(db, { standardVersionId: "v", label: "V", rows: [row("8.1", "Neu")] });
    const rows = await db.select().from(criterion);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Neu");
  });

  it("aborts the whole import when one row has no number", async () => {
    await expect(
      importCatalog(db, { standardVersionId: "v", label: "V", rows: [row("8.1"), { ...row("x"), nummer: "" }] }),
    ).rejects.toThrow();
    expect(await db.select().from(criterion)).toHaveLength(0);
  });

  it("does not turn the version validated when one rule is validated", async () => {
    await importCatalog(db, { standardVersionId: "v", label: "V", rows: [row("8.1")] });
    await db.update(criterion).set({ ruleValidationStatus: "validated" });
    const [v] = await db.select().from(standardVersion);
    expect(v.validationStatus).toBe("draft_extracted");
  });
});
```

Create `qm/src/db/audit-immutable.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvent } from "@/db/schema";
import { makeOrg, resetDb } from "@/test/helpers";

describe("audit_event is append-only", () => {
  beforeEach(resetDb);

  it("rejects UPDATE and DELETE", async () => {
    const { org, user } = await makeOrg("audit-a");
    const [e] = await db
      .insert(auditEvent)
      .values({ organizationId: org.id, actorUserId: user.id, eventType: "test.created", entityType: "test", entityId: "1" })
      .returning();
    await expect(db.execute(sql`UPDATE audit_event SET event_type = 'x' WHERE id = ${e.id}`)).rejects.toThrow();
    await expect(db.execute(sql`DELETE FROM audit_event WHERE id = ${e.id}`)).rejects.toThrow();
  });
});
```

Run: `pnpm test`
Expected: FAIL (Schema, `makeOrg`, `importCatalog` fehlen).

- [ ] **Step 2: Domain-Schema**

Replace `qm/src/db/schema/domain.ts`:

```ts
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

export const VALIDATION_STATUSES = ["draft_extracted", "validated"] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export const ASSESSMENT_STATUSES = [
  "not_assessed",
  "met",
  "open",
  "critical",
  "not_applicable",
] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const ACTIVE_STANDARD_VERSION = "ivr-rd-draft";

export const standardVersion = pgTable("standard_version", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  validationStatus: text("validation_status", { enum: VALIDATION_STATUSES })
    .notNull()
    .default("draft_extracted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Globaler Katalog: gehört dem Regelwerk, nicht einer Organisation.
export const criterion = pgTable(
  "criterion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    standardVersionId: text("standard_version_id")
      .notNull()
      .references(() => standardVersion.id),
    number: text("number").notNull(),
    title: text("title").notNull(),
    chapter: text("chapter").notNull(),
    mandatoryAccreditation: boolean("mandatory_accreditation").notNull().default(false),
    shouldAccreditation: boolean("should_accreditation").notNull().default(false),
    mandatoryRenewal: boolean("mandatory_renewal").notNull().default(false),
    shouldRenewal: boolean("should_renewal").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    ruleValidationStatus: text("rule_validation_status", { enum: VALIDATION_STATUSES })
      .notNull()
      .default("draft_extracted"),
  },
  (t) => [unique("criterion_version_number").on(t.standardVersionId, t.number)],
);

export const criterionAssessment = pgTable(
  "criterion_assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id),
    criterionId: uuid("criterion_id")
      .notNull()
      .references(() => criterion.id),
    status: text("status", { enum: ASSESSMENT_STATUSES }).notNull().default("not_assessed"),
    ownerUserId: text("owner_user_id").references(() => user.id),
    dueDate: date("due_date"),
    note: text("note"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("assessment_org_criterion").on(t.organizationId, t.criterionId),
    index("assessment_org_idx").on(t.organizationId),
  ],
);

export const auditEvent = pgTable(
  "audit_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id),
    actorUserId: text("actor_user_id").references(() => user.id),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    beforeJson: jsonb("before_json"),
    afterJson: jsonb("after_json"),
    requestId: text("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_org_created_idx").on(t.organizationId, t.createdAt)],
);

export type AuditEventRow = typeof auditEvent.$inferSelect;
```

- [ ] **Step 3: Migrationen erzeugen**

```bash
pnpm db:generate
pnpm drizzle-kit generate --custom --name=audit_append_only
```

Die zweite Datei (`drizzle/0002_audit_append_only.sql`) füllen:

```sql
CREATE OR REPLACE FUNCTION audit_event_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_event is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_event_no_change
  BEFORE UPDATE OR DELETE ON audit_event
  FOR EACH ROW EXECUTE FUNCTION audit_event_immutable();
```

```bash
pnpm db:migrate
```

Expected: beide Migrationen angewendet. TRUNCATE (Testreset, Demo-Reset) löst den Row-Trigger nicht aus und bleibt möglich.

- [ ] **Step 4: Katalog-Import**

Create `qm/src/domain/catalog.ts`:

```ts
import { z } from "zod";
import type { Db } from "@/db";
import { criterion, standardVersion } from "@/db/schema";

export const catalogRowSchema = z.object({
  nummer: z.string().min(1),
  titel: z.string().min(1),
  kapitel: z.string().min(1),
  anerkennung_muss: z.boolean(),
  anerkennung_soll: z.boolean(),
  erneuerung_muss: z.boolean(),
  erneuerung_soll: z.boolean(),
  sortierung: z.number().int(),
});

export type CatalogInput = {
  standardVersionId: string;
  label: string;
  rows: unknown[];
};

export async function importCatalog(db: Db, input: CatalogInput): Promise<{ imported: number }> {
  const rows = z.array(catalogRowSchema).parse(input.rows);
  await db.transaction(async (tx) => {
    // Bestehende Version bleibt in ihrem Validierungsstatus, neue startet als draft_extracted.
    await tx
      .insert(standardVersion)
      .values({ id: input.standardVersionId, label: input.label })
      .onConflictDoNothing();
    for (const r of rows) {
      await tx
        .insert(criterion)
        .values({
          standardVersionId: input.standardVersionId,
          number: r.nummer,
          title: r.titel,
          chapter: r.kapitel,
          mandatoryAccreditation: r.anerkennung_muss,
          shouldAccreditation: r.anerkennung_soll,
          mandatoryRenewal: r.erneuerung_muss,
          shouldRenewal: r.erneuerung_soll,
          sortOrder: r.sortierung,
        })
        .onConflictDoUpdate({
          target: [criterion.standardVersionId, criterion.number],
          set: {
            title: r.titel,
            chapter: r.kapitel,
            mandatoryAccreditation: r.anerkennung_muss,
            shouldAccreditation: r.anerkennung_soll,
            mandatoryRenewal: r.erneuerung_muss,
            shouldRenewal: r.erneuerung_soll,
            sortOrder: r.sortierung,
          },
        });
    }
  });
  return { imported: rows.length };
}
```

Die `kriterien.json` enthält zusätzliche Felder (`min_anerkennung`, `min_erneuerung`). Zod-`object` lässt unbekannte Schlüssel durch (strippt sie), das ist hier gewollt.

Create `qm/scripts/import-catalog.ts`:

```ts
import "dotenv/config";
import { readFileSync } from "node:fs";
import { db } from "@/db";
import { importCatalog } from "@/domain/catalog";
import { ACTIVE_STANDARD_VERSION } from "@/db/schema";

const file = process.argv[2] ?? "../web/ivr/demo/kriterien.json";
const rows: unknown = JSON.parse(readFileSync(file, "utf8"));
if (!Array.isArray(rows)) throw new Error("Katalogdatei muss ein Array sein");

importCatalog(db, {
  standardVersionId: ACTIVE_STANDARD_VERSION,
  label: "IVR Rettungsdienst (Entwurf, aus Python-Demo extrahiert)",
  rows,
}).then((r) => {
  console.log(`Importiert: ${r.imported}`);
  process.exit(0);
});
```

`tsx` kennt den `@/`-Alias nicht von selbst. In `qm/tsconfig.json` ist `paths` gesetzt (Next-Scaffold). tsx liest `paths` aus der tsconfig, daher genügt das. Falls nicht: relative Importe in `scripts/` verwenden.

- [ ] **Step 5: Test-Helper für Organisationen**

Ersetze in `qm/src/test/helpers.ts` den Inhalt unterhalb von `resetDb` durch folgende Ergänzung (Imports oben ergänzen):

```ts
import { randomUUID } from "node:crypto";
import { organization, member, user } from "@/db/schema";
import type { OrgContext } from "@/domain/org-context";
import type { Role } from "@/domain/rights";

export async function makeUser(label: string) {
  const [u] = await db
    .insert(user)
    .values({
      id: randomUUID(),
      name: label,
      email: `${label}-${randomUUID().slice(0, 8)}@example.test`,
      emailVerified: true,
    })
    .returning();
  return u;
}

export async function makeOrg(slug: string, role: Role = "owner") {
  const u = await makeUser(`user-${slug}`);
  const [org] = await db
    .insert(organization)
    .values({ id: randomUUID(), name: `Org ${slug}`, slug, createdAt: new Date() })
    .returning();
  await db
    .insert(member)
    .values({ id: randomUUID(), organizationId: org.id, userId: u.id, role, createdAt: new Date() });
  return { org, user: u };
}

export async function addMemberTo(orgId: string, label: string, role: Role) {
  const u = await makeUser(label);
  await db
    .insert(member)
    .values({ id: randomUUID(), organizationId: orgId, userId: u.id, role, createdAt: new Date() });
  return u;
}

export function ctxFor(orgId: string, userId: string, role: Role): OrgContext {
  return { organizationId: orgId, userId, role };
}
```

`OrgContext` entsteht in Task 5. Bis dahin liefert `pnpm typecheck` einen Fehler an dieser Stelle, das ist erwartet. Task 4 bleibt trotzdem testbar, weil Vitest nicht typprüft.

- [ ] **Step 6: Tests grün, Import gegen echte Daten**

Run: `pnpm test src/domain/catalog.test.ts src/db/audit-immutable.test.ts`
Expected: PASS (5 Tests).

Run: `pnpm import:catalog`
Expected: `Importiert: 61`. Danach `docker compose exec db psql -U qm qm_dev -c "select count(*) from criterion"` zeigt 61.

- [ ] **Step 7: Commit**

```bash
git add qm/ && git commit -m "feat(qm): add domain schema, append-only audit trigger and catalog import"
```

---

### Task 5: Mandanten-Guard und atomares Audit

**Files:**
- Create: `qm/src/domain/org-context.ts`, `qm/src/domain/request-context.ts`, `qm/src/domain/audit.ts`, `qm/src/domain/assessments.ts`
- Test: `qm/src/domain/tenancy.test.ts`

**Interfaces:**
- Consumes: `can`, `Role`, `Resource` aus `rights.ts`; `db`, `Tx`; Schema aus Task 4; Helper aus Task 4 Step 5.
- Produces:
  - `type OrgContext = { organizationId: string; userId: string; role: Role }`
  - `class ForbiddenError extends Error`, `class UnauthorizedError extends Error`
  - `assertCan(ctx: OrgContext, resource: Resource, action: string): void`
  - `requireOrgContext(): Promise<OrgContext>` (in `request-context.ts`)
  - `type AuditEventInput = { eventType: string; entityType: string; entityId: string; before?: unknown; after?: unknown }`
  - `withAudit<T>(ctx: OrgContext, fn: (tx: Tx) => Promise<{ result: T; event: AuditEventInput }>): Promise<T>`
  - `listAuditEvents(ctx: OrgContext, limit?: number): Promise<AuditEventRow[]>`
  - `type AssessmentRow = { criterionId: string; number: string; title: string; chapter: string; mandatory: boolean; status: AssessmentStatus; dueDate: string | null }`
  - `listAssessments(ctx: OrgContext): Promise<AssessmentRow[]>`
  - `setAssessmentStatus(ctx: OrgContext, criterionId: string, status: AssessmentStatus): Promise<{ id: string; status: AssessmentStatus }>`

- [ ] **Step 1: Failing Tests (der kritische Test aus Architekturpapier Kapitel 8)**

Create `qm/src/domain/tenancy.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { criterion, criterionAssessment } from "@/db/schema";
import { importCatalog } from "./catalog";
import { listAssessments, setAssessmentStatus } from "./assessments";
import { listAuditEvents, withAudit } from "./audit";
import { ForbiddenError } from "./org-context";
import { addMemberTo, ctxFor, makeOrg, resetDb } from "@/test/helpers";
import { ACTIVE_STANDARD_VERSION } from "@/db/schema";

const rows = ["8.1", "8.2"].map((n, i) => ({
  nummer: n, titel: `Kriterium ${n}`, kapitel: "Prozess",
  anerkennung_muss: i === 0, anerkennung_soll: false,
  erneuerung_muss: false, erneuerung_soll: false, sortierung: 80100 + i,
}));

async function setup() {
  await importCatalog(db, { standardVersionId: ACTIVE_STANDARD_VERSION, label: "t", rows });
  const a = await makeOrg("org-a");
  const b = await makeOrg("org-b");
  const [c1] = await db.select().from(criterion).orderBy(criterion.sortOrder);
  return { a, b, c1, ctxA: ctxFor(a.org.id, a.user.id, "owner"), ctxB: ctxFor(b.org.id, b.user.id, "owner") };
}

describe("tenant isolation", () => {
  beforeEach(resetDb);

  it("org B never sees or changes the assessment of org A", async () => {
    const { c1, ctxA, ctxB } = await setup();
    await setAssessmentStatus(ctxA, c1.id, "critical");

    const seenByB = await listAssessments(ctxB);
    expect(seenByB.find((r) => r.criterionId === c1.id)?.status).toBe("not_assessed");

    await setAssessmentStatus(ctxB, c1.id, "met");
    const all = await db.select().from(criterionAssessment);
    expect(all).toHaveLength(2);
    const seenByA = await listAssessments(ctxA);
    expect(seenByA.find((r) => r.criterionId === c1.id)?.status).toBe("critical");
  });

  it("audit events are scoped to the organization", async () => {
    const { c1, ctxA, ctxB } = await setup();
    await setAssessmentStatus(ctxA, c1.id, "open");
    expect(await listAuditEvents(ctxA)).toHaveLength(1);
    expect(await listAuditEvents(ctxB)).toHaveLength(0);
  });
});

describe("permissions", () => {
  beforeEach(resetDb);

  it("viewer cannot write: no row, no audit event", async () => {
    const { a, c1 } = await setup();
    const v = await addMemberTo(a.org.id, "viewer", "viewer");
    const ctxV = ctxFor(a.org.id, v.id, "viewer");
    await expect(setAssessmentStatus(ctxV, c1.id, "met")).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.select().from(criterionAssessment)).toHaveLength(0);
    expect(await listAuditEvents(ctxFor(a.org.id, a.user.id, "owner"))).toHaveLength(0);
  });
});

describe("atomic audit", () => {
  beforeEach(resetDb);

  it("rolls back the change when the action fails after writing", async () => {
    const { c1, ctxA } = await setup();
    await expect(
      withAudit(ctxA, async (tx) => {
        await tx.insert(criterionAssessment).values({
          organizationId: ctxA.organizationId, criterionId: c1.id, status: "met",
        });
        throw new Error("fails after write");
      }),
    ).rejects.toThrow("fails after write");
    expect(await db.select().from(criterionAssessment)).toHaveLength(0);
    expect(await listAuditEvents(ctxA)).toHaveLength(0);
  });

  it("records before and after for a status change", async () => {
    const { c1, ctxA } = await setup();
    await setAssessmentStatus(ctxA, c1.id, "open");
    await setAssessmentStatus(ctxA, c1.id, "met");
    const events = await listAuditEvents(ctxA);
    expect(events).toHaveLength(2);
    const latest = events[0];
    expect(latest.eventType).toBe("criterion.status_changed");
    expect((latest.beforeJson as { status: string }).status).toBe("open");
    expect((latest.afterJson as { status: string }).status).toBe("met");
    expect(latest.actorUserId).toBe(ctxA.userId);
  });
});
```

Run: `pnpm test src/domain/tenancy.test.ts`
Expected: FAIL, Module fehlen.

- [ ] **Step 2: OrgContext und Fehler**

Create `qm/src/domain/org-context.ts`:

```ts
import { can, type Resource, type Role } from "./rights";

export type OrgContext = { organizationId: string; userId: string; role: Role };

export class UnauthorizedError extends Error {
  constructor(message = "Nicht angemeldet") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Keine Berechtigung") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertCan(ctx: OrgContext, resource: Resource, action: string): void {
  if (!can(ctx.role, resource, action)) {
    throw new ForbiddenError(`${ctx.role} darf ${resource}.${action} nicht`);
  }
}
```

Diese Datei bleibt frei von Next- und Auth-Imports, damit Tests und Services sie ohne Request laden.

Create `qm/src/domain/request-context.ts`:

```ts
import { headers } from "next/headers";
import { auth } from "@/auth/auth";
import { ForbiddenError, UnauthorizedError, type OrgContext } from "./org-context";
import { ROLES, type Role } from "./rights";

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Liest Session und aktive Mitgliedschaft aus dem Request. Nur in Server Components, Actions und Route Handlers. */
export async function requireOrgContext(): Promise<OrgContext> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session) throw new UnauthorizedError();
  const member = await auth.api.getActiveMember({ headers: h });
  if (!member || !isRole(member.role)) throw new ForbiddenError("Keine aktive Organisation");
  return { organizationId: member.organizationId, userId: session.user.id, role: member.role };
}
```

- [ ] **Step 3: withAudit**

Create `qm/src/domain/audit.ts`:

```ts
import { desc, eq } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { auditEvent, type AuditEventRow } from "@/db/schema";
import type { OrgContext } from "./org-context";

export type AuditEventInput = {
  eventType: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

/** Führt die Aktion und das Audit-Event in einer Transaktion aus: beides oder nichts. */
export async function withAudit<T>(
  ctx: OrgContext,
  fn: (tx: Tx) => Promise<{ result: T; event: AuditEventInput }>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const { result, event } = await fn(tx);
    await tx.insert(auditEvent).values({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
      beforeJson: event.before ?? null,
      afterJson: event.after ?? null,
    });
    return result;
  });
}

export async function listAuditEvents(ctx: OrgContext, limit = 100): Promise<AuditEventRow[]> {
  return db
    .select()
    .from(auditEvent)
    .where(eq(auditEvent.organizationId, ctx.organizationId))
    .orderBy(desc(auditEvent.createdAt))
    .limit(limit);
}
```

Der Test «rolls back» ruft `withAudit` mit einer Funktion auf, die wirft: die Transaktion rollt zurück, der Typ der Rückgabe wird nie erreicht. Für den Compiler muss die Funktion trotzdem den Rückgabetyp erfüllen. Im Test deshalb `throw` als letzte Anweisung (liefert `never`, was zu jedem Typ passt).

- [ ] **Step 4: Assessments**

Create `qm/src/domain/assessments.ts`:

```ts
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  ACTIVE_STANDARD_VERSION,
  criterion,
  criterionAssessment,
  type AssessmentStatus,
} from "@/db/schema";
import { withAudit } from "./audit";
import { assertCan, type OrgContext } from "./org-context";

export type AssessmentRow = {
  criterionId: string;
  number: string;
  title: string;
  chapter: string;
  mandatory: boolean;
  status: AssessmentStatus;
  dueDate: string | null;
};

/** Alle Kriterien der aktiven Standardversion, mit dem Stand dieser Organisation. */
export async function listAssessments(ctx: OrgContext): Promise<AssessmentRow[]> {
  assertCan(ctx, "assessment", "read");
  const rows = await db
    .select({
      criterionId: criterion.id,
      number: criterion.number,
      title: criterion.title,
      chapter: criterion.chapter,
      mandatory: criterion.mandatoryAccreditation,
      status: criterionAssessment.status,
      dueDate: criterionAssessment.dueDate,
    })
    .from(criterion)
    .leftJoin(
      criterionAssessment,
      and(
        eq(criterionAssessment.criterionId, criterion.id),
        eq(criterionAssessment.organizationId, ctx.organizationId),
      ),
    )
    .where(eq(criterion.standardVersionId, ACTIVE_STANDARD_VERSION))
    .orderBy(criterion.sortOrder);
  return rows.map((r) => ({ ...r, status: r.status ?? "not_assessed" }));
}

export async function setAssessmentStatus(
  ctx: OrgContext,
  criterionId: string,
  status: AssessmentStatus,
): Promise<{ id: string; status: AssessmentStatus }> {
  assertCan(ctx, "assessment", "write");
  return withAudit(ctx, async (tx) => {
    const [before] = await tx
      .select()
      .from(criterionAssessment)
      .where(
        and(
          eq(criterionAssessment.organizationId, ctx.organizationId),
          eq(criterionAssessment.criterionId, criterionId),
        ),
      );
    const [after] = await tx
      .insert(criterionAssessment)
      .values({ organizationId: ctx.organizationId, criterionId, status })
      .onConflictDoUpdate({
        target: [criterionAssessment.organizationId, criterionAssessment.criterionId],
        set: { status, updatedAt: new Date() },
      })
      .returning();
    return {
      result: { id: after.id, status: after.status },
      event: {
        eventType: "criterion.status_changed",
        entityType: "criterion_assessment",
        entityId: after.id,
        before: before ? { status: before.status } : { status: "not_assessed" },
        after: { status: after.status },
      },
    };
  });
}
```

- [ ] **Step 5: Tests grün**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: alles grün (inklusive der Test-Helper-Typen aus Task 4).

- [ ] **Step 6: Commit**

```bash
git add qm/ && git commit -m "feat(qm): add tenant-scoped assessments with atomic audit events"
```

---

### Task 6: Demo-Seed

**Files:**
- Create: `qm/src/seed/demo.ts`, `qm/scripts/seed-demo.ts`
- Test: `qm/src/seed/demo.test.ts`

**Interfaces:**
- Consumes: `importCatalog`, `setAssessmentStatus`, `resetDb`-Logik, `auth.api.signUpEmail`.
- Produces: `seedDemo(): Promise<{ organizationId: string; users: Record<Role, { email: string; password: string }> }>`

- [ ] **Step 1: Failing test**

Create `qm/src/seed/demo.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "@/db";
import { member, organization } from "@/db/schema";
import { listAssessments } from "@/domain/assessments";
import { listAuditEvents } from "@/domain/audit";
import { resetDb } from "@/test/helpers";
import { seedDemo } from "./demo";

const catalog: unknown = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../../web/ivr/demo/kriterien.json"), "utf8"),
);

describe("seedDemo", () => {
  beforeEach(resetDb);

  it("creates a labelled demo organisation with all five roles", async () => {
    const out = await seedDemo({ catalog });
    const [org] = await db.select().from(organization);
    expect(org.name).toContain("Demo");
    expect(await db.select().from(member)).toHaveLength(5);
    expect(Object.keys(out.users).sort()).toEqual(
      ["editor", "owner", "qm_admin", "reviewer", "viewer"],
    );
  });

  it("leaves a story: critical mandatory items and untouched criteria", async () => {
    await seedDemo({ catalog });
    const [org] = await db.select().from(organization);
    const owner = (await db.select().from(member)).find((m) => m.role === "owner");
    const ctx = { organizationId: org.id, userId: owner!.userId, role: "owner" as const };
    const rows = await listAssessments(ctx);
    expect(rows.some((r) => r.status === "critical" && r.mandatory)).toBe(true);
    expect(rows.some((r) => r.status === "not_assessed")).toBe(true);
    expect((await listAuditEvents(ctx)).length).toBeGreaterThan(0);
  });

  it("is repeatable", async () => {
    await seedDemo({ catalog });
    await seedDemo({ catalog });
    expect(await db.select().from(organization)).toHaveLength(1);
  });
});
```

Run: `pnpm test src/seed/demo.test.ts`
Expected: FAIL, `./demo` fehlt.

- [ ] **Step 2: Seed**

Create `qm/src/seed/demo.ts`:

```ts
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth/auth";
import { db } from "@/db";
import { ACTIVE_STANDARD_VERSION, criterion, member, organization } from "@/db/schema";
import { setAssessmentStatus } from "@/domain/assessments";
import { importCatalog } from "@/domain/catalog";
import { ROLES, type Role } from "@/domain/rights";
import type { AssessmentStatus } from "@/db/schema";

const DEMO_PASSWORD = "Demo-QM-2026";

// Story: wenige bewusst offene Pflichtpunkte, einige erfüllte, der Rest unbewertet.
const STORY: ReadonlyArray<{ number: string; status: AssessmentStatus }> = [
  { number: "5.2.1", status: "met" },
  { number: "5.2.2", status: "met" },
  { number: "7.3.10", status: "critical" },
  { number: "7.3.8", status: "open" },
  { number: "8.1", status: "open" },
];

export async function seedDemo(input: { catalog: unknown }) {
  if (process.env.ALLOW_DEMO_RESET !== "1") {
    throw new Error("seedDemo setzt die Datenbank zurück: nur mit ALLOW_DEMO_RESET=1");
  }
  await db.execute(
    sql`TRUNCATE audit_event, criterion_assessment, invitation, member, session, account, verification, organization, "user" RESTART IDENTITY CASCADE`,
  );
  await importCatalog(db, {
    standardVersionId: ACTIVE_STANDARD_VERSION,
    label: "IVR Rettungsdienst (Entwurf, aus Python-Demo extrahiert)",
    rows: input.catalog as unknown[],
  });

  const users = {} as Record<Role, { email: string; password: string }>;
  const ids = {} as Record<Role, string>;
  for (const role of ROLES) {
    const email = `${role.replace("_", "-")}@demo.qm.test`;
    const { user } = await auth.api.signUpEmail({
      body: { email, password: DEMO_PASSWORD, name: `Demo ${role}` },
    });
    users[role] = { email, password: DEMO_PASSWORD };
    ids[role] = user.id;
  }

  const [org] = await db
    .insert(organization)
    .values({
      id: crypto.randomUUID(),
      name: "Rettungsdienst Musterstadt - Demo",
      slug: "musterstadt-demo",
      createdAt: new Date(),
    })
    .returning();
  for (const role of ROLES) {
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: org.id,
      userId: ids[role],
      role,
      createdAt: new Date(),
    });
  }

  const ctx = { organizationId: org.id, userId: ids.owner, role: "owner" as const };
  for (const step of STORY) {
    const [c] = await db
      .select({ id: criterion.id })
      .from(criterion)
      .where(eq(criterion.number, step.number));
    if (c) await setAssessmentStatus(ctx, c.id, step.status);
  }
  return { organizationId: org.id, users };
}
```

Die Story-Nummern (5.2.1, 5.2.2, 7.3.10, 7.3.8, 8.1) kommen aus dem Katalog. 5.2.1, 5.2.2, 7.3.10 und 7.3.8 sind dort Pflichtkriterien der Anerkennung (`anerkennung_muss = true`), 8.1 nicht. Der Test «critical and mandatory» stützt sich auf 7.3.10 (Hygiene). Existiert eine Nummer nicht, wird sie übersprungen.

Create `qm/scripts/seed-demo.ts`:

```ts
import "dotenv/config";
import { readFileSync } from "node:fs";
import { seedDemo } from "@/seed/demo";

process.env.ALLOW_DEMO_RESET ??= process.argv.includes("--yes-reset") ? "1" : "";
const catalog: unknown = JSON.parse(readFileSync("../web/ivr/demo/kriterien.json", "utf8"));

seedDemo({ catalog }).then((out) => {
  console.log("Demo bereit. Organisation:", out.organizationId);
  for (const [role, u] of Object.entries(out.users)) console.log(role, u.email, u.password);
  process.exit(0);
});
```

Aufruf: `pnpm seed:demo -- --yes-reset`. Ohne das Flag bricht `seedDemo` ab. Auf Staging nie ohne Absicht ausführen, der Reset leert alles.

- [ ] **Step 3: Tests und Seed**

Run: `pnpm test`
Expected: alle PASS.

Run: `pnpm seed:demo -- --yes-reset`
Expected: fünf Zeilen mit Rollen und Demo-Zugangsdaten.

- [ ] **Step 4: Commit**

```bash
git add qm/ && git commit -m "feat(qm): add repeatable demo seed with story data"
```

---

### Task 7: Login und geschützte Kriterienliste

**Files:**
- Create: `qm/src/proxy.ts`, `qm/src/app/login/page.tsx`, `qm/src/app/login/login-form.tsx`, `qm/src/app/(app)/layout.tsx`, `qm/src/app/(app)/criteria/page.tsx`
- Modify: `qm/src/app/globals.css`, `qm/src/app/page.tsx`

**Interfaces:**
- Consumes: `authClient`, `requireOrgContext`, `listAssessments`.
- Produces: Route `/login`, Route `/criteria` (nur eingeloggt, zeigt Organisationsname und alle Kriterien mit Textstatus).

Vor dem ersten `.tsx`: `qm/DESIGN.md` existiert (Task 1). Vor UI-Code `impeccable:impeccable` invoken (Fallback `frontend-design:frontend-design`), Komponenten erst gegen 21st.dev prüfen (MCP aktuell nicht verbunden: überspringen und im Commit vermerken).

- [ ] **Step 1: Tokens in globals.css**

`qm/src/app/globals.css` ersetzen durch (Tailwind v4):

```css
@import "tailwindcss";

:root {
  --background: #eef2f9;
  --surface: #ffffff;
  --surface-subtle: #f3f6fb;
  --sidebar: #f7f9fd;
  --text: #050f1e;
  --text-muted: #4d5f7d;
  --border: #dde5f0;
  --field-border: #8095b3;
  --primary: #0052a8;
  --primary-deep: #003b7a;
  --primary-subtle: #e7effb;
  --critical: #b3261e;
  --warning: #8a5a00;
  --success: #1a6b3c;
  --radius: 6px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #050f1e;
    --surface: #0a1830;
    --surface-subtle: #102341;
    --sidebar: #040c18;
    --text: #eef5ff;
    --text-muted: #9db6d8;
    --border: #1c3258;
    --field-border: #4d6a96;
    --primary: #3c8cff;
    --primary-subtle: #102341;
    --critical: #ff9b91;
    --warning: #e0b45c;
    --success: #76d3a1;
  }
}

@theme inline {
  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-surface-subtle: var(--surface-subtle);
  --color-sidebar: var(--sidebar);
  --color-text: var(--text);
  --color-text-muted: var(--text-muted);
  --color-border: var(--border);
  --color-field-border: var(--field-border);
  --color-primary: var(--primary);
  --color-primary-deep: var(--primary-deep);
  --color-primary-subtle: var(--primary-subtle);
  --color-critical: var(--critical);
  --color-warning: var(--warning);
  --color-success: var(--success);
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

body {
  background: var(--background);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
}

:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
```

Dark-Werte `border`, `field-border`, `primary-subtle` sind eigene Ableitungen, weil das Designpapier sie nicht nennt. In `DESIGN.md` unter «Dark» nachtragen, sobald Henrik sie freigibt.

- [ ] **Step 2: proxy.ts**

Create `qm/src/proxy.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  // Nur ein schneller Cookie-Check. Die eigentliche Prüfung macht requireOrgContext() serverseitig.
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/criteria/:path*"] };
```

- [ ] **Step 3: Login**

Create `qm/src/app/login/login-form.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/auth/client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    setPending(false);
    if (error) {
      setError("Anmeldung fehlgeschlagen. E-Mail oder Passwort stimmt nicht.");
      return;
    }
    router.push("/criteria");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-text-muted">E-Mail</span>
        <input name="email" type="email" required autoComplete="username"
          className="h-10 rounded-[var(--radius)] border border-field-border bg-surface px-3" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-text-muted">Passwort</span>
        <input name="password" type="password" required autoComplete="current-password"
          className="h-10 rounded-[var(--radius)] border border-field-border bg-surface px-3" />
      </label>
      {error && <p role="alert" className="text-critical">{error}</p>}
      <button type="submit" disabled={pending}
        className="h-10 rounded-[var(--radius)] bg-primary px-4 font-medium text-white disabled:opacity-60">
        {pending ? "Anmelden..." : "Anmelden"}
      </button>
    </form>
  );
}
```

Create `qm/src/app/login/page.tsx`:

```tsx
import { BRAND } from "@/brand";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <header>
        <h1 className="text-xl font-semibold">{BRAND.name}</h1>
        <p className="text-text-muted">{BRAND.tagline}</p>
      </header>
      <LoginForm />
    </main>
  );
}
```

`text-white` im Button ist kein Farb-Hex, aber ein fester Wert: im Designcheck gegen ein `--on-primary`-Token ersetzen, falls der Quality-Gate es meldet.

- [ ] **Step 4: Geschützter Bereich**

Create `qm/src/app/(app)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organization } from "@/db/schema";
import { ForbiddenError, UnauthorizedError } from "@/domain/org-context";
import { requireOrgContext } from "@/domain/request-context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let ctx;
  try {
    ctx = await requireOrgContext();
  } catch (e) {
    if (e instanceof UnauthorizedError || e instanceof ForbiddenError) redirect("/login");
    throw e;
  }
  const [org] = await db.select().from(organization).where(eq(organization.id, ctx.organizationId));
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <strong>{org?.name}</strong>
        <span className="text-text-muted">Rolle: {ctx.role}</span>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </div>
  );
}
```

Create `qm/src/app/(app)/criteria/page.tsx`:

```tsx
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
```

Replace `qm/src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/criteria");
}
```

- [ ] **Step 5: Build und manuelle Abnahme**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: alles grün.

Manuell:
1. `pnpm seed:demo -- --yes-reset`, dann `pnpm dev`.
2. `http://localhost:3000/criteria` ohne Login: Redirect auf `/login`.
3. Login `owner@demo.qm.test` mit Passwort `Demo-QM-2026`: Seite zeigt «Rettungsdienst Musterstadt - Demo», Rolle, 61 Kriterien; 7.3.10 «Kritisch», 7.3.8 und 8.1 «Offen».
4. Falsches Passwort: Fehlermeldung, kein Redirect.
5. Screenshot vom Desktop-Layout (`ls -t ~/Desktop/*.png | head -3`), gegen `DESIGN.md` prüfen: Tabelle statt Karten, Textlabel zusätzlich zur Farbe, Fokusring sichtbar per Tab.
6. Dev-Server beenden (RAM).

- [ ] **Step 6: Quality-Gate und Commit**

Run: `python3 ~/.claude/scripts/quality-gate.py "/Users/henrik/Documents/VS Code/thomato/qm"`
Expected: Exit 0. Meldungen (z.B. zum `text-white`) beheben, nicht stummschalten.

```bash
git add qm/ && git commit -m "feat(qm): add login and protected criteria list"
```

---

## Abschluss Plan 1 (Definition of Done)

- `pnpm test` grün gegen echtes Postgres, inklusive Cross-Tenant-, Rollen-, Rollback- und Append-only-Tests.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` grün.
- Demo-Seed reproduzierbar, Login funktioniert, Kriterienliste zeigt Organisationskontext.
- Nichts gepusht. Branch `feat/qm-foundation` lokal, Push nach Freigabe von Henrik.

## Self-Review (vom Plan-Autor durchgeführt)

- **Spec-Abdeckung:** Auth, Organizations, Rollen (Task 3), `organization_id NOT NULL` plus Isolationstest (4, 5), Audit atomar und append-only (4, 5), Katalog mit `draft_extracted` (4), Seed mit Reset (6), Login und Organisationskontext (7). Readiness-Logik, Dokumente, Massnahmen, Fristen, Export und API folgen bewusst in den Plänen 2-6.
- **Platzhalter-Scan:** Zwei bewusste «prüfe gegen Doku»-Hinweise bei Better-Auth-Signaturen (Task 3, Step 3 und 6), weil diese API sich ändert. Jeder hat einen definierten Fallback und `pnpm typecheck` als Prüfstein.
- **Typkonsistenz:** `OrgContext`, `Role`, `withAudit`, `listAssessments`, `setAssessmentStatus`, `ACTIVE_STANDARD_VERSION` heissen in allen Tasks gleich. `ctxFor`/`makeOrg`/`addMemberTo` werden in Task 4 definiert und in Task 5 und 6 benutzt.
- **Bekannte Schwäche:** `requireOrgContext` und die Seiten aus Task 7 haben keinen automatisierten Test (brauchen einen Request). Abdeckung dafür über die manuelle Abnahme jetzt, Playwright-Smoke in Plan 6.
