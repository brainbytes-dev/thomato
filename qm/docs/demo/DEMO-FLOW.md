# Demo-Ablauf: QM Rettungsdienst (8 bis 12 Minuten)

Ziel: In einer Sitzung zeigen, dass die Arbeitsfläche Lücken sichtbar macht, Nachweise sauber versioniert und jede Änderung nachvollziehbar festhält. Die App ist eine interne Arbeitsbewertung auf Basis eines nicht validierten Katalog-Entwurfs. Sie trifft keine Entscheidung des IVR und stellt keine IVR-Zertifizierung in Aussicht. Das gilt für jeden Satz der Präsentation.

## Kernbotschaft (so kurz wie möglich)

1. **86 % dokumentiert. Trotzdem kritisch.**
2. **Zwei Pflichtkriterien verhindern die Readiness.**
3. **Hier sehen wir warum, wer handeln muss, bis wann, und welche Nachweise fehlen oder veraltet sind.**

Alles im Ablauf unten dient diesen drei Sätzen. Wenn die Zeit knapp wird, genügen die Schritte 2 bis 9. Fortschritt und Readiness bleiben getrennte Aussagen: Der Prozentwert beeinflusst den Status nie.

## Vorbereitung (vor dem Termin, 5 Minuten)

1. Aufruf nur über `https://qm-rettungsdienst-demo-git-feat-qm-abeddf-brain-byt-es-projects.vercel.app` (der Alias legt die erlaubte Herkunft fest). Das Deployment ist durch Vercel Authentication geschützt; wer präsentiert, ist bei Vercel angemeldet.
2. Zugänge: `owner@demo.qm.test`, `qm-admin@demo.qm.test`, `reviewer@demo.qm.test`, `editor@demo.qm.test`, `viewer@demo.qm.test`. Das Passwort steht nicht im Repo und wird separat übergeben.
3. Frischer Stand: Die Demo verändert Daten (neue Version, geänderter Stand). Vor jedem Termin neu seeden (siehe README, Abschnitt «Stand des Demo-Deployments»).
4. Datei zum Hochladen: `qm/docs/demo/hygienekonzept-demo-v2.pdf` (synthetisch, 611 Bytes).
5. Anmeldungen: Die Anmeldung ist auf wenige Versuche pro Zeitfenster begrenzt. Zwischen Rollenwechseln ein paar Sekunden warten.
6. Ausweichmaterial: `qm/docs/demo/screenshots/` (Übersicht, Handlungsbedarf, Kriterium, Versionen, Verlauf).

## Ablauf

| Min | Schritt | Was gezeigt wird | Satz dazu |
| --- | --- | --- | --- |
| 0:00 | 1. Anmelden als Owner | Login, Organisation «Rettungsdienst Musterstadt - Demo», Rolle «Inhaber» | «Eine Organisation pro Zugang, Rollen sind serverseitig durchgesetzt.» |
| 0:30 | 2. Übersicht | Karte «Readiness» mit Status «Kritisch», Dokumentationsstand 86 %, 43 von 50 Kriterien erfüllt | «Fortschritt und Bereitschaft sind getrennte Zahlen. 86 % Fortschritt heissen nicht bereit.» |
| 1:30 | 3. Warum kritisch | Zwei kritische Pflichtkriterien, drei offene, zwei als nicht anwendbar markierte Pflichtkriterien mit Link | «Nicht anwendbar geht nur mit Begründung und steht offen in der Übersicht.» |
| 2:30 | 4. Braucht Aufmerksamkeit | Priorisierte Liste: kritische Punkte, veraltete Nachweise, überfällige Massnahme, Frist in 20 Tagen, gebündelter Hinweis auf fehlende Nachweise | «Die Liste sagt, was als Nächstes zu tun ist, nicht nur, was fehlt.» |
| 3:30 | 5. Kriterium 7.3.10 Hygiene | Stand, Frist, Nachweis «Veraltet», verknüpftes Dokument mit Ablaufdatum 08.09.2026 | «Ein abgelaufener Nachweis ändert den Stand nicht automatisch, er wird aber sichtbar.» |
| 4:30 | 6. Neue Version hochladen | «Neue Version hochladen» mit `hygienekonzept-demo-v2.pdf`, Gültigkeit in der Zukunft | «Alte Versionen bleiben unveränderlich erhalten.» |
| 5:30 | 7. Versionen und Verlauf | «Versionen anzeigen»: V2 neueste, V1 ersetzt, Download beider. Darunter der Verlauf mit Upload und neuer Version | «Wer hat wann was hochgeladen: lückenlos, nicht nachträglich änderbar.» |
| 6:30 | 8. Stand bewusst setzen | Stand auf «Erfüllt», Verlauf zeigt den Statuswechsel | «Der Nachweis allein setzt nichts. Die Entscheidung bleibt bei der verantwortlichen Person.» |
| 7:00 | 9. Zurück zur Übersicht | Kritische Pflichtkriterien 2 auf 1, veralteter Nachweis weg, Readiness weiterhin «Kritisch» | «Die Wirkung ist sofort sichtbar, ohne dass die Bewertung geschönt wird.» |
| 7:45 | 10. Massnahmen | Kriterium 7.3.8: Massnahme mit Verantwortlicher und Frist, Status setzen | «Aus Lücken werden Massnahmen mit Frist und Verantwortung.» |
| 8:30 | 11. Dokumente | Seite «Dokumente»: alle Nachweise, Zuordnung zu Kriterien | «Ein Dokument kann mehrere Kriterien belegen.» |
| 9:15 | 12. Rolle Viewer | Anmelden als `viewer@demo.qm.test`: nur Lesen, keine Formulare, kein Verlauf | «Lesen und Schreiben sind getrennt, auch Verlauf und Audit sind rollenabhängig.» |
| 10:00 | 13. Rolle Reviewer (optional) | Schreiben möglich, Verlauf nicht sichtbar | «Prüfende sehen den Stand, den Audit-Verlauf lesen nur Inhaber und QM-Administration.» |
| 10:45 | 14. Dunkler Modus (optional) | Systemeinstellung wechseln, die Oberfläche folgt | «Gleiche Informationen, für lange Arbeitstage.» |
| 11:15 | 15. Abschluss | Hinweis auf den Entwurfsstatus des Katalogs, nächste Schritte | «Nächster Schritt ist die Abstimmung des Katalogs mit dem IVR.» |

## Wenn etwas hakt

- Login schlägt fehl: kurz warten (Anmeldebegrenzung), erneut versuchen.
- Hochladen schlägt fehl: Datei grösser als 4 MiB oder falsches Format; die Meldung ist auf Deutsch und das Formular behält die Eingaben.
- Seite zeigt eine Fehlermeldung: «Erneut versuchen» lädt neu; «Zur Übersicht» führt zurück.
- Gar nichts geht: Screenshots in `docs/demo/screenshots/` zeigen den Ablauf.

## Nach dem Termin

Neu seeden, damit der Ausgangszustand wieder stimmt.
