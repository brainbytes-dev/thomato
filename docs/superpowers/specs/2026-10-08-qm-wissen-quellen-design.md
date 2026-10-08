# Design: Wissen und Quellen (Plan 9)

**Status:** FREIGEGEBEN durch Henrik am 2026-10-08 (D1 später nach IVR-Rückmeldung, D2 bis D5 ja, plus zwei Zusatzregeln, unten eingearbeitet). Umsetzung nach dem Plan-8-Merge bzw. auf einem eigenen Branch (`feat/qm-plan9`, abgezweigt von `feat/qm-plan8`).
**Grundlage:** `qm/docs/catalog/richtlinie-abgleich-2025-08.md` (Abgleich Katalog gegen Richtlinie 08/2025) und Henriks Auftrag vom 2026-10-08.

## Problem

1. Die Kriterien tragen die Nummern der Richtlinie (6.x bis 8.x, dazu 5.2.x aus dem Handbuch). Es gibt kein 1 bis 5 in der App, das wirkt lückenhaft. Die Lücke ist fachlich richtig: Die Kapitel 1 bis 5 der Richtlinie beschreiben das Verfahren, die Kriterientabellen stehen in 6 bis 8, Kapitel 9 ist der Anhang.
2. Die App sagt nicht, woher eine Anforderung kommt. Wer ein Kriterium bearbeitet, will nachlesen können: Kapitel, Seite, offizielles Dokument.
3. Das Verfahrenswissen (Fristen, Ablauf, Rekurs, Erneuerung, Begriffe) steckt nur im PDF. Die App kennt bereits die Fristen, erklärt aber ihre Herkunft nicht.

## Entscheidungen (Henrik, 2026-10-08)

- D1: Auswahlkriterien 8.1, 8.2, 8.4 später, nach IVR-Rückmeldung. Keine Readiness-Regel ändern; die App erklärt im Wissensbereich transparent, dass diese Kapitel Auswahlpflichten enthalten (Pitch-Fragenliste).
- D2: Ich schreibe die Zusammenfassungen als eigene Zusammenfassung; vor dem Pitch fachliche Prüfung gegen Richtlinie und Handbuch.
- D3: Eigener Menüpunkt «Wissen» (Wissen: 1 bis 5, Kriterien: 6 bis 8, Wissen/Anhang: 9).
- D4: «Dossier-Unterlagen» statt «Antrag», Quelle sichtbar als «Handbuch Kap. 5.2», fachlich eigene Kategorie, operativ weiter im Katalog.
- D5: Links auf die offiziellen PDFs bei 144.ch mit Ausgabe, Seite und Quelle; Prüfsumme und versionierte Zuordnung, damit ein neues PDF keine alten Seitenreferenzen unbemerkt bricht.
- Zusatzregel 1: Keine Volltextsuche über Richtlinientext, solange keine Nutzungsrechte vorliegen. Suche nur über eigene Zusammenfassungen, Kapitelbezeichnungen und Metadaten.
- Zusatzregel 2: Jede Wissensseite trägt klein, aber klar: «Zusammenfassung. Massgebend ist die offizielle IVR-Richtlinie.»
- Sprachregelung intern: nicht «61 IVR-Kriterien», sondern 56 Kriterien der Richtlinie + 4 Dossier-Unterlagen + 1 explizit modellierter Unterpunkt (7.4.1) = 61 operative Katalogzeilen.

## Rechtsrahmen (harte Grenze)

Die Richtlinien und das Handbuch sind urheberrechtlich geschützt (das Python-Repo nimmt sie bewusst nicht auf). Daher:

- Die App enthält **keinen Richtlinientext**, weder im Repo noch in der Datenbank noch auf der Oberfläche.
- Sie enthält **eigene, knappe Zusammenfassungen** des Verfahrens in unseren Worten (Fakten wie Fristen und Abläufe sind frei darstellbar), jeweils mit Quellenangabe, Ausgabe und Link auf das offizielle PDF bei 144.ch.
- Normative Tabellen (Anhang 9: Einsatz- und Personalkategorien, Datensätze) werden nur beschrieben und verlinkt, nicht abgeschrieben.
- Wörtliche Zitate der Kriterienvorgaben (wie im Stitch-Mock «Offizielle IVR-Vorgabe») gibt es erst nach Erlaubnis des IVR. Die Frage steht in `qm/docs/demo/PITCH-CHECKLIST.md`.
- Jede Seite trägt den Hinweis: «Zusammenfassung. Massgebend ist die offizielle IVR-Richtlinie.» Keine IVR-Claims, keine Aussage, die App sei offiziell oder zertifiziert.

## Lösung in drei Teilen

### Teil A: Quellenverzeichnis und Quellenangabe pro Kriterium

