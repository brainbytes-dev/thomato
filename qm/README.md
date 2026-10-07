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
