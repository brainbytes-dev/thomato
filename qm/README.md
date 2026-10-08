# QM Rettungsdienst

Arbeitstitel, definiert in `src/brand.ts`. Next.js-App mit lokaler Postgres-Datenbank. Paketmanager: pnpm.

## Setup

```bash
pnpm install
cp .env.example .env
# BETTER_AUTH_SECRET in .env mit `openssl rand -base64 32` füllen
docker compose up -d db
pnpm test
```

Datenbanken prüfen (erwartet `qm_dev` und `qm_test`):

```bash
docker compose exec db psql -U qm -d qm_dev -c '\l'
```

## Skripte

`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:roles`.

## Deployment (Vercel + Neon)

Vercel-Projekt mit Root Directory `qm`. Deploy ausschliesslich über die Git-Integration. Der Build (`pnpm build`) läuft auch ohne Umgebungsvariablen durch (Better Auth meldet dann nur Warnungen), die Variablen müssen aber zur Laufzeit gesetzt sein.

| Variable | Verwendung | Wert |
| --- | --- | --- |
| `DATABASE_URL` | App zur Laufzeit (`src/db/index.ts`) | Neon **Pooled**-URL (Host mit `-pooler`) mit Benutzer **`qm_app`** (eingeschränkte Rolle, nicht der Besitzer) |
| `DATABASE_URL_DIRECT` | Migrationen, `db:roles`, Seed (`drizzle.config.ts`) | Neon **Direct**-URL (ohne Pooler) mit dem **Besitzer** |
| `QM_APP_PASSWORD` | nur `pnpm db:roles` | Passwort der Rolle `qm_app`; wird nicht in Vercel gesetzt, nur lokal im Terminal des Betreibers |
| `BETTER_AUTH_SECRET` | Session-Signatur (`src/auth/auth.ts`) | `openssl rand -base64 32`, pro Umgebung eigenes Secret |
| `BETTER_AUTH_URL` | Basis-URL für Callbacks und Redirects | öffentliche URL der Umgebung, z. B. `https://...vercel.app` |

`DATABASE_URL`, `DATABASE_URL_DIRECT`, `BETTER_AUTH_SECRET` und `BETTER_AUTH_URL` in Vercel für **Preview und Production** setzen (`QM_APP_PASSWORD` nicht). `TEST_DATABASE_URL` wird nur lokal für Tests gebraucht.

Migrationen laufen manuell, nicht im Build, und gegen die Direct-URL:

```bash
DATABASE_URL_DIRECT=<direct-url> pnpm db:migrate
```

### Registrierung

Die öffentliche Registrierung ist im Code abgeschaltet (`disableSignUp: true` in `src/auth/auth.ts`), es gibt keinen Env-Schalter. `POST /api/auth/sign-up/email` antwortet mit 400, `POST /api/auth/organization/create` mit 403. Nutzer und Organisationen legt nur der Betreiber an: Seed-Nutzer entstehen über die Seed-Instanz in `src/auth/seed-auth.ts` (gleiche Datenbank und gleiches Secret). Diese Datei importieren ausschliesslich Seed, Skripte und Tests; ein Guard-Test (`src/auth/registration.test.ts`) erzwingt das, damit sie nicht im Produktions-Bundle landet.

### Betriebsmodell: Besitzer und Laufzeitrolle

Zwei Datenbankrollen mit getrennten Aufgaben (R36, R48, R49):

- **Besitzer** (`DATABASE_URL_DIRECT`): Migrationen, `pnpm db:roles`, Seed (inklusive `TRUNCATE`). Nur lokal beim Betreiber, nie in der laufenden App.
- **`qm_app`** (`DATABASE_URL`, gepoolt): Laufzeit der App. `SELECT`, `INSERT`, `UPDATE`, `DELETE` auf die Tabellen mit Ausnahmen: `audit_event` und `document_version` nur `SELECT` und `INSERT`, `measure` ohne `DELETE`, nirgends `TRUNCATE`, kein `CREATE`/`ALTER`/`DROP`, kein Zugriff auf das Schema `drizzle`. Die Rolle ist kein Besitzer und kann die Unveränderlichkeits-Trigger nicht abschalten.

Rolle anlegen oder aktualisieren (idempotent, Passwort nur aus der Umgebung, nie im Repo):

```bash
DATABASE_URL_DIRECT=<owner-direct-url> QM_APP_PASSWORD=<passwort> pnpm db:roles
```

`db:roles` liest beide Werte **ausschliesslich aus der Prozessumgebung** (kein `.env`), bricht ab, wenn die URL einen Pooler (`-pooler`) oder den Benutzer `qm_app` enthält, und gibt vor dem Lauf Host und Datenbankname aus (nie das Passwort). Das Passwort geht nicht im Klartext an den Server: das Skript berechnet den SCRAM-SHA-256-Verifier lokal, damit nichts in Server-Logs landet. `roles.sql` braucht keine Superuser-Rechte (läuft mit `CREATEROLE`, wie `neondb_owner`); eine bereits vorhandene, zu mächtige Rolle `qm_app` (Superuser, CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS) lässt den Lauf abbrechen statt still zu überschreiben.

**Produktionsablauf nach jeder Schemaänderung:** `DATABASE_URL_DIRECT=<owner-direct-url> QM_APP_PASSWORD=<passwort> pnpm db:deploy` (= `db:migrate` gegen die Direct-URL, danach `db:roles`).

Regeln:

