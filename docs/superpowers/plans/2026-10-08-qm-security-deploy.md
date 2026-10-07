# QM Sicherheit und geschützter Deploy Implementation Plan (Plan 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die App kann geschützt auf Vercel laufen: Registrierung ist abgeschaltet, die Laufzeit nutzt eine eingeschränkte Datenbankrolle, die Audit-Unveränderlichkeit gilt auch für die App-Rolle, Secrets sind geprüft, und das Deployment ist per Vercel-Schutz nicht anonym erreichbar. Danach folgt ein echter Browser-Smoketest gegen die URL.

**Architecture:** Zwei Better-Auth-Instanzen aus einer Fabrik (`makeAuth`): die Laufzeit-Instanz mit abgeschalteter Registrierung und eine Seed-/Test-Instanz, die nur im Seed-Code und in Tests existiert. Eine idempotente SQL-Datei legt die App-Rolle `qm_app` mit minimalen Rechten an. Deployment über die Git-Integration eines neuen Vercel-Projekts (Root Directory `qm`), Datenbank über die Neon-Integration des Teams.

**Tech Stack:** Wie bisher plus Vercel CLI (angemeldet) und die Neon-Marketplace-Integration.

**Spec:** Nachtauftrag 2026-10-08 (Abschnitte 10 bis 15), Architekturpapier `~/Downloads/IVR_QM_SaaS_Tech_Stack_Architecture.md` (Kap. 4, 7, 9), `qm/README.md` (Deployment-Abschnitt, Gate R10).

## Global Constraints

- Alle Constraints aus Plan 1 bis 4 gelten weiter. Keine Secrets im Repo oder in Logs; Werte nur über `vercel env add` (stdin) und lokale Dateien ausserhalb des Repos (`/tmp/...`, danach löschen).
- **Rulings (R35 bis R40):**
  - R35: Registrierung ist im Laufzeitcode immer aus (`disableSignUp: true`), nicht per Umgebungsvariable umschaltbar. Seed und Tests nutzen eine zweite Instanz aus derselben Fabrik, die nur importiert wird, wo ein Seed/Test läuft (Datei `src/auth/seed-auth.ts`, vom Laufzeitcode nie importiert; ein Guard-Test stellt das sicher).
  - R36: App-Rolle `qm_app`: LOGIN, kein Superuser, kein CREATEDB/CREATEROLE, kein Besitzer der Tabellen. Rechte: `USAGE` auf Schema `public`; `SELECT, INSERT, UPDATE, DELETE` auf alle Tabellen ausser `audit_event` und `document_version` (nur `SELECT, INSERT`); `USAGE, SELECT` auf Sequenzen; kein `TRUNCATE`, kein DDL, kein `drizzle`-Schema. Migrationen laufen weiter mit dem Besitzer (`DATABASE_URL_DIRECT`), nie zur Laufzeit.
  - R37: Datenbank für das Demo-Projekt: eigene Neon-Ressource über die Vercel-Integration (Free-Plan, Region Frankfurt, falls wählbar), ausschliesslich für dieses Projekt. Keine bestehende Kunden- oder Projektdatenbank wird verwendet oder verändert.
  - R38: Schutz des Deployments: bevorzugt Vercel Password Protection, falls im Team ohne Zusatzkosten verfügbar; sonst Vercel Authentication (Standard Protection) für alle Deployments inklusive Production-URL. Es wird nichts Kostenpflichtiges gebucht. Ist kein Schutz sicher aktivierbar, bleibt das Deployment aus.
  - R39: Demo-Zugangsdaten sind synthetisch (`*@demo.qm.test`), das Demo-Passwort ist ein bekanntes Demo-Passwort und steht in der README; das ist akzeptabel, weil das Deployment hinter dem Vercel-Schutz liegt und keine realen Daten enthält. Für das Deployment wird ein eigenes, zufälliges Demo-Passwort erzeugt und nur im Morning-Report (nicht im Repo) genannt.
  - R40: Preview-Deployments des Branches bleiben ebenfalls geschützt (Schutz gilt für alle Deployments).
- Build-Maschine bleibt `standard`; kein `vercel deploy` aus dem lokalen Verzeichnis, Deploy nur per Git-Push über die Integration.

