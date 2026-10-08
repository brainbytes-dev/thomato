# Zugang und Betrieb der Demo

Dieses Dokument enthält keine Geheimnisse. Passwörter und Schlüssel liegen ausserhalb des Repos.

## Wo was liegt

| Was | Wo | Hinweis |
| --- | --- | --- |
| Demo-Passwort (`QM_DEMO_PASSWORD`) | `~/.config/qm-demo/secrets.env` (Kopie von `/tmp/qm-env/secrets.env`) | gilt für alle fünf Demo-Konten |
| Passwort der DB-Rolle `qm_app` (`QM_APP_PASSWORD`) | dieselbe Datei und in der Vercel-Variable `DATABASE_URL` | nur für Betrieb, nicht für die Demo |
| `BETTER_AUTH_SECRET` | dieselbe Datei und Vercel-Variable | bei Verlust: neu erzeugen, alle Sitzungen verfallen |
| Besitzer-URL der Neon-Datenbank | Vercel-Dashboard, Neon-Integration (Projekt `qm-rettungsdienst-demo-db`) | aus den Projekt-Variablen entfernt, nur für Migrationen und Seed |

Ein Verlust des Demo-Passworts ist kein Datenverlust: Neu seeden mit einem neuen `QM_DEMO_PASSWORD` setzt alle Demo-Konten neu (siehe unten).

## Demo-URL und Schutz

- URL: `https://qm-rettungsdienst-demo-git-feat-qm-abeddf-brain-byt-es-projects.vercel.app`
- Schutz: Vercel Authentication für alle Deployments. Wer die Seite öffnet, muss bei Vercel im Team angemeldet sein.
- Für den Zoom reicht es, wenn nur die präsentierende Person den Bildschirm teilt.
- Soll der IVR selbst klicken, braucht es vorher eine kontrollierte Freigabe: Teammitglied bei Vercel einladen oder eine andere Schutzvariante entscheiden. Kein Bypass-Token weitergeben, kein Schutz abschalten.

## Neu seeden (vor jedem Termin und nach jedem Durchlauf)

Seed leert die Demo-Datenbank und legt Organisation, fünf Konten, Dokumente, Massnahmen und Fristen neu an. Er läuft nur mit Besitzer-URL und ausdrücklicher Bestätigung:

1. Besitzer-Direct-URL der Neon-Datenbank aus dem Vercel-Dashboard holen (Variable `DATABASE_URL_UNPOOLED`; nie ins Repo schreiben, nur in die Shell).
2. Im Ordner `qm/`:
   `DATABASE_URL=<direct> DATABASE_URL_DIRECT=<direct> ALLOW_DEMO_RESET_REMOTE=1 QM_DEMO_PASSWORD=<passwort> pnpm seed:demo -- --yes-reset`
3. Die Datenbank-Rolle `qm_app` bleibt unverändert; nach Schemaänderungen zusätzlich `pnpm db:deploy` mit `DATABASE_URL_DIRECT` und `QM_APP_PASSWORD` (siehe README).

Der Seed ist deterministisch in dem Sinn, dass die Story immer gleich ist (Dokumentationsstand 86 %, zwei kritische Pflichtkriterien, zwei veraltete Nachweise); Datumsangaben sind relativ zum Seed-Zeitpunkt.

## Konten

`owner@demo.qm.test`, `qm-admin@demo.qm.test`, `reviewer@demo.qm.test`, `editor@demo.qm.test`, `viewer@demo.qm.test`. Die Anmeldung ist begrenzt (wenige Versuche pro Zeitfenster): zwischen Rollenwechseln einige Sekunden warten.

## Wenn etwas schiefgeht

- Anmeldung hängt oder wird abgelehnt: 15 Sekunden warten, erneut versuchen.
- Seite zeigt «Das hat leider nicht geklappt»: «Erneut versuchen» klicken.
- Datenbank wirkt leer oder verändert: neu seeden.
- Gar nichts geht: Fallback-Screenshots in `qm/docs/demo/screenshots/`.
