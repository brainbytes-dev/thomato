# Secrets-Scan (Stand 2026-10-08)

Geltungsbereich: Branch `feat/qm-foundation`, gesamte Git-Historie (`--all`), alle getrackten Dateien in `qm/`, `docs/` und `web/`, sowie die Next-Build-Ausgabe. Werte stehen bewusst nirgends in diesem Dokument, nur Datei, Zeile und Klasse.

**Ergebnis: 0 echte Funde. Keine Rotation nötig.**

## Befunde

| Datei | Treffer-Art | Bewertung |
|---|---|---|
| `qm/.env.example:1,2,7` | Postgres-URL mit `qm:qm@localhost:5437` | Beispiel, Docker-Compose-Defaults, kein echter Wert |
| `qm/.env.example:5,8` | `QM_APP_PASSWORD=`, `BETTER_AUTH_SECRET=` | Platzhalter, leer |
| `qm/docker-compose.yml:6` | `POSTGRES_PASSWORD: qm` | Wegwerfwert der lokalen Entwicklungs-DB |
| `qm/src/seed/demo.ts:22`, `qm/scripts/smoke/demo_story.py:28`, `qm/README.md:81` | Demo-Passwort `Demo-QM-2026` | Erlaubt, öffentliches Demo-Passwort |
| `qm/vitest.config.mts:19` | `BETTER_AUTH_SECRET` im Test-Env | Testwert, Wegwerf (erlaubt) |
| `qm/vitest.app-role.mts:2` | `TEST_APP_PASSWORD` | Testwert, Wegwerf (erlaubt) |
| `qm/src/auth/auth.test.ts:16`, `registration.test.ts:11`, `session-hook.test.ts:9`, `measures.test.ts:330` | Test-Passwörter | Testwerte, Wegwerf (erlaubt) |
| `qm/src/seed/reset-guard.test.ts:4,5` | Postgres-URLs `u:p@...` (lokal und Neon-Hostmuster) | Testfixtures mit Fantasie-Zugangsdaten, kein echter Host |
| `qm/README.md:10,33,34,37,59,67` | Nennung der Variablennamen, `<passwort>`, `<owner-direct-url>` | Platzhalter in Doku |
| `qm/scripts/apply-roles.ts`, `scripts/roles-lib.ts`, `db/roles.sql:2` | Passwort wird nur aus der Umgebung gelesen | Code, kein Wert; SQL-Kommentar bestätigt, dass kein Passwort im Repo steht |
| `qm/scripts/seed-demo.ts:19` | Gibt Demo-Mail und Demo-Passwort auf die Konsole aus | Erlaubt, nur Demo-Seed; echte Passwörter fliessen hier nicht ein |
| `qm/src/db/schema/auth.ts`, `drizzle/**` | Spaltennamen `password`, `token`, `access_token` | Schema, keine Werte |
| `qm/src/db/runtime-role.test.ts:168` | Test-Insert einer Session mit Token-Parameter | Testcode, Wert wird zur Laufzeit generiert |
| `qm/src/test/helpers.ts`, `measure-input.test.ts` (Hochentropie-Heuristik) | Alphabet-Konstante, Test-ID-Konstante | Falsch-Positiv, keine Secrets |
| `docs/superpowers/plans/*.md` (Hochentropie-Heuristik) | Dateinamen von Spec-Dokumenten | Falsch-Positiv |
| `docs/superpowers/plans/2026-10-07-qm-foundation.md:189,638,1504` | Kopie der Test- und Demo-Werte im Plan | Erlaubt (siehe oben) |
| `web/.env.example` | Beispieldatei der Web-App | Nur Beispiel, getrackt, keine Werte gefunden |
| `qm/.env` (lokal, ungetrackt) | Enthält `DATABASE_URL`, `DATABASE_URL_DIRECT`, `TEST_DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Ignoriert (`qm/.gitignore:34`), Hosts sind `localhost`; nie committet |

## Prüfpunkte

| Prüfung | Ergebnis |
|---|---|
| Env-Dateien in der gesamten Historie (`--all`, hinzugefügte Dateien) | Nur `qm/.env.example` und `web/.env.example` |
| Getrackte Dateien mit `.env`, `.pem`, `.key`, `.vercel`, `tmp/` im Namen | Nur die beiden `.env.example` |
| Historie, hinzugefügte Zeilen: Postgres-URL mit Passwort und Fremdhost, `sk-`, `AKIA`, `ghp_`/`gho_`/`ghs_`/`ghu_`, `xox*`, `BEGIN PRIVATE KEY`, `npg_`, Blob-Token | 0 Treffer (Neon-Hostmuster nur in `reset-guard.test.ts`, Fantasie-Zugang) |
| Historie, Strings ab 32 Zeichen mit Gross/Klein/Ziffer in `qm/` und `docs/` | 7 Treffer, alle Falsch-Positive (siehe Tabelle) |
| `.gitignore`-Abdeckung `qm/` | `.env*` (ausser `.env.example`), `.vercel`, `*.pem`, `/node_modules`, `/.next/` greifen (per `git check-ignore -v` belegt). Es gibt keine Regel für `tmp/`; das Verzeichnis existiert nicht, Hinweis unten |
| `.gitignore`-Abdeckung `web/` | `web/.gitignore` deckt `.env*` und `.vercel` |
| Repo-Root `.gitignore` | Enthält nur `.DS_Store`, `__pycache__/`, `*.pyc`. Kein `.env*`, kein `.vercel`, kein `*.pem` im Root; `qm/` und `web/` schützen sich jeweils selbst |
| Build `pnpm build` (qm), Werte aus `qm/.env` (Länge ab 8) in `.next/static` und `.next/server` | `DATABASE_URL`, `DATABASE_URL_DIRECT`, `TEST_DATABASE_URL`, `BETTER_AUTH_SECRET`: kein Treffer. `BETTER_AUTH_URL`: Treffer, aber der Wert ist die öffentliche Basis-URL `localhost` und steht nur in Source Maps (5 `.map`-Dateien) aus Quellcode-Fallbacks; kein Secret |
| Build-Log auf `secret`/`password` | 0 Zeilen |

## Hinweise (keine Funde)

- Der Root-`.gitignore` hat keinen Env-Schutz. Wer im Repo-Root eine `.env` anlegt, wäre ungeschützt. Optional `.env*` und `!.env.example` ergänzen.
- `tmp/` ist in `qm/.gitignore` nicht ausdrücklich ignoriert. Das Verzeichnis existiert nicht; bei Bedarf `/tmp` ergänzen.
- `.next/**/*.map` enthält Quellcode. Für Vercel Production sind Source Maps im Browser standardmässig aus (`productionBrowserSourceMaps` nicht gesetzt); in Task der Deploy-Härtung gegenprüfen.
- Alle Test- und Demo-Werte oben gelten als bewusst erlaubt: `Demo-QM-2026` und die Wegwerf-Testwerte. Echte Produktionswerte (Neon-URLs, `BETTER_AUTH_SECRET`, `QM_APP_PASSWORD`) gehören ausschliesslich in Vercel und ins Terminal des Betreibers.

**Findings-Count: 0 echte Funde, 0 Rotationen, 3 Hinweise.**

## Wiederholbare Befehle

Aus dem Repo-Root:

```bash
# (a) Begriffsscan über alle getrackten qm-Dateien
git ls-files qm | grep -v pnpm-lock | xargs grep -n -i -E "(api[_-]?key|secret|token|password|passwd|postgres(ql)?://[^ ]*:[^ ]*@)"