## Review Focus

1. Ein anonymer `POST /api/auth/sign-up/email` auf die Laufzeit-Instanz scheitert, ebenso das Anlegen einer Organisation; Anmeldung mit bestehendem Demo-Konto funktioniert weiter (Task 1).
2. Die App-Rolle kann `audit_event` und `document_version` weder ändern noch löschen noch leeren, kann keine Tabelle verändern und keinen Trigger abschalten, kann aber alle normalen App-Operationen ausführen (Task 2).
3. Die vollständige Testsuite läuft weiter mit der Besitzerrolle, und zusätzlich läuft ein Teil der Integrationstests mit der App-Rolle (Task 2).
4. Kein Secret im Repo oder in der Historie der neuen Commits (Task 3).
5. Das Deployment ist anonym nicht erreichbar (Task 5).

## File Structure

```
qm/
  src/auth/auth.ts                      makeAuth-Fabrik, Laufzeit-Instanz `auth` mit disableSignUp
  src/auth/seed-auth.ts                 Instanz mit Registrierung für Seed und Tests
  db/roles.sql                          idempotente Rollen- und Rechtedefinition (Passwort als psql-Variable)
  scripts/apply-roles.ts                führt roles.sql mit dem Besitzer aus
  src/db/runtime-role.test.ts           Integrationstest mit der App-Rolle
  src/auth/registration.test.ts         Registrierung aus, Guard gegen Import des Seed-Auth
  README.md                             Betriebsmodell: Rollen, Env, Deploy, Schutz
  docs/security/secrets-scan.md         Ergebnis der Prüfung (ohne Werte)
```

---

### Task 1: Registrierung abschalten, Seed kontrolliert

**Files:**
- Modify: `qm/src/auth/auth.ts`, `qm/src/seed/demo.ts`, Tests und Hilfsfunktionen, die `auth.api.signUpEmail` nutzen (`grep -rn signUpEmail qm/src qm/scripts`)
- Create: `qm/src/auth/seed-auth.ts`, `qm/src/auth/registration.test.ts`

**Interfaces:**
- Produces: `makeAuth(opts: { disableSignUp: boolean })` (Fabrik mit allen bisherigen Optionen), `auth = makeAuth({ disableSignUp: true })` (Laufzeit), `seedAuth = makeAuth({ disableSignUp: false })` in `seed-auth.ts`.

- [ ] **Step 1: Failing tests** `registration.test.ts`:
  1. `auth.handler(new Request("http://localhost:3000/api/auth/sign-up/email", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000" }, body: JSON.stringify({ email: "x@example.test", password: "Correct-Horse-1", name: "X" }) }))` liefert einen 4xx-Status, und es existiert danach kein `user` mit dieser E-Mail.
  2. Ein per `seedAuth` angelegter Demo-User kann sich über `auth.api.signInEmail` anmelden (Laufzeit-Instanz, gleiche Datenbank, gleiches Secret) und hat danach eine Session.
  3. Organisation anlegen: ein angemeldeter Nutzer (Session-Header über `signInEmail` mit `asResponse`/`returnHeaders` oder `auth.api.createOrganization` mit Headern) scheitert (`allowUserToCreateOrganization: false`).
  4. Guard-Test: Keine Datei unter `qm/src` ausser `seed-auth.ts`, `src/seed/**`, `scripts/**` und `*.test.ts` importiert `seed-auth`.
  Run: `pnpm test src/auth/registration.test.ts` → FAIL.
- [ ] **Step 2: Implementation.** In `auth.ts` die bestehende Konfiguration in `makeAuth(opts)` verschieben (`emailAndPassword: { enabled: true, disableSignUp: opts.disableSignUp, requireEmailVerification: false }`), `export const auth = makeAuth({ disableSignUp: true })`. `seed-auth.ts`: `import "server-only"` NICHT verwenden (Tests laufen ohne Next); stattdessen Kommentar, dass nur Seed und Tests importieren. Alle bisherigen Aufrufer von `auth.api.signUpEmail` (Seed, Test-Helper, `auth.test.ts`, `session-hook.test.ts`) auf `seedAuth` umstellen. `createOrganization` mit `userId` ohne Session (Server-Aufruf) funktioniert weiter über `auth` oder `seedAuth`.
- [ ] **Step 3: Verifikation und Commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`. Zusätzlich lokal: Dev-Server, `curl -s -o /dev/null -w "%{http_code}" -X POST -H "content-type: application/json" -H "origin: http://localhost:3100" -d '{"email":"x@y.test","password":"Correct-Horse-1","name":"X"}' http://localhost:3100/api/auth/sign-up/email` ist 4xx, Login mit `owner@demo.qm.test` funktioniert weiter.