- **Quellenverzeichnis** als versionierte Konfiguration im Code (`qm/src/domain/sources.ts`), gebunden an die aktive Standardversion: Richtlinie (Titel, Ausgabe «08/2025, Version 2022», Sprache DE, offizielle URL, SHA-256 zur Nachvollziehbarkeit) und Handbuch (gleiche Angaben). Keine Datenbankänderung.
- **Seitenverweis pro Kriterium** als statische Zuordnung `Nummer -> Quelle und Seite` (zum Beispiel `7.3.10 -> Richtlinie, S. 15`; `5.2.1 -> Handbuch, S. 13`). Die Seitenzahlen sind keine geschützten Inhalte. Sie werden einmalig per Skript aus den PDFs erzeugt und eingecheckt; ein Test stellt sicher, dass jede Katalognummer genau einen Eintrag hat und dass keine Nummer fehlt.
- **Anzeige:** Im Kriteriendetail eine Zeile «Quelle: Richtlinie 08/2025, Kap. 7.3.10, S. 15» mit Link `…pdf#page=15` (öffnet die Seite im Browser-PDF-Viewer); in der Kriterienliste eine kleine Legende «Muss, Soll, Auswahl» mit Verweis auf Wissen, Kap. 1.
- **Die vier Dossier-Unterlagen** (5.2.1 bis 5.2.4) werden als Gruppe «Dossier-Unterlagen» mit dem Quellen-Tag «Handbuch 5.2» geführt statt als «Antrag». Die Nummern bleiben.
- **Nummerierung:** Wir ändern keine Richtliniennummern (die Expertinnen und Experten sprechen in diesen Nummern). In Listen und Detail stehen Kapitelüberschriften nach Richtlinie («6 Strukturkriterien», «7 Prozesskriterien», «8 Ergebniskriterien»).

### Teil B: Bereich «Wissen» (Kapitel 1 bis 5 und Anhang)

- Neuer Menüpunkt **Wissen** (lucide `BookOpen`) nach Dokumente; Routen `/wissen` und `/wissen/[kapitel]`, rein lesend, für alle Rollen, ohne Mandantendaten (kein Audit, keine Datenbank).
- Struktur spiegelt die Richtlinie, damit die Nummern lückenlos wirken: **1 Vorbereitung** (Muss, Soll, Auswahlkriterien, einzureichende Unterlagen), **2 Anerkennungsverfahren** (Instanz, Besuch, Entscheid, Kosten), **3 Rekurs**, **4 Nach dem Verfahren** (Dauer), **5 Erneuerung**, **9 Anhang** (Überblick mit Links). Die Kapitel 6 bis 8 führen als Karte zurück zu den Kriterien.
- Jede Seite: eigene Zusammenfassung (kurz, in Sie-Form), Quellenzeile mit Kapitel, Seite und Link, Verweise in die App (zum Beispiel Kapitel 5 verlinkt auf die Fristen im Dashboard, Kapitel 1.3 auf die Dossier-Unterlagen).
- Die Texte werden von uns geschrieben und von Henrik fachlich geprüft (Entscheid D2). Bis dahin trägt die Seite «Entwurf» im Kopf.
- Fristen im Dashboard bekommen einen Verweis «gemäss Richtlinie Kap. 2, 4 und 5» (Text, kein Umbau).

### Teil C: Auswahlkriterien im Kapitel 8 (nur Entwurf der Frage, keine Umsetzung ohne Entscheid)

Siehe Abgleich: 8.1, 8.2 und 8.4 sind nach Richtlinie Muss mit einer Mindestanzahl Auswahlkriterien. Die App behandelt sie heute als «nicht im Verfahren». Eine korrekte Abbildung ändert die Readiness-Regeln und braucht Henriks ausdrückliche Entscheidung (D1) und am besten die Bestätigung des IVR (Pitch-Checkliste). Plan 9 bereitet nur die Darstellung vor (Legende, Erklärung in Wissen Kap. 1.3), ohne die Regel anzufassen.

## Nicht Teil von Plan 9

Wörtliche Richtlinientexte, Volltextsuche über Richtlinien, französische oder italienische Fassungen, Bearbeiten der Wissensinhalte durch Nutzer, Änderung der Readiness-Regeln (ausser nach D1), Einbetten der PDFs.

## Technik und Tests

- Alles statisch und serverseitig gerendert (Cache Components), keine neuen Tabellen, keine Migration.
- Tests: Vollständigkeit der Quellenzuordnung (jede Katalognummer genau einmal, Seiten im gültigen Bereich), Link-Format, Render-Tests (Quellenzeile, Legende, Wissensseiten, Disclaimer, Navigation), Zugriffstest (angemeldet nötig, Proxy-Matcher), Guard-Test: kein Text aus der Richtlinie im Repo (Prüfung gegen eine Liste längerer Satzfragmente wäre selbst problematisch; stattdessen Review-Regel und Textlängenbegrenzung pro Zusammenfassung).
- Ein Prüfskript (nicht im CI) prüft per HTTP, ob die verlinkten PDF-URLs noch antworten.
- Aufgaben: (1) Quellenverzeichnis, Seitenzuordnung, Skript, Tests und Anzeige in Detail und Liste; (2) Wissensbereich mit Seiten; (3) Gruppenbezeichnung «Dossier-Unterlagen», Kapitelüberschriften, Fristenverweise, Screenshots, Gates.

## Entscheidungen für Henrik

1. **D1 Auswahlkriterien:** Readiness-Regel für 8.1, 8.2, 8.4 jetzt, später (nach IVR-Rückmeldung) oder gar nicht ändern?
2. **D2 Wissenstexte:** Ich schreibe die Zusammenfassungen, du prüfst sie fachlich vor dem Einsatz im Pitch. Einverstanden?
3. **D3 Navigation:** «Wissen» als eigener Menüpunkt (Vorschlag) oder als Bereich unter Kriterien?
4. **D4 Dossier-Unterlagen:** Bezeichnung «Dossier-Unterlagen (Handbuch 5.2)» statt «Antrag»?
5. **D5 Linkpflege:** Links auf die offiziellen PDFs bei 144.ch mit Ausgabe und Prüfsumme. Bei neuen Ausgaben wird die Zuordnung neu erzeugt. Einverstanden?