# (b) Env-, Schlüssel- und Vercel-Dateien in der gesamten Historie und im Index
git log --all --diff-filter=A --name-only --format= | grep -i -E '\.env|\.pem|\.vercel|\.key$|credentials' | sort -u
git ls-files | grep -i -E '\.env|\.pem|\.key$|\.vercel|tmp/'

# (c) Hinzugefügte Zeilen der gesamten Historie nach bekannten Secret-Mustern
git log --all -p --format='C %h' -- . | awk '/^C /{c=$2} /^\+\+\+ /{f=$2} /^\+[^+]/{print c" "f" "$0}' > "$TMPDIR/hist.txt"
grep -E -e 'postgres(ql)?://[^ :/]+:[^ @]{4,}@[a-z0-9.-]+' -e 'sk-[A-Za-z0-9]{20,}' -e 'AKIA[0-9A-Z]{16}' \
  -e 'gh[pousr]_[A-Za-z0-9]{20,}' -e 'xox[bap]-[A-Za-z0-9-]{10,}' -e '-----BEGIN [A-Z ]*PRIVATE KEY' "$TMPDIR/hist.txt" | awk '{print $2}' | sort | uniq -c

# (d) Ignore-Abdeckung
cd qm && git check-ignore -v .env .env.local .vercel/x a.pem .next; git check-ignore -v .env.example || echo ".env.example nicht ignoriert (richtig)"

# (e) Build und Wert-Vergleich ohne Ausgabe der Werte (nur Schlüsselnamen)
pnpm typecheck && pnpm lint && pnpm build
python3 -I - <<'PY'
import subprocess
vals = {}
for l in open('.env'):
    l = l.strip()
    if not l or l.startswith('#') or '=' not in l: continue
    k, v = l.split('=', 1); v = v.strip().strip('"\'')
    if len(v) >= 8: vals[k] = v
hit = [k for k, v in vals.items() if subprocess.run(['grep', '-rlF', '--', v, '.next/static', '.next/server'], capture_output=True).stdout.strip()]
print('Treffer:', sorted(hit))
PY
```