```bash
git add qm/ && git commit -m "feat(qm): disable public registration at runtime and keep a seed-only auth instance"
```

---

### Task 2: Eingeschränkte Datenbankrolle

**Files:**
- Create: `qm/db/roles.sql`, `qm/scripts/apply-roles.ts`, `qm/src/db/runtime-role.test.ts`
- Modify: `qm/package.json` (Script `db:roles`), `qm/vitest.global-setup.ts` (Rolle in der Test-DB anlegen), `qm/.env.example`, `qm/README.md`

**Interfaces:**
- Produces: Rolle `qm_app`; Skript `pnpm db:roles` (liest `DATABASE_URL_DIRECT` für den Besitzer und das Passwort aus `QM_APP_PASSWORD`; beide aus der Umgebung, nie aus Dateien im Repo); Testumgebungsvariable `TEST_APP_DATABASE_URL`.

`roles.sql` (idempotent; Passwort wird per `psql -v` bzw. als Parameter gesetzt, nie im Dateitext):

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'qm_app') THEN
    CREATE ROLE qm_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;
-- Passwort wird vom Skript nach dem Anlegen gesetzt (ALTER ROLE qm_app PASSWORD ...), nie hier.
GRANT USAGE ON SCHEMA public TO qm_app;
REVOKE CREATE ON SCHEMA public FROM qm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO qm_app;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_event FROM qm_app;
REVOKE UPDATE, DELETE, TRUNCATE ON document_version FROM qm_app;
REVOKE DELETE ON measure FROM qm_app;  -- Massnahmen werden nie gelöscht (R31, R45, R48)
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM qm_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO qm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO qm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO qm_app;
```

Wichtig: Spätere Tabellen erben über `DEFAULT PRIVILEGES` die vollen Rechte; die Ausnahmen für `audit_event` und `document_version` stehen im Skript NACH dem Anlegen und werden bei jedem Lauf erneut erzwungen. Neue unveränderliche Tabellen müssen hier ergänzt werden (Kommentar im SQL).

- [ ] **Step 1: Failing test** `runtime-role.test.ts` (verbindet sich mit `TEST_APP_DATABASE_URL` über einen eigenen `pg.Pool`): (a) `INSERT` in `audit_event` und `document_version` (mit gültigen Daten, über den Besitzer-Pool vorbereitete Organisation/Dokument) gelingt; (b) `UPDATE`, `DELETE`, `TRUNCATE` auf `audit_event` und `document_version` scheitern mit `permission denied` (Fehlertext prüfen); (c) `TRUNCATE` auf irgendeiner Tabelle scheitert; (d) `CREATE TABLE`, `ALTER TABLE criterion ADD COLUMN`, `DROP TABLE document` scheitern; (e) `ALTER TABLE audit_event DISABLE TRIGGER ALL` scheitert (nur Besitzer); (f) normale Operationen gelingen: `INSERT`/`UPDATE`/`DELETE` auf `deadline`, `evidence_link`, `session`; `INSERT`/`UPDATE` (aber kein `DELETE`) auf `measure`; `SELECT ... FOR UPDATE` auf `document`, `evidence_link`, `criterion_assessment`, `measure` gelingt (die Services sperren genau diese Tabellen); `SELECT` auf alle Tabellen; (g) die Rolle ist weder Superuser noch Tabellenbesitzer (`select rolsuper from pg_roles ...`, `select tableowner from pg_tables ...`); (h) die CHECK-Constraints wirken auch für die Rolle (n/a ohne Begründung wird abgelehnt). Zusätzlich ein Smoke-Test, der den Kern-Service mit der App-Rolle ausführt: `setAssessmentStatus`, `createDocument`, `getDashboard` über eine zweite `drizzle`-Instanz auf dem App-Pool (die Services importieren `db` aus `@/db`: dafür den Pool über `DATABASE_URL` in einem separaten Testlauf mit `vitest --env`? Einfacher und ausreichend: die SQL-Operationen der Services stichprobenartig direkt mit dem App-Pool ausführen; die vollständige Suite läuft weiter als Besitzer).
- [ ] **Step 2: Implementation.** `vitest.global-setup.ts`: nach den Migrationen `roles.sql` mit dem Besitzer ausführen und `ALTER ROLE qm_app PASSWORD 'test-app-password'` setzen (nur Test-DB, lokaler Wegwerfwert); `TEST_APP_DATABASE_URL` aus `TEST_DATABASE_URL` ableiten (Benutzer `qm_app`). `scripts/apply-roles.ts`: liest `DATABASE_URL_DIRECT` und `QM_APP_PASSWORD` aus der Umgebung, führt die SQL-Datei aus, setzt das Passwort per parametrisiertem `ALTER ROLE` (Passwort mit `format('%L')` quoten), meldet «Rolle qm_app bereit». Script `db:roles` in `package.json`. README: Betriebsmodell (Besitzer nur für Migrationen und `db:roles`, `qm_app` für `DATABASE_URL`, Vercel-Variablen, Passwortwechsel, Hinweis auf neue unveränderliche Tabellen).
- [ ] **Step 3: Verifikation und Commit.** `pnpm test && pnpm typecheck && pnpm lint && pnpm build`; lokal `QM_APP_PASSWORD=... pnpm db:roles` gegen `qm_dev` und eine manuelle Stichprobe: `psql "postgres://qm_app:...@localhost:5437/qm_dev" -c "update audit_event set event_type='x'"` schlägt fehl.

```bash
git add qm/ && git commit -m "feat(qm): add a restricted runtime database role with immutable audit and document versions"
```

---

### Task 3: Secrets- und Repo-Prüfung

**Files:**
- Create: `qm/docs/security/secrets-scan.md` (Ergebnis ohne Werte)
- Modify: nur bei Funden

- [ ] **Step 1:** Prüfen und dokumentieren: (a) `git ls-files qm | xargs grep -n -i -E "(api[_-]?key|secret|token|password|passwd|postgres://[^ ]*:[^ ]*@)"` über alle neuen Commits (`git diff 18c5b92..HEAD`), jeder Treffer klassifiziert (Platzhalter, Testwert, Beispiel, echter Wert); (b) `git log --all --diff-filter=A --name-only -- '*.env*' 'qm/.env*'` zeigt nur `.env.example`; (c) kein echter Wert in `README.md`, Seed, Tests, Fixtures (Demo-Passwort und Test-Wegwerfwerte sind erlaubt und als solche gelistet); (d) `.gitignore` deckt `.env*` (ausser `.env.example`), `.vercel`, `/tmp`-Dateien; (e) Next-Build-Ausgabe und Logs enthalten keine Werte.
- [ ] **Step 2:** Bei Fund: Wert entfernen, wenn er echt war Rotation im Report vermerken (nicht im Repo). Befundbericht in `secrets-scan.md` (Tabelle: Datei, Treffer-Art, Bewertung). Commit `docs(qm): record the secrets scan`.

---

### Task 4: Fehlerzustände und Härtung quer durch die App

**Files:** je nach Befund; Tests ergänzen.

Systematische Matrix (jede Zeile ein Test oder ein dokumentierter Browser-Nachweis, erwartbare Eingaben liefern nie 500 und immer verständliche deutsche Meldung):

| Fall | Erwartung |
|---|---|
| ungültiger Upload (falsche Endung, falscher Inhalt, leer, zu gross) | Meldung, nichts gespeichert, kein Audit-Event |
| «Nicht anwendbar» ohne oder mit zu kurzer Begründung | Meldung, Eingaben bleiben stehen |
| ungültiges Datum (Frist, Ablaufdatum, Massnahme) | Meldung vor dem Schreiben |
| fremde ID (Dokument, Version, Verknüpfung, Massnahme, Kriterium) | «nicht gefunden», nichts geändert, identische Meldung wie bei unbekannter ID |
| Rolle ohne Recht (viewer schreibt, reviewer liest Audit) | Meldung bzw. Bereich fehlt, serverseitig geprüft |
| nicht vorhandene Ressource (`/criteria/9.9.9`, `/documents/versions/nicht-uuid`) | 404-Seite bzw. 404 |
| gleichzeitiges Speichern | konsistente Audit-Kette |
| Session abgelaufen / ungültiges Cookie | Weiterleitung auf `/login`, keine Daten |
| Fehlerseiten | `error.tsx` und `not-found.tsx` mit deutscher Meldung, ohne Stacktrace |

- [ ] **Step 1:** fehlende Tests ergänzen (Service- und Eingabeschicht; Browser-Nachweise per Headless-Chromium für Formulare), fehlende Fehlerseiten (`src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/global-error.tsx` nach Next-16-Vorgabe) bauen, im Designsystem, ohne Tech-Details. **Step 2:** `pnpm test && pnpm typecheck && pnpm lint && pnpm build`. Commit `fix(qm): harden error states and add German error pages`.

---

### Task 5: Vercel-Projekt, Datenbank, Schutz, Deploy, Smoke-Test (Controller-Aufgabe)

Diese Task führt der Controller selbst aus (Zugriffe ausserhalb des Repos, jede Aktion wird im Ledger protokolliert).

- [ ] **Step 1: Vorbedingungen.** Alle Tests, Typecheck, Lint und Build grün; Tasks 1 bis 3 abgeschlossen; Branch gepusht.
- [ ] **Step 2: Projekt.** `vercel project add qm-rettungsdienst-demo` (Name ist ein Infrastrukturlabel, kein Produktname). Mit dem GitHub-Repo verbinden (`vercel git connect https://github.com/brainbytes-dev/thomato.git` im verlinkten Verzeichnis), Root Directory `qm`, Framework Next.js, Production Branch bleibt `main` (Preview-Deployments des Branches `feat/qm-foundation` sind der Demo-Stand; für eine stabile URL wird der Branch-Alias des Previews verwendet, siehe Step 6), Build-Maschine `standard`, Region `fra1` (Funktionen).
- [ ] **Step 3: Datenbank.** Neue Neon-Ressource über die Vercel-Integration auf das Projekt: `vercel integration add neon` im Projektkontext (Free-Plan; falls der Dialog einen kostenpflichtigen Plan verlangt: STOPP, nichts buchen, im Report als Blocker festhalten). Die Integration setzt `DATABASE_URL` (Besitzer, gepoolt) und `DATABASE_URL_UNPOOLED` bzw. ähnlich. Den Besitzer-Direktwert nur per `vercel env pull /tmp/qm-env-<zufall>` in eine Datei ausserhalb des Repos holen.
- [ ] **Step 4: Migration, Rolle, Seed.** Mit der Besitzer-Direkt-URL aus der Datei: `DATABASE_URL_DIRECT=<owner direct> pnpm db:migrate`; Katalog und Demo-Seed gegen die Neon-Datenbank: der Seed verweigert Nicht-localhost-Datenbanken (Guard). Für diesen einmaligen kontrollierten Lauf `ALLOW_DEMO_RESET_REMOTE=1` und `--yes-reset` setzen (Datenbank ist neu und leer, ausschliesslich Demo, R37), Demo-Passwort aus einem zufällig erzeugten Wert (`QM_DEMO_PASSWORD`, siehe Anpassung unten) statt dem Repo-Wert; `QM_APP_PASSWORD` zufällig erzeugen (`openssl rand -base64 24`), `pnpm db:roles` ausführen. Danach `DATABASE_URL` des Projekts (Production und Preview) auf die `qm_app`-Verbindung (gepoolt) setzen, `DATABASE_URL_DIRECT` ebenfalls als Vercel-Variable nur falls nötig (Laufzeit braucht sie nicht; nicht setzen).
  Anpassung: `seedDemo` liest ein optionales `QM_DEMO_PASSWORD` aus der Umgebung (Standard bleibt das Repo-Demo-Passwort für lokale Entwicklung); im Seed-Skript ausgeben wird es nur in der Konsole, nicht ins Repo.
