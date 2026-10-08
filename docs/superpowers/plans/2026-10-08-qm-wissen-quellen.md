# Plan 9: Wissen und Quellen

> **Für Agenten:** Umsetzung mit superpowers:subagent-driven-development. Pro Task ein Implementierer und ein Reviewer; Task 2 (Texte, Urheberrecht) bekommt zusätzlich eine Prüfung durch den Controller.

**Ziel:** Jedes Kriterium nennt seine Quelle (Ausgabe, Kapitel, Seite, Link auf das offizielle PDF), ein neuer Bereich «Wissen» zeigt Kapitel 1 bis 5 und den Anhang 9 der Richtlinie als eigene Zusammenfassungen, und die Nummerierung wirkt lückenlos (Wissen: 1 bis 5 und 9, Kriterien: 6 bis 8).

**Spec (verbindlich, freigegeben 2026-10-08):** `docs/superpowers/specs/2026-10-08-qm-wissen-quellen-design.md`. Abgleich: `qm/docs/catalog/richtlinie-abgleich-2025-08.md`.

**Branch:** `feat/qm-plan9`, abgezweigt von `feat/qm-plan8` (erst nach Henriks Go für den Start; Rebase/Merge, falls Plan 8 vorher Korrekturen bekommt). `pitch-candidate` und `feat/qm-foundation` bleiben unberührt. Keine Migration, keine neuen Tabellen.

## Zusätzliche Leitplanken (Henrik, Go vom 2026-10-08)

1. Plan 9 wird gebaut und auf eigener Preview geprüft. Weder Plan 8 noch Plan 9 gehen nach `feat/qm-foundation`, solange der manuelle Plan-8-Gate nicht erfolgt ist.
2. Der 6-Wörter-Checker ist ein technisches Warnsystem, keine juristische Freigabe. Der Review prüft zusätzlich Struktur- und Paraphrase-Nähe (Gliederung, Reihenfolge der Aufzählungen, Satzbau), nicht nur identische Wortfolgen.
3. Die Prüfsumme gehört zur konkreten Dokumentausgabe, nicht zur URL. Ersetzt 144.ch ein PDF unter derselben URL, schlägt `check-sources` bewusst Alarm (Prüfsumme weicht ab), und die Seitenzuordnung gilt als ungeprüft, bis sie neu erzeugt wurde.
4. Wissensseiten erklären und verlinken, sind aber keine normative Ersatzquelle. Der Disclaimer bleibt exakt: «Zusammenfassung. Massgebend ist die offizielle IVR-Richtlinie.»

## Global Constraints

- **Urheberrecht (hart):** Kein Richtlinien- oder Handbuchtext im Repo, in der Datenbank oder auf der Oberfläche. Nur eigene, knappe Zusammenfassungen in unseren Worten (Fakten wie Fristen und Abläufe dürfen genannt werden), pro Wissensseite höchstens rund 150 Wörter je Abschnitt, keine übernommenen Satzfolgen. Normative Tabellen des Anhangs 9 werden beschrieben und verlinkt, nicht abgeschrieben. Die Richtlinien-PDFs bleiben ausserhalb des Repos (lokal unter `~/IVR_NotebookLM_failed_attempt_20260919/01_Rettungsdienst/aktuell/`).
- **Hinweis auf jeder Wissensseite**, klein aber klar, exakt: «Zusammenfassung. Massgebend ist die offizielle IVR-Richtlinie.» Dazu Quellenzeile mit Ausgabe, Kapitel, Seite und Link. Keine IVR-Claims (nicht «offiziell», nicht «zertifiziert», nicht «vom IVR freigegeben»).
- **Keine Volltextsuche über Richtlinientext.** Suche nur über unsere eigenen Zusammenfassungen, Kapitelbezeichnungen und Metadaten.
- **Readiness-Regeln unverändert** (D1: Auswahlkriterien 8.1, 8.2, 8.4 später, nach IVR-Rückmeldung). Die App erklärt in Wissen Kap. 1.3 transparent, dass diese Kriterien eine Auswahlpflicht enthalten (Mindestanzahl), ohne die Regel zu ändern.
- **Sprachregelung:** nie «61 IVR-Kriterien». Richtig: 56 Kriterien der Richtlinie + 4 Dossier-Unterlagen (Handbuch 5.2) + 1 explizit modellierter Unterpunkt (7.4.1) = 61 operative Katalogzeilen. In UI-Texten keine Gesamtzahl nennen, ausser aus echten Daten.
- Richtliniennummern werden nie geändert. Kapitelüberschriften nach Richtlinie: «6 Strukturkriterien», «7 Prozesskriterien», «8 Ergebniskriterien». Die vier Zeilen 5.2.1 bis 5.2.4 heissen «Dossier-Unterlagen» mit Quelle «Handbuch Kap. 5.2» (operativ weiter im Katalog; keine Migration: Darstellung über die Quellenkonfiguration).
- Texte: Deutsch, echte Umlaute, Schweizer ss, Sie-Form, keine Gedankenstriche, nur Token-Farben, Light und Dark, `:focus-visible`, lucide-react mit `gap-2`, keine Schatten, Client-Dateien ohne `@/db` und Domain-Services.
- Zugriff: Wissen nur angemeldet (Proxy-Matcher `/wissen/:path*`), für alle Rollen lesbar, keine Mandantendaten, kein Audit.

