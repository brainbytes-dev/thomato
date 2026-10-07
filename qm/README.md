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

`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm db:generate`, `pnpm db:migrate`.

## Deployment (Vercel + Neon)

Vercel-Projekt mit Root Directory `qm`. Deploy ausschliesslich über die Git-Integration. Der Build (`pnpm build`) läuft auch ohne Umgebungsvariablen durch (Better Auth meldet dann nur Warnungen), die Variablen müssen aber zur Laufzeit gesetzt sein.

| Variable | Verwendung | Wert |
| --- | --- | --- |
| `DATABASE_URL` | App zur Laufzeit (`src/db/index.ts`) | Neon **Pooled**-URL (Host mit `-pooler`) |
| `DATABASE_URL_DIRECT` | Migrationen (`drizzle.config.ts`) | Neon **Direct**-URL (ohne Pooler) |
| `BETTER_AUTH_SECRET` | Session-Signatur (`src/auth/auth.ts`) | `openssl rand -base64 32`, pro Umgebung eigenes Secret |
| `BETTER_AUTH_URL` | Basis-URL für Callbacks und Redirects | öffentliche URL der Umgebung, z. B. `https://...vercel.app` |

Alle vier in Vercel für **Preview und Production** setzen. `TEST_DATABASE_URL` wird nur lokal für Tests gebraucht.

Migrationen laufen manuell, nicht im Build, und gegen die Direct-URL:

```bash
DATABASE_URL_DIRECT=<direct-url> pnpm db:migrate
```

### Audit-Trigger vor Produktion

`audit_event` ist per Trigger append-only. Eine DB-Rolle mit `ALTER`- oder `DISABLE TRIGGER`-Rechten kann ihn aushebeln. Vor dem Produktivbetrieb:

- App-Rolle (in `DATABASE_URL`): nur `INSERT` und `SELECT` auf `audit_event`, keine Owner-Rechte.
- Migrationen mit einer separaten Owner-Rolle (in `DATABASE_URL_DIRECT`).
