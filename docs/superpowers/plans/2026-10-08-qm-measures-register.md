# Plan 8.2: Massnahmen-Register

> **Für Agenten:** Umsetzung mit superpowers:subagent-driven-development. Ein Task, ein Reviewer, dann visuelle Prüfung durch den Controller.

**Ziel:** Eine neue Seite `/measures` zeigt alle Massnahmen der Organisation (alle Status, über alle Kriterien) als betriebliches Register: Kennzahlen, Filter, Suche, Tabelle mit Sprung ins Kriterium. Grundlage sind die bestehenden Daten (Tabelle `measure`); keine Migration, keine neuen Felder, keine Kennungen (Stitch zeigt «#M-2026-08»; das gibt es bei uns nicht und wird nicht erfunden).

**Branch:** `feat/qm-plan8`. Design-Quelle: `qm/DESIGN.md` und Stitch Screen 2 (Register mit Kopfband, Filterleiste, Tabelle), angepasst an unsere Daten. Palette unverändert.

## Global Constraints

- Produktname `QM Rettungsdienst`; keine IVR-Claims; deutsche Texte mit echten Umlauten, Schweizer ss, Sie-Form, keine Gedankenstriche.
- Mandantentrennung: jede Abfrage nach `organization_id` und Join-Bedingung; fremde Daten nie sichtbar; Test mit zwei Organisationen.
- Rechte: Lesen für alle Rollen mit `measure:read` (alle fünf); Schreiben passiert weiter nur auf der Kriteriumsseite. Das Register ist rein lesend.
- Filter und Suche laufen serverseitig über URL-Parameter (wie die Kriterienliste), kein Client-State, keine DB-Imports in Client-Dateien.
- Nur Token-Farben; Light und Dark; `:focus-visible`; Status nie nur über Farbe; lucide-react mit `gap-2`; keine Schatten; 4/8-px-Raster.
- Pitch-Stand `pitch-candidate` bleibt unberührt; Arbeit nur auf `feat/qm-plan8`.

## Review Focus

- Suche und Filter-Parameter sind robust: unbekannte Werte fallen auf «alle», überlange oder spezielle Zeichen in `q` führen nie zu Fehlern (kein SQL, die Suche läuft in Speicher oder mit Parametern), Umlaute werden gefunden, Gross/Klein egal.
- Überfällig bedeutet offen oder in Bearbeitung mit Frist vor heute (Europe/Zurich), erledigte Massnahmen sind nie überfällig; die Zähler stimmen mit der Dashboard-Zahl «Überfällig» überein.
- Eine Organisation ohne Massnahmen und eine Filterkombination ohne Treffer zeigen ruhige Leerzustände mit Weg zurück.
- Zwei Organisationen: jede sieht nur ihre Massnahmen, auch über die Suche.
- Anonym: Weiterleitung auf `/login` (Proxy-Matcher), nicht eingeloggt keine Daten.

## Task 1: Register bauen

**Dateien (erwartet):** `qm/src/domain/measures.ts` (neue Funktion `listAllMeasures`), `qm/src/domain/measure-filter.ts` (rein, mit Tests), `qm/src/app/(app)/measures/page.tsx` und kleine Komponenten unter `qm/src/components/measures/`, `qm/src/components/shell/app-nav.tsx` und `breadcrumbs.ts` (Menüpunkt und Breadcrumb), `qm/src/proxy.ts` (Matcher), Dashboard-Link, Tests.

**Verhalten:**

1. **Daten:** `listAllMeasures(ctx, now)` liefert alle Massnahmen der Organisation für die aktive Standardversion (alle Status) mit Kriteriumstitel, Verantwortlichen, Frist, Status, Tagen und Überfällig-Flag, in der bestehenden Sortierlogik (überfällige zuerst, dann nach Frist; erledigte zuletzt). Recht: `assertCan(ctx, "measure", "read")`.
2. **Filtermodul (rein):** `parseMeasureStatusFilter` (`all | overdue | open | in_progress | done`), `parseOwnerFilter` (`all` oder eine Benutzerkennung, validiert nur gegen die Mitgliederliste der Organisation, sonst `all`), `parseQuery` (getrimmt, auf 80 Zeichen begrenzt), `filterMeasures`, `countMeasuresByStatus`, `measuresFilterHref` (lässt «all» weg). Suche über Titel, Kriteriumsnummer, Kriteriumstitel und Verantwortliche, ohne Beachtung von Gross/Klein und Akzenten (Normalisierung NFKD für Umlaute: «Büro» findet «buero» nicht, aber «büro» und «BÜRO»).
3. **Seite `/measures`:**
   - Kopfband: Titel «Massnahmen» mit Untertitel, vier Kennzahlen (Offen, In Bearbeitung, Überfällig, Erledigt) als Zahl plus Wort; Überfällig mit Warnfarbe und Link auf den Filter.
   - Filterleiste: Segmentlinks (Alle n, Überfällig n, Offen n, In Bearbeitung n, Erledigt n) mit `aria-current`, Suchfeld (GET-Formular, Label sichtbar oder `aria-label`, Button «Suchen», «Zurücksetzen»-Link wenn aktiv) und Auswahl «Verantwortliche» (GET-Formular, alle Mitglieder).
   - Tabelle: Spalten Massnahme (Titel, darunter Kriterium als Link «7.3.8 Titel»), Verantwortliche, Frist (Mono, überfällig in Warnfarbe mit Wort «seit n Tagen überfällig»), Status (Badge mit Wort), Aktion («Öffnen» zum Kriterium, Anker auf den Massnahmenbereich falls vorhanden). Kopfzeile `bg-surface-subtle`, Zeilen mit Trennlinien und Hover; auf Mobil in einem scrollenden Container. Fusszeile «n von m Massnahmen».
   - Leerzustände: keine Massnahmen in der Organisation (Hinweis, wo man sie anlegt: «Massnahmen legen Sie auf der Seite eines Kriteriums an», Link zu den Kriterien) und keine Treffer (Filter zurücksetzen).
4. **Navigation:** Menüpunkt «Massnahmen» (lucide `ListChecks`) zwischen Kriterien und Dokumente; Breadcrumb «Organisation / Massnahmen»; Proxy-Matcher um `/measures` ergänzt (Test).
5. **Dashboard:** Die Mini-Stats «Offen» und «Überfällig» unter «Massnahmen» verlinken auf `/measures?status=open` bzw. `?status=overdue`; ein Link «Alle Massnahmen» (nur Textlink, kein Layoutumbau).

**Akzeptanz:**

- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `python3 ~/.claude/scripts/quality-gate.py qm` grün; neue Tests: Filtermodul (inklusive Sonderzeichen, Umlaute, Länge, unbekannte Werte), `listAllMeasures` (Mandantentrennung mit zwei Organisationen, Rechte, Sortierung, Überfällig stimmt mit Dashboard-Zähler), Proxy-Matcher, Render-Tests der Komponenten (Leerzustände, Rollen: Viewer sieht die Tabelle, keine Schreibaktionen).
- Lokaler Browser-Nachweis mit Screenshots von Owner und Viewer (hell und dunkel, 1366 und 400 px) für: Register ungefiltert, Filter «Überfällig», Suche mit Treffer, Suche ohne Treffer; Pfade im Report; vom Agenten selbst angesehen und korrigiert.
- Bestehendes Smoke-Skript läuft weiter durch.
- Reports unter `.superpowers/sdd/2026-10-08-qm-measures-register/`.

**Nicht Teil dieses Tasks:** Anlegen oder Ändern von Massnahmen im Register, PDCA, neue Felder, Migrationen, Kennungen, Export, Paginierung (bei < 200 Zeilen nicht nötig; bei mehr zeigt die Seite die ersten 200 mit Hinweis).