## Review Focus

- Kein übernommener Richtlinientext (6-Wort-Folgen-Vergleich der Zusammenfassungen gegen den extrahierten PDF-Text, Ergebnis im Report; Treffer werden umformuliert).
- Seitenzuordnung lückenlos und richtig: jede der 61 Katalognummern genau einmal, Seiten im gültigen Bereich der jeweiligen PDF, Stichproben (6.1 S. 11, 7.3.10 S. 15, 8.5 S. 20, 5.2.1 Handbuch S. 13) stimmen mit dem PDF überein.
- Links: Format `…pdf#page=N`, offizielle URL bei 144.ch, Ausgabe und Prüfsumme in der Konfiguration; ein Skript prüft Erreichbarkeit und Prüfsumme (nicht im CI).
- Tote Enden: jede Wissensseite hat Quelle, Disclaimer, Rücklink; alle internen Verweise (Fristen, Kriterienliste, Dossier-Unterlagen) funktionieren.
- Die bestehenden Seiten (Dashboard, Kriterien, Detail, Register) verhalten sich unverändert, ausser den dokumentierten Zusätzen.

## Task 1: Quellenverzeichnis, Seitenzuordnung, Anzeige bei den Kriterien

**Dateien (erwartet):** `qm/src/domain/sources.ts` (Quellen: Richtlinie 08/2025 «Version 2022» und Handbuch, je mit Titel, Ausgabe, Sprache, offizieller URL, SHA-256; URLs und Prüfsummen stehen in `~/IVR_NotebookLM_failed_attempt_20260919/IVR_SOURCE_OF_TRUTH.md`), `qm/src/domain/source-pages.ts` (generierte Zuordnung Nummer zu Quelle und Seite, mit Kopfkommentar zur Erzeugung), `qm/scripts/gen-source-pages.ts` oder ein kleines Python-Skript unter `qm/scripts/` (liest die lokalen PDFs, nutzt `pdftotext -bbox-layout` und die Nummern-Zeilen; Vorlage: das Vorgehen aus dem Abgleich, Seiten der Kapitel 6 bis 8 stehen im Textlayer; Handbuch 5.2.1 und 5.2.2 S. 13, 5.2.3 und 5.2.4 S. 14), `qm/scripts/check-sources.ts` (HTTP-Erreichbarkeit und SHA-256 der offiziellen PDFs, Ausgabe ohne Geheimnisse), Anpassung von `qm/src/components/criteria/*` und der Kriteriendetailseite (Zeile «Quelle: Richtlinie 08/2025, Kap. 7.3.10, S. 15» mit Link; für die Dossier-Unterlagen «Handbuch 5.2.1, S. 13»), Kriterienliste (Gruppenüberschriften «6 Strukturkriterien» usw., «Dossier-Unterlagen» statt «Antrag» als Anzeige der Kategorie, kleine Legende «Muss, Soll, Auswahl» mit Link nach Wissen Kap. 1), Tests.

**Verhalten:** Die Anzeige liest nur Konfiguration, keine Datenbankänderung. Die Kategorie «Antrag» im Katalog bleibt in den Daten bestehen (Import und Tests unberührt), nur die Anzeige in Liste, Detail und Dashboard-Kapitelkarten nennt sie «Dossier-Unterlagen». Fortschrittsberechnung und Readiness bleiben unberührt.