- [ ] **Step 5: Variablen.** `BETTER_AUTH_SECRET` (zufällig, 32 Byte), `BETTER_AUTH_URL` (Produktions-/Branch-URL; bei Preview-URLs `trustedOrigins` über `VERCEL_URL`/`VERCEL_BRANCH_URL` ergänzen, falls Login sonst am Origin-Check scheitert: im Code per Umgebung, nicht hartcodiert), `NEXT_TELEMETRY_DISABLED=1`. Werte per `vercel env add NAME production|preview < wert-datei` aus Dateien in `/tmp`, danach löschen.
- [ ] **Step 6: Schutz.** Zuerst prüfen, ob Password Protection ohne Aufpreis im Team verfügbar ist (Einstellungen des Projekts per `vercel project inspect`/API); sonst `Vercel Authentication` für «All Deployments» aktivieren (Projekt-Setting `ssoProtection: { deploymentType: "all" }` per REST-API `PATCH /v9/projects/<id>` mit dem lokal angemeldeten CLI-Token über `vercel api`, falls verfügbar). Danach UNVERZÜGLICH verifizieren, dass eine anonyme Anfrage (`curl -s -o /dev/null -w "%{http_code}" <url>`) 401/403 (Vercel-Login-Seite) liefert. Erst nach bestandener Verifikation wird der erste Deploy ausgelöst bzw. die URL verwendet. Ist die Verifikation nicht bestanden: Projekt-Deployments löschen/deaktivieren, Blocker melden.
- [ ] **Step 7: Deploy.** Branch pushen (löst den Preview-Build der Integration aus). Build-Log und Status per `vercel inspect`/`vercel logs` prüfen. Fehler beheben (Build ohne `.env`-Abhängigkeit ist belegt).
- [ ] **Step 8: Smoke-Test.** (a) anonym: `curl` der Deployment-URL und der Branch-URL: 401/403 bzw. Vercel-Schutzseite (Incognito = frischer Browserkontext ohne Cookies per Headless-Chromium: Seite zeigt den Vercel-Login, nicht die App); (b) authentifiziert: Zugriff auf die geschützte URL mit einem Bypass für Automatisierung (`x-vercel-protection-bypass`-Header mit einem im Projekt erzeugten Automation-Bypass-Secret, nur für den Test, danach widerrufen) oder über einen `vercel curl`/Shareable-Link-Mechanismus; dann Login als `owner`, Dashboard, Action Center, Kriterienliste, Filter, Detail, Nachweise (Upload einer kleinen PDF, neue Version), Massnahmen, Verlauf, Rollen (`qm_admin`, `reviewer`, `viewer`), Light und Dark, Konsole ohne Fehler, `vercel logs` ohne Fehler; Sign-up-Endpunkt gegen die geschützte URL: 4xx.
- [ ] **Step 9: Dokumentation.** README (Betriebsmodell, Projekt, Schutzmethode, Variablenliste ohne Werte), Ledger. Kein Merge nach `main`.

