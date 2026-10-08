# Abgleich Katalog gegen Richtlinie (Ausgabe 08/2025, «Version 2022»)

Stand: 2026-10-08. Quelle: «Richtlinien zur Anerkennung von Rettungsdiensten» (144.ch) und das Handbuch zum Verfahren. Der Richtlinientext selbst liegt nicht im Repo (Urheberrecht IVR); dieses Dokument enthält nur Nummern, Flags und Befunde.

## Methode

- Nummern aus dem Textlayer der Richtlinie (Kapitel 6 bis 8) gegen `web/ivr/demo/kriterien.json`.
- Muss/Soll-Markierungen der vier Spalten (Anerkennung Muss/Soll, Erneuerung Muss/Soll) sind Vektorgrafiken (Häkchen), nicht Text. Sie wurden pro Zeile aus der gerenderten Seite ausgelesen (Position der Nummer, Pixel in den vier Spalten) und die unklaren Zeilen (7.2, 7.4, 7.8) visuell geprüft.

## Ergebnis

- Alle 56 nummerierten Kriterien der Kapitel 6 bis 8 sind im Katalog, keines fehlt.
- Kapitel 1 bis 5 der Richtlinie enthalten keine Kriterien (Verfahrenstext). Kapitel 9 ist der Anhang.
- `5.2.1` bis `5.2.4` stammen aus dem Handbuch (Kapitel 5.2 «Inhalt des Dossiers») und entsprechen der Unterlagenliste in Richtlinie 1.3. Der fünfte Punkt des Handbuchs (5.2.5, Ausführungen zu den Kriterien) ist bewusst keine Zeile: das sind die Nachweise.
- `7.4.1` (Therapeutische Intervallberechnung, Soll) ist ein Unterpunkt von 7.4 ohne eigene Nummer in der Richtlinie.
- Muss/Soll stimmt für alle Zeilen überein, ausser bei den Auswahlkriterien des Kapitels 8:

| Nr. | Richtlinie | Katalog |
| --- | --- | --- |
| 8.1 | Muss, mindestens 2 von 5 (Anerkennung), mindestens 3 von 5 (Erneuerung) | Muss und Soll leer, min 2 und min 3 |
| 8.2 | Muss, mindestens 1 / mindestens 1 | Muss und Soll leer, min 1 und min 1 |
| 8.4 | Muss, mindestens 1 / mindestens 2 | Muss und Soll leer, min 1 und min 2 |

Die Richtlinie (Kap. 1.3) sagt: Das Muss besteht darin, aus den Vorschlägen die vorgegebene Anzahl Kriterien auszuwählen. Die App zeigt diese Zeilen heute als «nicht im Verfahren» und rechnet sie nicht als Muss. Das ist eine Modellfrage (Readiness-Regel), keine Datenabweichung; Änderung nur nach ausdrücklicher Entscheidung.

## Offen

- Auswahlkriterien (Kapitel 8) in der Readiness-Logik: Entscheidung Henrik.
- Gruppenzeilen ohne eigene Markierung (7.3, 8.1.1 bis 8.1.5) sind Überschriften bzw. Auswahloptionen.