- **Nach jeder Migration `pnpm db:roles` ausführen.** Die Rechte (inklusive der Ausnahmen) werden dabei jedes Mal neu erzwungen.
- Default-Privilegien für künftige Tabellen gelten nur für Objekte, die die ausführende Rolle anlegt. Migrationen und `db:roles` müssen deshalb mit demselben Besitzer laufen.
- Neue unveränderliche Tabellen müssen im Block «Ausnahmen» in `db/roles.sql` ergänzt werden; sonst erhalten sie volle Rechte.
- **Passwortwechsel:** `pnpm db:roles` mit neuem `QM_APP_PASSWORD` ausführen, danach `DATABASE_URL` in Vercel (Preview und Production) auf das neue Passwort setzen und neu deployen. Zwischen beiden Schritten schlagen neue Verbindungen der App fehl; im Wartungsfenster ausführen.
- **Benutzer löschen:** Löschen ist blockiert: Fremdschlüssel (`audit_event`, `document`, `measure` u. a.) verhindern das Löschen eines Benutzers, und die Rolle `qm_app` darf Massnahmen und Audit-Ereignisse ohnehin nicht löschen. Vorgehen: Benutzer anonymisieren (Name und E-Mail ersetzen, Sessions und Konten löschen, Mitgliedschaft entfernen), nicht löschen.
- Die Tests laufen als Besitzer. `vitest.global-setup.ts` legt `qm_app` in `qm_test` mit einem Wegwerf-Passwort an; `src/db/runtime-role*.test.ts` prüfen die Rechte und die Kern-Services mit der Rolle.

### Stand des Demo-Deployments

- Vercel-Projekt `qm-rettungsdienst-demo` (Root Directory `qm`, Build Machine `standard`, Funktionsregion `fra1`, Elastic Concurrency aus). Deployments laufen nur über die Git-Integration (Push auf `main` für die Demo).
- Schutz: Vercel Authentication für **alle** Deployments (alle Deployments). Anonyme Aufrufe werden auf die Vercel-Anmeldung umgeleitet; das Passwortschutz-Add-on wird nicht verwendet.
- Datenbank: Neon (Free-Plan, Region Frankfurt, über die Vercel-Integration). Die Laufzeit nutzt ausschliesslich die Rolle `qm_app` über den Pooler; Besitzer-Zugangsdaten sind aus den Projekt-Umgebungsvariablen entfernt und liegen nur lokal ausserhalb des Repos.
- Umgebungsvariablen im Projekt: `DATABASE_URL` (qm_app, gepoolt, `sslmode=verify-full`), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (Production, stabiler Alias `https://qm-rettungsdienst-demo.vercel.app`). Auf Neon lehnt die Control Plane vorberechnete Passwort-Verifier ab, deshalb setzt `db:roles` dort das Passwort im Klartext über TLS (automatischer Rückfall).
- Demo-Passwort: wird beim Seeden aus `QM_DEMO_PASSWORD` gesetzt und steht nicht im Repo. Seed gegen das Deployment: `DATABASE_URL`/`DATABASE_URL_DIRECT` auf die Besitzer-Direct-URL, `ALLOW_DEMO_RESET_REMOTE=1`, `pnpm seed:demo -- --yes-reset`.
- Die Anwendung darf nur über den Alias aufgerufen werden, weil `BETTER_AUTH_URL` die erlaubte Herkunft festlegt.

## Browser-Smoke-Test

`scripts/smoke/demo_story.py` spielt die Demo-Story mit Playwright (Python 3, Sync-API) im Browser durch: Login als Owner, veralteter Nachweis zu 7.3.10, neue Version hochladen, Dashboard, Stand auf «Erfüllt». Pro Schritt eine PASS/FAIL-Zeile, Exit-Code ungleich 0 bei Fehlern, Screenshots in `OUT_DIR`.

Das Skript **verändert Daten** (zusätzliche Version, geänderter Stand). Es erwartet eine frisch geseedete Datenbank und danach ein erneutes `pnpm seed:demo -- --yes-reset`.

| Variable | Bedeutung | Standard |
| --- | --- | --- |
| `BASE_URL` | laufende App | `http://localhost:3100` |
| `QM_EMAIL` | Login | `owner@demo.qm.test` |
| `QM_PASSWORD` | Passwort des Demo-Seeds | `Demo-QM-2026` |
| `CHROMIUM_PATH` | optionaler Pfad zur Chromium-Binärdatei | Playwright-Standard |
| `OUT_DIR` | Verzeichnis für Screenshots | temporäres Verzeichnis |
| `EXTRA_HTTP_HEADERS` | optional, JSON, z. B. für Protection-Bypass-Header | keine |
| `SMOKE_ALLOW_MUTATION` | auf `1` setzen, um ein nicht lokales `BASE_URL` zu erlauben | nicht gesetzt |

Schutz vor Versehen: Ist der Host von `BASE_URL` nicht `localhost`, `127.0.0.1` oder `::1`, bricht das Skript vor dem ersten Request mit Exit-Code 2 ab, ausser `SMOKE_ALLOW_MUTATION=1` ist gesetzt. Nach einem Lauf gegen ein freigegebenes Ziel ist ein erneutes Seeden nötig (hochgeladene Version, 7.3.10 auf «Erfüllt»).

```bash
BETTER_AUTH_URL=http://localhost:3100 pnpm exec next dev -p 3100   # in einem zweiten Terminal
python3 scripts/smoke/demo_story.py
```

Hinweis: `main` ist der Production-Branch des Vercel-Projekts; die Demo läuft als Production-Deployment unter dem kurzen Alias oben. Feature-Branches bekommen eigene, ebenfalls geschützte Previews (eigene `BETTER_AUTH_URL` und Datenbank pro Branch, siehe ACCESS.md).