---

## Abschluss Plan 5 (Definition of Done)

- Registrierung im Laufzeitcode aus, belegt durch Tests und Deployment-Test; Seed kontrolliert.
- Laufzeit mit `qm_app`; Audit und Dokumentversionen für die Rolle unveränderlich, belegt durch Tests und Stichprobe auf dem Deployment.
- Secrets-Scan dokumentiert.
- Fehlerzustände ohne 500er für erwartbare Eingaben, deutsche Fehlerseiten.
- Geschütztes Deployment mit belegter anonymer Blockade und erfolgreichem authentifiziertem Smoke-Test, oder ein exakt dokumentierter Blocker ohne öffentlich erreichbare App.

## Self-Review (vom Plan-Autor durchgeführt)

- **Spec-Abdeckung:** Nachtauftrag Abschnitte 10 (Registrierung), 11 (Rolle), 12 (Security-Review: Tenant/IDOR in den Tests der Pläne 4 und 4b, Upload in Plan 4, Secrets in Task 3), 13 bis 15 (Projekt, Schutz, Smoke-Test), 16 (Fehlerzustände in Task 4).
- **Risiken:** Neon-Plan und Vercel-Schutz hängen vom Konto ab (Stopp-Regeln im Plan); Preview-URL-Origin für Better Auth (trustedOrigins); Rollenpasswort darf nie im Repo landen.
