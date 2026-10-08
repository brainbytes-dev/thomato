# Design: PDCA-Qualitätskreisläufe (Plan 8.3)

**Status:** FREIGEGEBEN durch Henrik am 2026-10-08, alle fünf Entscheidungen mit Ja, mit zwei verbindlichen Leitplanken (siehe unten, in diesem Dokument eingearbeitet).
**Branch:** `feat/qm-plan8`. `pitch-candidate` bleibt unberührt.
**Referenz:** Stitch Screen 2 (Register) und Screen 3 (Massnahmen-Detail mit PDCA-Stepper).

## Ziel

Eine Massnahme wird zum nachvollziehbaren Qualitätskreislauf: Plan, Do, Check, Act. Jede Phase hat einen klaren Abschluss, die Wirksamkeit wird bewusst geprüft, und alles steht im Audit-Verlauf. Wir zeigen nur, was wir wirklich erfassen: keine Eskalationsstufen, keine Dienstfähigkeit, keine erfundenen Kennzahlen.

## Was heute da ist

Tabelle `measure` mit Titel, Beschreibung, Verantwortliche, Frist, Status (`open`, `in_progress`, `done`), Erledigt-Zeitpunkt. Status wird über `setMeasureStatus` gesetzt (Recht `measure:write`), Audit-Events `measure.*`. Seite `/measures` (Register, lesend) und die Massnahmenkarte im Kriteriendetail.

## Datenmodell (additive Migration, keine Datenverluste)

1. `measure` bekommt:
   - `phase` (`plan | do | check | act`), Standard `plan`, NOT NULL.
   - `cycle` (ganze Zahl ab 1, Standard 1): Zählt Wiederholungen, wenn die Wirksamkeitsprüfung negativ ausfällt.
   - `effectiveness_criterion` (Text, optional, 3 bis 500 Zeichen): Woran wird die Wirksamkeit gemessen? Wird in der Plan-Phase festgehalten.
   - Keine Ergebnisfelder auf `measure`: Wirksamkeitsbewertungen stehen in der unveränderlichen Tabelle `measure_review` (siehe 2a), damit nie etwas überschrieben wird.
2. Neue Tabelle `measure_step` (Checkliste): `id`, `organization_id`, `measure_id` (zusammengesetzter Fremdschlüssel mit der Organisation, damit die Mandantentrennung in der Datenbank steht), `phase`, `position`, `title` (3 bis 200), `done_at`, `done_by`. Keine eigenen Verantwortlichen und Fristen pro Schritt (bewusst klein gehalten).
2a. Neue Tabelle `measure_review` (append-only, per Trigger und Rollenrechten unveränderlich wie `audit_event`): `id`, `organization_id`, `measure_id` (zusammengesetzter Fremdschlüssel mit Organisation), `cycle` (Zyklus, in dem bewertet wurde), `result` (`effective | partly | not_effective`), `note` (Pflicht, 3 bis 1000), `checked_at`, `checked_by`. Mehrere Bewertungen pro Zyklus sind möglich (nach Nachschärfen). Die aktuelle Bewertung ist die jüngste Zeile; alle früheren bleiben sichtbar.
3. Bestehende Zeilen werden migriert: `open` wird `plan`, `in_progress` wird `do`, `done` wird `act` (ohne Bewertungszeile, also «nicht geprüft»). So bleibt alles lesbar und das Dashboard rechnet unverändert.
4. DB-Regeln: `status = 'done'` nur zusammen mit `phase = 'act'`; Bewertungszeilen nur für Massnahmen, die mindestens in Phase `check` waren (Service-Regel); Schritte gehören zur selben Organisation wie ihre Massnahme.

## Ablauf und Regeln (Service-Schicht)

- **Plan:** Titel, Verantwortliche, Frist, Wirksamkeitskriterium erfassen. «Plan abschliessen» setzt die Phase auf `do` und den Status auf `in_progress`.
- **Do:** Checklistenschritte anlegen, abhaken, umsortieren oder entfernen (nur in der Do-Phase). «Do abschliessen» verlangt, dass alle Schritte erledigt sind (null Schritte sind erlaubt, wenn dies bewusst bestätigt wird).
- **Check:** Wirksamkeit bewerten (`effective`, `partly`, `not_effective`) mit Pflichtnotiz; das schreibt eine neue Zeile in `measure_review` und setzt die Phase auf `act`. Nur mit Recht `measure:approve`. Der Status bleibt `in_progress`.
- **Act (bewusste Entscheidung, nie automatisch):** Die berechtigte Person wählt immer selbst: **Abschliessen** (Status `done`, Erledigt-Zeitpunkt; bei `partly` oder `not_effective` nur mit Begründung von mindestens 10 Zeichen, die im Audit steht), **Nachschärfen** (Phase zurück auf `do` im selben Zyklus, die Bewertung bleibt sichtbar, weitere Schritte können ergänzt werden, danach erneut Check) oder **Neuer Zyklus** (Phase auf `plan`, `cycle` plus 1, Status `in_progress`; die Bewertungen des alten Zyklus bleiben unverändert und sichtbar, nur gruppiert nach Zyklus). Auch bei `effective` schliesst nichts automatisch ab.
- **Rückwärts:** Die Phase kann nur durch die definierten Übergänge wechseln. Wiedereröffnen einer erledigten Massnahme ist `approve`-pflichtig, setzt Status `in_progress`, Phase `do`.
- Der bisherige `setMeasureStatus` bleibt für `open`/`in_progress` bestehen (Kompatibilität, Dashboard), `done` läuft nur noch über den Abschluss in Act.

