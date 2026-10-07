# QM: Bauplan bis zum IVR-Pitch am 17.11.2026

Stand: 07.10.2026. Entscheidung von Henrik: Der Neubau auf Next.js, Drizzle, Better Auth und Postgres ist gesetzt. Die Python-App unter `web/ivr/` bleibt Fachlogik-Vorlage und Fallback, wird aber nicht erweitert.

Quellen (liegen ausserhalb des Repos, in `~/Downloads`):
`IVR_QM_SaaS_Tech_Stack_Architecture.md`, `Thomato IVR QM — Design System.md`, `Thomato_Legal_Compliance_Baseline_CH.md`, `Thomato_IVR_QM_Dashboard_Layout.md`.

## Entscheidungen, die dieser Plan trifft (überstimmbar)

| # | Entscheidung | Begründung |
|---|---|---|
| E1 | Neue App in `qm/` im selben Repo, eigenes Vercel-Projekt (Root Directory `qm`), später eigene Subdomain (Name offen, siehe E7) | Marketing-Site (`web/`) bleibt unberührt, Baustellensperre und Deploys entkoppelt |
| E2 | Treiber `pg` (node-postgres) mit Drizzle, gepoolte Neon-URL für die App, direkte URL für Migrationen | Echte Transaktionen für atomares Audit. Der Neon-HTTP-Treiber kann keine interaktiven Transaktionen |
| E3 | Rollen laut Architekturpapier: `owner`, `qm_admin`, `reviewer`, `editor`, `viewer` | Entspricht den drei Stufen der Python-App plus Freigabe und Besitz |
| E4 | Tests laufen gegen echtes Postgres (Docker, Port 5437), keine Mocks | Cross-Tenant-Beweis muss gegen echte SQL-Semantik laufen |
| E5 | Standardversion `ivr-rd-draft` mit Status `draft_extracted`. Katalog aus `web/ivr/demo/kriterien.json` (61 Zeilen) | Die PRD-Zahl 54 und die vier validierten Regeln existieren im Repo nicht. Sie werden erst modelliert, wenn eine belegte Quelle vorliegt |
| E7 | Produktname offen. Arbeitstitel «QM Rettungsdienst», ausschliesslich aus `qm/src/brand.ts`. Branding-Runde als eigener Schritt, Marke trägt QM zuerst, später weitere Vertikalen | Henrik 07.10.: neutraler Name für jetzt, Branding später |
| E6 | Server Actions zuerst. Die REST-API unter `/api/v1` kommt in Plan 6 und ruft dieselben Service-Funktionen auf | Eine Fachschicht, zwei Zugänge, kein doppelter Code |

## Pläne (jeder liefert für sich lauffähige, getestete Software)

| Plan | Gate | Inhalt | Zeitfenster |
|---|---|---|---|
| 1 Fundament | G0/G1 | Scaffold, Postgres, Better Auth mit Organizations und Rollen, Katalog-Import, Tenant-Guard, atomares Audit, Seed, Login und Kriterienliste | 08.-14.10. |
| 2 Readiness und Dashboard | G1 | Port von `einordnen`, Monitoring-Stand und Fristenuhr aus der Python-App nach TypeScript, qualitativer Status getrennt vom Fortschritt, «Braucht Aufmerksamkeit» | 15.-21.10. |
| 3 Kriterium und Nachweise | G2 | Detailseite, Dokumente, Versionen, Verknüpfung, private Blob-Uploads, Auflagen, Kommentare | 22.-28.10. |
| 4 Massnahmen und Qualitätskreisläufe | G2 | PDCA/DMAIC, Nachmessung, Massnahmen CRUD, Fristenübersicht | 29.10.-04.11. |
| 5 Bericht und Audit-Ansicht | G3 | Verlaufsseite, inoffizieller Readiness-Report, Security-Smokes | 05.-08.11. |
| 6 API, Staging, Demo-Betrieb | G4/G5 | `/api/v1`, Neon-Staging, Reset-Prozedur, Run-of-Show, Backup-Video | 09.-16.11. |

Scope-Freeze 12.11. Bei Verzug fallen Plan 5 (Report-Layout) und Teile von Plan 4 (DMAIC) weg, nie die Stabilität des Demo-Pfads.

## Portierungs-Landkarte Python nach TypeScript

| Python | Ziel | Plan |
|---|---|---|
| `datenbank.py` (Schema, Kriterien) | `qm/src/db/schema/domain.ts`, `qm/src/domain/catalog.ts` | 1 |
| `anmeldung.py` (scrypt, 3 Stufen) | Better Auth plus `qm/src/domain/rights.ts` | 1 |
| `app.py` `einordnen`, `monitoring_stand`, `uhr` | `qm/src/domain/readiness.ts` | 2 |
| `handbuch.py`, `dossier.py` | `qm/src/domain/documents.ts` | 3 |
| `app.py` Massnahmen und Kreisläufe, `reca.py` | `qm/src/domain/cycles.ts`, `measures.ts` | 4 |
| `landkarte.py`, `diagramme.py` | später, nur wenn Zeit bleibt (P2) | n/a |

Fachlogik wird nicht neu erfunden. Pro portierter Funktion: zuerst Charakterisierungstest gegen die Python-Ausgabe auf denselben Demodaten, dann Port.

## Fallback

Bis zum Pitch läuft die Python-Demo unter `/qualitaetsmanagement-tool/demo` unverändert weiter. Fällt ein Gate aus, ist sie die Notlösung. Ihr Haken: Auf Vercel ist `/tmp` flüchtig, Änderungen überleben keine Instanz.

## Offene Punkte (keine Build-Blocker, aber vor dem Pitch zu klären)

1. Darf der Name IVR im Produkt vorkommen? (Baustellensperre in `web/src/middleware.ts` seit 16.09.)
2. Welche IVR-Texte dürfen sichtbar sein? Bis dahin nur Nummern, Titel und eigene Paraphrasen.
3. Gilt der Katalog mit 61 Zeilen, oder gibt es die 54er-Quelle aus dem PRD?
4. Vercel-Projekt und Neon-Projekt anlegen (Frankfurt). Deploy nur per Git-Integration, Build Machine `standard`.
5. Erwartung am 17.11.: Prototyp oder Pilot?
