# Plan 8.1: Kriteriendetail im 8/4-Layout

> **Für Agenten:** Umsetzung mit superpowers:subagent-driven-development. Ein Task, ein Reviewer, dann visuelle Prüfung durch den Controller.

**Ziel:** Die Kriteriendetailseite (`qm/src/app/(app)/criteria/[number]/page.tsx` und ihre Komponenten) wird nach Henriks Stitch-Screen 1 neu angeordnet: Kopfbereich mit Status und Metadaten, links die Arbeitsfläche (8 Spalten), rechts ein Seitenpanel (4 Spalten). Nur bestehende Wahrheit wird neu angeordnet: keine erfundenen Felder, keine neue Fachlogik, kein Datenmodell, keine Migration.

**Branch:** `feat/qm-plan8` (nie `feat/qm-foundation`, der Demo-Stand `pitch-candidate` bleibt unangetastet).

**Design-Quelle:** `qm/DESIGN.md`, Stitch Screen 1 (Kriteriendetail, 12-Spalten-Raster 8/4). Palette und Tokens bleiben unverändert.

## Global Constraints

- Produktname `QM Rettungsdienst`; keine IVR-Claims; Entwurfs-Hinweis zum Katalog («nicht validiert») bleibt sichtbar.
- Keine Funktionsänderung: Formulare, Server Actions, Rechte pro Rolle, Fehlermeldungen, Audit bleiben wie sie sind. Rollen sehen weiterhin nur, was sie dürfen (Verlauf nur Owner und QM-Admin; Viewer schreibgeschützt).
- Nur Token-Farben, kein Hex; Light und Dark; `:focus-visible`; Status nie nur über Farbe; 4/8-px-Raster; lucide-react Icons mit `gap-2`.
- Client-Dateien importieren nichts aus `@/db`, `@/db/schema` oder Domain-Services.
- Deutsche Texte mit echten Umlauten, Schweizer ss, keine Gedankenstriche, Sie-Form.
- Keine Schatten ausser echter Elevation.

## Review Focus

- Alle Rollen (owner, qm_admin, reviewer, editor, viewer) sehen auf der neuen Seite genau die bisherigen Elemente: Verlauf nur Owner/QM-Admin, Formulare nur mit Schreibrecht, Hinweise «schreibgeschützt» für Viewer.
- Formulare behalten ihr Verhalten (Eingaben bleiben nach Fehlern stehen, Upload-Fehler zeigen Meldung, keine Seitenumbrüche beim Absenden).
- Mobil (400 px): einspaltig, keine horizontale Seitenüberbreite ausser in Tabellen-Containern.
- Seiten ohne Daten (kein Nachweis, keine Massnahme, kein Verlauf) zeigen ruhige Leerzustände.

## Task 1: Kriteriendetail neu anordnen

**Dateien:** `qm/src/app/(app)/criteria/[number]/page.tsx` sowie die zugehörigen Komponenten (`assessment-form`, `evidence-section`, `evidence-forms`, `measures-section`, `measure-forms` usw.), `qm/src/components/criteria/*`, bei Bedarf neue kleine Präsentationskomponenten, Tests, `qm/scripts/smoke/demo_story.py` (Selektoren des Verlaufs).

**Aufbau (Zielzustand):**

1. **Kopfbereich**
   - Zurück-Link «Zurück zu den Kriterien» und Breadcrumb (Organisation / Kriterien / Kapitel / Nummer).
   - Titelzeile: Badge-Reihe (Stand als Badge mit Wort und Tint; «Muss» oder «Soll» im Verfahren; Kapitel; Kriteriumsnummer in Mono) und `h1` mit Nummer und Titel.
   - Rechts oder darunter eine kompakte Meta-Pille: Frist, zuletzt geändert (nur echte Felder). Keine «Zuständig»-Angabe auf Kriteriumsebene (gibt es nicht).
2. **Links (8 Spalten)**
   - **Status- und Hinweiskarte:** Callout passend zum Stand (bei «Kritisch» ruhig betont, mit der bestehenden Statuserklärung aus `status-copy`; sonst neutral), darunter der Katalog-Hinweis (Standardversion, «nicht validiert»).
   - **Bewertung:** bestehendes Formular (Stand, Begründung, Frist, Speichern), unverändert in der Logik, in einer Karte.
   - **Nachweis erfassen:** bestehendes Upload-Formular in einer Karte; die Dateiwahl als gestrichelte Ablagefläche gestaltet (reines CSS über das echte `input[type=file]`, damit Drag and Drop nativ funktioniert; kein neues JavaScript), Hinweis auf erlaubte Formate und Grösse (wie bisher, kein «50 MB», keine Signatur- oder SHA-Aussagen), Felder Titel und Gültig bis wie bisher.
   - **Registrierte Nachweise:** bestehende Nachweistabelle (Titel, aktuelle Version, Gültig bis, Zustand, Download) mit Zählkopf («n Dokumente»), Versionen anzeigen, neue Version hochladen, Verknüpfung lösen; darunter «Vorhandenes Dokument verknüpfen». Keine Phantom-Spalten (kein «Geprüft von», keine Mitarbeiterspalte).
3. **Rechts (4 Spalten, bei < lg unter der Arbeitsfläche)**
   - **Nachweis-Stand:** Karte mit den bestehenden Fakten (Nachweis aktuell/veraltet/fehlt, Anzahl Dokumente, Stand des Kriteriums). Keine Quoten oder Defizit-Zahlen.
   - **Massnahmen:** kompakte Liste der Massnahmen des Kriteriums (Titel, Status-Badge, Verantwortliche, Frist; überfällig hervorgehoben mit Wort), Status setzen und Bearbeiten wie bisher; «Massnahme anlegen» als eingeklapptes `<details>`-Element («Massnahme erfassen») mit dem bestehenden Formular.
   - **Verlauf** (nur Owner und QM-Admin): Zeitleiste (`ol`) statt Tabelle, neueste zuerst, Punkt mit Typfarbe, Zeitpunkt in Mono, Person, Änderungstext (bestehende Texte). Überschrift mit `id="history-heading"` und umschliessendem `section[aria-labelledby=history-heading]` bleiben bestehen.
4. **Rechte, Leerzustände, Fehlerzustände** wie bisher; für Viewer die bestehenden Hinweise «Mit Ihrer Rolle ... schreibgeschützt».

**Akzeptanz (alles muss belegt werden):**

- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `python3 ~/.claude/scripts/quality-gate.py qm` grün; bestehende Tests nur an geänderte Struktur angepasst, nie abgeschwächt; neue Render-Tests für die Rollen-Sichtbarkeit (Verlauf, Formulare) und die Leerzustände.
- `scripts/smoke/demo_story.py` läuft lokal komplett durch (Verlauf-Selektor von `tbody tr` auf Listeneinträge angepasst).
- Lokale Browser-Screenshots (Headless Chromium, siehe `scripts/smoke/demo_story.py`) von Owner und Viewer, Kriterium 7.3.10 (kritisch, veralteter Nachweis, Massnahme, Verlauf) und 6.3.2 (ohne Nachweis), hell und dunkel, 1366 px und 400 px; vom Agenten selbst angesehen und korrigiert, Pfade im Report.
- Reports unter `.superpowers/sdd/2026-10-08-qm-criterion-detail-layout/`.

**Nicht Teil dieses Tasks:** Massnahmen-Register, PDCA, neue Felder, Migrationen, Änderungen an Dashboard oder Kriterienliste, Änderung der Palette.