## Verbindliche Leitplanken (Henrik, 2026-10-08)

1. Ein neuer Zyklus überschreibt keine Historie: `cycle` ist auditierbar, Bewertungen früherer Zyklen bleiben in `measure_review` unverändert erhalten und werden in der Oberfläche nach Zyklus gruppiert angezeigt.
2. «Teilweise wirksam» und «nicht wirksam» schliessen Act nie automatisch. Act ist immer eine bewusste Entscheidung: abschliessen, nachschärfen oder neuen Zyklus starten.

## Rechte

`measure` bekommt die Aktion `approve` (wie bei `assessment` und `document`): `owner`, `qm_admin`, `reviewer` dürfen Wirksamkeit bewerten, abschliessen, neuen Zyklus starten, wiedereröffnen. `editor` darf Plan und Do bearbeiten (`measure:write`). `viewer` liest nur. Alles serverseitig geprüft, `RESOURCE_ACTIONS` bleibt die einzige Quelle.

## Audit

Neue Events (Payload mit `criterionNumbers` wie bisher): `measure.phase_changed`, `measure.step_added`, `measure.step_updated`, `measure.step_removed`, `measure.effectiveness_recorded` (mit Zyklus und Ergebnis), `measure.refined`, `measure.cycle_started`, `measure.closed` (mit Begründung falls nötig), `measure.reopened`. Anzeige-Texte in `audit-copy`; bestehende Events bleiben unverändert lesbar.

## Oberfläche

1. **Massnahmen-Detail `/measures/[id]`:** Kopf mit Titel, Kriterium-Link, Verantwortliche, Frist. PDCA-Stepper mit vier Feldern (erledigt, aktiv, ausstehend, mit Wort und Icon, nie nur Farbe). Links: Sachverhalt, Wirksamkeitskriterium, Checkliste der aktiven Phase, Wirksamkeitsprüfung (ab Check). Rechts: Fristen und Verantwortliche, Phasen-Aktionen («Plan abschliessen» usw., nur mit Recht), Verlauf (nur Owner und QM-Admin) als Zeitleiste.
2. **Register `/measures`:** neue Spalte «Phase», Filter nach Phase, Kennzahlen um Phasenverteilung ergänzt.
3. **Kriteriendetail:** Massnahmenkarte zeigt die Phase und verlinkt auf das Detail; Status-Auswahl nur noch für `open`/`in_progress`-Kompatibilität oder durch Phasen-Aktionen ersetzt (im Plan entschieden).
4. **Kennzahlen nur aus echten Daten:** Anteil wirksamer Bewertungen unter den geprüften Massnahmen (immer mit Anzahl n, etwa «Wirksam: 67 % (n=3)») und durchschnittliche Dauer bis zum Abschluss; erscheinen erst, wenn mindestens eine geprüfte bzw. abgeschlossene Massnahme existiert, sonst Leerzustand. Keine Prognosen, keine Readiness-Auswirkung (Readiness bleibt ausschliesslich von den Kriterien abhängig, wie in den bestehenden Regeln).

## Bewusst nicht Teil von 8.3

Eskalationsstufen, Dienstfähigkeit, Mitarbeiterregister, Dokumentenverknüpfung pro Massnahme, E-Mail-Erinnerungen, PDF-Export, Verantwortliche oder Fristen pro Schritt, Änderungen an Readiness-Regeln.

## Umgebung und Risiken

- **Eigene Datenbank für die Preview:** Die Migration darf nicht gegen die Demo-Datenbank laufen. Für `feat/qm-plan8` kommt ein zweites Neon-Projekt (Free-Plan, Frankfurt) mit eigenen Rollen (`qm_app`, Seed) und branch-spezifischen Vercel-Variablen. Die Demo-Datenbank bleibt auf dem Stand von `pitch-candidate`.
- **Rückführung in den Pitch-Stand:** Ob PDCA vor dem 17.11. in `feat/qm-foundation` landet, entscheidet Henrik am Ende. Die Migration ist additiv mit Standardwerten und damit rückwärtskompatibel; ein Merge braucht `db:deploy` gegen die Demo-Datenbank und einen erneuten Rollen-Lauf (`db:roles`).
- **Umfang:** drei Tasks (Datenmodell, Rechte, Audit und Services mit Tests; Detailseite mit Stepper und Checkliste; Register und Kennzahlen). Datenmodell und Rechte bekommen einen Opus-Review.

## Entscheidungen für Henrik

1. Kopplung Status und Phase wie oben (Status bleibt grob, Phase ist fein; `done` nur über Act)?
2. Rechte: `measure:approve` für Owner, QM-Admin und Reviewer (Editor nur Plan und Do)?
3. Kennzahlen nur aus echten Daten, mit Anzahl n und Leerzustand?
4. Zweites Neon-Projekt für die Preview von `feat/qm-plan8`?
5. Die Checkliste bleibt minimal (Titel und erledigt), ohne Verantwortliche und Fristen pro Schritt?