**Akzeptanz:** Vollständigkeits- und Plausibilitätstests der Seitenzuordnung (alle 61 Katalognummern, keine Dubletten, Seiten innerhalb der PDF-Seitenzahl aus der Konfiguration), Link-Format-Test, Render-Tests (Quellenzeile, Legende, Gruppenüberschriften, Bezeichnung «Dossier-Unterlagen»), bestehende Tests nur an die neue Bezeichnung angepasst (nie abgeschwächt), Gates grün (`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, Quality-Gate), Screenshots (Owner und Viewer, Kriterienliste und Detail 7.3.10 und 5.2.1, hell und dunkel, 1366 und 400 px) vom Agenten angesehen. Report unter `.superpowers/sdd/2026-10-08-qm-wissen-quellen/`.

## Task 2: Bereich «Wissen»

**Dateien (erwartet):** `qm/src/app/(app)/wissen/page.tsx` und `qm/src/app/(app)/wissen/[kapitel]/page.tsx`, Inhalte als typisierte Daten (`qm/src/content/wissen/*.ts`, eine Datei pro Kapitel), Komponenten unter `qm/src/components/wissen/`, Navigation (`app-nav.tsx`: Eintrag «Wissen», lucide `BookOpen`, nach Dokumente), Breadcrumbs, Proxy-Matcher, Tests.

**Inhalt:** Kapitel 1 Vorbereitung (Muss, Soll, Auswahlkriterien inklusive transparenter Erklärung der Auswahlpflicht für 8.1, 8.2, 8.4 und Hinweis, dass die App sie vorerst nicht als Muss rechnet; einzureichende Unterlagen, Verweis auf Dossier-Unterlagen), 2 Anerkennungsverfahren (Instanz, Besuch, Entscheid, Kosten), 3 Rekurs, 4 Nach dem Verfahren (Dauer), 5 Erneuerung (Fristen: Antrag und vollständiges Dossier, Qualitätskreislauf, Berichte), 9 Anhang (Überblick und Links: Einsatzkategorien, Personalkategorien, Notarzt, Fahrzeuganforderungen, Basisdatensatz und Ergänzungsdaten; beschrieben, nicht abgeschrieben), und eine Kartenseite «Kriterien (Kapitel 6 bis 8)» als Rücklink in die Kriterienliste. Startseite `/wissen` spiegelt die Richtlinienstruktur 1 bis 9. Jede Seite: kurze Zusammenfassung in eigenen Worten, Quellenzeile (Ausgabe, Kapitel, Seite, Link), Disclaimer exakt wie oben, Rücklinks in die App (Kap. 5 und 2 verlinken auf die Fristen im Dashboard, Kap. 1.3 auf die Dossier-Unterlagen und die Kriterienliste), Hinweis «Entwurf, fachlich noch zu prüfen» im Kopf, bis Henrik freigibt (Flag in der Konfiguration).

**Suche:** Einfaches `?q=` über Titel, Kapitelbezeichnungen und unsere Zusammenfassungen (serverseitig, in Speicher, ohne Richtlinientext), mit Leerzustand. Keine Suche über PDFs.

**Autorenregel:** Die Texte werden aus der Richtlinie und dem Handbuch in eigenen Worten verfasst (Quelle zum Lesen: lokaler `pdftotext`-Auszug ausserhalb des Repos, nie eingecheckt). Danach läuft ein Prüfskript (ausserhalb des Repos oder unter `qm/scripts/` ohne PDF-Inhalt): Es vergleicht jede Zusammenfassung mit dem extrahierten PDF-Text auf übereinstimmende Folgen von sechs oder mehr Wörtern und meldet Treffer; Treffer werden umformuliert. Ergebnis (Anzahl geprüfter Abschnitte, Treffer vor und nach der Korrektur) steht im Report.

**Akzeptanz:** Render-Tests (Disclaimer auf jeder Seite, Quellenzeile, Entwurf-Flag, Navigation, Suche mit Treffer, ohne Treffer), Zugriffstest (Proxy), kein Zugriff ohne Anmeldung, Gates grün, Screenshots (Übersicht, Kapitel 1, Kapitel 5, Anhang; Owner und Viewer; hell und dunkel; 1366 und 400 px).

## Task 3: Verknüpfungen, Fristen, Abschluss

**Dateien:** Dashboard-Fristenkarte (Verweis «gemäss Richtlinie Kap. 2, 4 und 5» als Textlink nach Wissen, kein Umbau), Kriterienliste und Detail (Links nach Wissen), Dokumentation (README-Abschnitt «Katalog und Quellen» mit der Sprachregelung 56 + 4 + 1 = 61 Zeilen; `qm/docs/demo/DEMO-FLOW.md` um einen kurzen Hinweis auf Quellen und Wissen ergänzen, falls es in den Ablauf passt), `qm/docs/demo/PITCH-CHECKLIST.md` (Punkt zu Wissen und Zusammenfassungen), Screenshots für das Deck, alle Gates.

**Akzeptanz:** Alle internen Links funktionieren (Linktest über die neuen Routen), das Dashboard ist ausser dem Fristenverweis unverändert, Smoke-Skript (`scripts/smoke/demo_story.py`) läuft durch, Gesamtreview des Branches durch einen Reviewer (Fokus: Urheberrecht, tote Enden, unveränderte Readiness).
