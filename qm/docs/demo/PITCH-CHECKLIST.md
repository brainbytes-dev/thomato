# Pitch-Checkliste: Fragen an den IVR und offene Punkte

Stand: 2026-10-08. Diese Liste gehört in die Vorbereitung des Gesprächs vom 17.11.2026. Sie enthält keine Geheimnisse.

## Fragen an den IVR (Rechte und Fachlichkeit)

1. **Nutzungsrechte an den Texten (Lizenzfrage).** Die Richtlinien und das Handbuch sind urheberrechtlich geschützt. Aktuell zeigt die App keinen Richtlinientext, sondern eigene Zusammenfassungen und Links auf die offiziellen PDFs bei 144.ch.
   - Darf die App Kriterientexte (die Vorgaben pro Kriterium) wörtlich anzeigen, mit Quellenangabe und Link?
   - Darf sie die offiziellen PDFs einbetten oder nur verlinken?
   - Gibt es eine maschinenlesbare Fassung oder eine Lizenz (zum Beispiel für den Kriterienkatalog)?
   - Wie geht der IVR mit Folgeversionen um (Ausgabe 08/2025 «Version 2022»): Wie erfahren wir von Änderungen?
2. **Auswahlkriterien im Kapitel 8.** Richtlinie 1.3: Das Muss besteht darin, aus den Vorschlägen die vorgegebene Anzahl auszuwählen (8.1: mindestens 2 von 5, bei Erneuerung 3 von 5; 8.2 und 8.4 ähnlich). Bestätigt der IVR diese Lesart, damit wir die Readiness-Regel korrekt abbilden?
3. **Dossier-Unterlagen.** Die vier Unterlagen aus Handbuch 5.2.1 bis 5.2.4 (Bewilligung, Organigramm, Vorstellung, Jahresberichte): Sind sie im Verfahren als einreichungspflichtig zu behandeln, und werden sie im Expertenbericht wie Kriterien bewertet?
4. **Katalog «geprüft».** Der Katalog ist gegen die Ausgabe 08/2025 abgeglichen (siehe `qm/docs/catalog/richtlinie-abgleich-2025-08.md`), aber bleibt «Entwurf, nicht validiert», bis der IVR ihn bestätigt. Ist eine Bestätigung oder ein Review möglich?
5. **Wording.** Die App ist eine interne Arbeitsbewertung und kein offizielles IVR-Werkzeug. Passt die Formulierung für den IVR, oder wünscht er einen Hinweis?

6. **Wissensseiten.** Die App zeigt unter «Wissen» eigene Zusammenfassungen der Kapitel 1 bis 5 und des Anhangs mit Seitenverweis auf das offizielle PDF (kein Richtlinientext). Ist das aus Sicht des IVR in Ordnung, und möchte er die Formulierung des Hinweises («Zusammenfassung. Massgebend ist die offizielle IVR-Richtlinie.») ändern?

## Eigene offene Punkte vor dem Termin

- Produktname: «QM Rettungsdienst» ist der Arbeitstitel (Markenfrage offen).
- Zugang: Demo nur per Bildschirmfreigabe (Entscheid vom 2026-10-08). Falls der IVR selbst klicken soll, braucht es vorher einen kontrollierten Zugang.
- Plan 8 (8/4-Detail, Massnahmen-Register, PDCA) in den Demo-Stand übernehmen, dann Generalprobe mit `DEMO-FLOW.md` und neuen Tag setzen.
- Wissenstexte fachlich prüfen (Henrik) und dann die Markierung «Entwurf» ausschalten (`WISSEN_DRAFT=false`).
- Passwörter und Schlüssel: nur in `~/.config/qm-demo/secrets.env`, siehe `ACCESS.md`.

## Mitbringen

- Fallback-Screenshots (`qm/docs/demo/screenshots/`) für das Deck.
- Die drei Kernsätze aus `DEMO-FLOW.md`.
