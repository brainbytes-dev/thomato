"""Die Prozesslandkarte eines Rettungsdienstes.

Diese Datei erfindet keine Prozesse. Jeder Teilprozess traegt die Kriterien,
aus denen er stammt, und wo kein Kriterium dahintersteht, sagt er stattdessen
seine Quelle. Damit ist die Landkarte nachpruefbar: Wer eine Zeile anzweifelt,
kann die Nummer anklicken und im Register nachlesen, worauf sie beruht.

Drei Baender, wie der Betrieb seine Prozesse selbst teilt und wie es die
Norm fuer eine Prozesslandkarte vorsieht: Fuehrungsprozesse steuern,
Kernprozesse leisten, Unterstuetzungsprozesse halten den Betrieb am Laufen.
Messen und Verbessern ist kein viertes Band, sondern gehoert zur Fuehrung:
Kapitel 8 der Richtlinie ist die Art, wie geleitet wird. Die Reihenfolge im
Kernprozess ist nicht gewaehlt, sondern vorgegeben: Es ist die Kette der zehn
Zeitpunkte nach Kriterium 7.4, vom Eingang des Notrufs bis zur
wiederhergestellten Einsatzbereitschaft.

Ein Kriterium darf mehrfach vorkommen. 7.3.8 Unterhalt und Kontrolle steht im
Kernprozess beim Retablieren und noch einmal in der Unterstuetzung, weil der
Betrieb es an beiden Stellen wirklich tut. Gezaehlt werden deshalb
Teilprozesse und nicht Kriterien; die Deckung der 56 Kriterien wird getrennt
ausgewiesen.
"""

# Die zehn Zeitpunkte nach Kriterium 7.4, in der Reihenfolge der Richtlinie.
# `spalte` nennt die Spalte der Einsatzliste, die den Zeitpunkt liefert.
# Steht dort None, fehlt der Zeitpunkt im Export, und jedes Intervall, das ihn
# braucht, ist nicht berechenbar. Geprueft an
# Aus dem Einsatzexport der Leitstelle, Blatt mit den bereinigten Zeiten.
# `nr` ist die Nummer der Richtlinie. Die ersten beiden Zeitpunkte tragen
# dort keine; sie bekommen hier auch keine erfundene, sondern einen Punkt.
ZEITPUNKTE = [
    {"code": "ereignis", "nr": None, "voll": "Ereigniszeit, wenn eruierbar",
     "name": "Ereigniszeit", "zusatz": "wenn eruierbar", "spalte": None},
    {"code": "notruf", "nr": None, "voll": "Eingang Notruf SNZ 144",
     "name": "Eingang Notruf", "zusatz": "SNZ 144", "spalte": "ZeitErfassung"},
    {"code": "alarm", "nr": "0", "voll": "Alarm Rettungsdienst",
     "name": "Alarm", "zusatz": "Rettungsdienst", "spalte": "ZeitDispo"},
    {"code": "ab", "nr": "1", "voll": "Ab zum Ereignisort",
     "name": "Ab zum", "zusatz": "Ereignisort", "spalte": "ZeitAus"},
    {"code": "vorort", "nr": "2", "voll": "Am Ereignisort",
     "name": "Am Ereignisort", "zusatz": "", "spalte": "ZeitAn"},
    {"code": "kontakt", "nr": "2a", "voll": "Erster Patientenkontakt",
     "name": "Erster Patienten-", "zusatz": "kontakt", "spalte": None},
    {"code": "abfahrt", "nr": "3", "voll": "Abfahrt Ereignisort",
     "name": "Abfahrt", "zusatz": "Ereignisort", "spalte": None},
    {"code": "ziel", "nr": "4", "voll": "Am Ziel",
     "name": "Am Ziel", "zusatz": "", "spalte": None},
    {"code": "uebergabe", "nr": "4a", "voll": "Patientenübergabe",
     "name": "Patienten-", "zusatz": "übergabe", "spalte": None},
    {"code": "bereit", "nr": "5", "voll": "Einsatzbereit",
     "name": "Einsatzbereit", "zusatz": "", "spalte": None},
]

# Die sechs Intervalle, die die Richtlinie aus diesen Zeitpunkten rechnet.
# `bahn` haelt die Klammern auseinander: die kurzen Intervalle liegen nah an
# der Kette, die langen darueber, damit sich keine zwei Klammern beruehren.
INTERVALLE = [
    {"name": "Ausrückzeit", "von": "alarm", "bis": "ab", "bahn": 0},
    {"name": "Zeit vor Ort", "von": "vorort", "bis": "abfahrt", "bahn": 0},
    {"name": "Hilfsfrist", "von": "alarm", "bis": "vorort", "bahn": 1},
    {"name": "Gesamthilfsfrist", "von": "notruf", "bis": "vorort", "bahn": 2},
    {"name": "Interventionszeit", "von": "alarm", "bis": "ziel", "bahn": 3},
    {"name": "Gesamteinsatzzeit", "von": "notruf", "bis": "bereit", "bahn": 4},
]


BAENDER = [
    {
        "schluessel": "fuehrung",
        "name": "Führungsprozesse",
        "rolle": "Was den Betrieb ausrichtet, bewilligt und zur Rechenschaft "
                 "zieht — und was ihn misst. Kapitel 8 der Richtlinie steht "
                 "deshalb hier und nicht daneben: Messen und Verbessern ist "
                 "keine eigene Sparte, sondern die Art, wie geführt wird. "
                 "Hier entscheidet sich, ob die Anerkennung getragen wird "
                 "oder nur verwaltet.",
        "prozesse": [
            {
                "name": "Qualitätsmanagement",
                "zweck": "Wie der Betrieb Qualität sicherstellt und darüber "
                         "Rechenschaft ablegt.",
                "ablauf": "kreis",
                "schritte": [
                    {"name": "Strategische Ausrichtung der "
                              "Qualitätssicherung darstellen",
                     "kriterien": ("6.1",)},
                    {"name": "Die zwanzig Betriebsabläufe im Handbuch führen",
                     "kriterien": ("7.3",),
                     "ziel": "/handbuch"},
                    {"name": "Bestehende rettungsdienstliche Prozesse "
                              "periodisch überprüfen",
                     "kriterien": ("8.2",)},
                    {"name": "Massnahmen führen, nachmessen, Wirksamkeit "
                              "belegen",
                     "kriterien": ("8.1",),
                     "ziel": "/massnahmen",
                     "quelle": "Massnahmenregister dieser Anwendung"},
                    {"name": "Jährlichen Qualitätsbericht an die "
                              "Geschäftsstelle IVR erstellen",
                     "kriterien": ("7.1",)},
                ],
            },
            {
                "name": "Betriebsauftrag und Aussendarstellung",
                "zweck": "Die Unterlagen, mit denen der Betrieb gegenüber "
                         "Behörden und IVR besteht.",
                "ablauf": "buendel",
                "schritte": [
                    {"name": "Bewilligung der zuständigen Behörden halten",
                     "kriterien": (),
                     "quelle": "Dossier 2024, Ordner 5.02.01"},
                    {"name": "Organigramm des Rettungsdienstes führen",
                     "kriterien": (),
                     "quelle": "Dossier 2024, Ordner 5.02.02"},
                    {"name": "Vorstellung des Rettungsdienstes bereithalten",
                     "kriterien": (),
                     "quelle": "Dossier 2024, Ordner 5.02.03"},
                    {"name": "Jahresberichte mit Einsatzstatistik vorlegen",
                     "kriterien": (),
                     "quelle": "Dossier 2024, Ordner 5.02.04"},
                ],
            },
            {
                "name": "Fachliche Leitung und Delegation",
                "zweck": "Wer welche Massnahme anordnen und durchführen darf, "
                         "und wie lange das gilt.",
                "ablauf": "kette",
                "schritte": [
                    {"name": "Fachliche Leitung durch Rettungssanitäter HF "
                              "und Notarzt SGNOR sicherstellen",
                     "kriterien": ("6.8",)},
                    {"name": "Ärztlich delegierte Massnahmen ad personam und "
                              "befristet erteilen",
                     "kriterien": ("6.9",)},
                    {"name": "Notarzt-Tätigkeiten regelhaft delegieren",
                     "kriterien": ("6.10",)},
                    {"name": "Notarztindikationsliste führen und Alarmierung "
                              "regeln",
                     "kriterien": ("7.3.7",)},
                ],
            },
            {
                "name": "Personalplanung und Verfügbarkeit",
                "zweck": "Genug Teams zur richtigen Zeit, in der "
                         "vorgeschriebenen Zusammensetzung.",
                "ablauf": "kette",
                "schritte": [
                    {"name": "Stellenbeschreibung aller Chargen halten",
                     "kriterien": ("7.3.2",)},
                    {"name": "Teams nach der zu erwartenden Einsatzlast "
                              "planen",
                     "kriterien": ("6.7",)},
                    {"name": "Dienstplanung führen",
                     "kriterien": ("7.3.1",)},
                    {"name": "Einsatzequipe nach Dringlichkeitsstufe "
                              "zusammensetzen",
                     "kriterien": ("7.8",)},
                    {"name": "Primäreinsätze rund um die Uhr sicherstellen",
                     "kriterien": ("6.4",)},
                ],
            },
            {
                "name": "Anerkennungsverfahren IVR",
                "zweck": "Der Vier-Jahres-Takt, an dem der Betrieb hängt. Die "
                         "Anerkennung läuft bis zum 25.04.2028.",
                "ablauf": "kreis",
                "schritte": [
                    {"name": "Antrag auf Erneuerung stellen, ein halbes Jahr "
                              "vor Ablauf",
                     "kriterien": (),
                     "quelle": "Richtlinie, Fristen · bis 25.10.2027"},
                    {"name": "Vollständiges Dossier und Besuchstermin "
                              "einreichen",
                     "kriterien": (),
                     "ziel": "/",
                     "quelle": "Richtlinie, Fristen · bis 25.12.2027"},
                    {"name": "Expertenbesuch durchführen lassen",
                     "kriterien": (),
                     "quelle": "Expertenbericht vom 03.04.2024"},
                    {"name": "Auflagen erfüllen und nachweisen",
                     "kriterien": (),
                     "quelle": "vier Auflagen 2024, alle erfüllt"},
                ],
            },
            {
                "name": "Prozessmonitoring nach 8.1",
                "zweck": "Fünf Bereiche, von denen zur Erneuerung drei einen "
                         "geschlossenen Kreislauf zeigen müssen.",
                "ablauf": "buendel",
                "schritte": [
                    {"name": "Angemessenheitsmonitoring führen",
                     "kriterien": ("8.1.1",),
                     "ziel": "/bereich/8.1.1"},
                    {"name": "Fehler-, Ereignis- und Risikomonitoring "
                              "auswerten",
                     "kriterien": ("8.1.2",),
                     "ziel": "/bereich/8.1.2",
                     "quelle": "Erfassung in EMRIS, ausserhalb dieser "
                                "Anwendung"},
                    {"name": "Beschwerdemanagement führen",
                     "kriterien": ("8.1.3",),
                     "ziel": "/faelle"},
                    {"name": "Zufriedenheitsmonitoring durchführen",
                     "kriterien": ("8.1.4",),
                     "ziel": "/bereich/8.1.4",
                     "quelle": "Befragung mit Microsoft, Ergebnis als Excel"},
                    {"name": "Selbstgewähltes Prozesskriterium messen",
                     "kriterien": ("8.1.5",),
                     "ziel": "/bereich/8.1.5"},
                    {"name": "Drei von fünf Monitoringbereichen belegen",
                     "kriterien": ("8.1",),
                     "fuehrt_zusammen": True},
                ],
            },
            {
                "name": "Analyse der Zeiterfassung",
                "zweck": "Was die vier vorhandenen Zeitpunkte hergeben, und "
                         "was ohne die fehlenden sechs nicht zu rechnen ist.",
                "ablauf": "buendel",
                "schritte": [
                    {"name": "Hilfsfrist auswerten, Richtwert 15 Minuten in "
                              "90 Prozent",
                     "kriterien": ("8.3",),
                     "ziel": "/analysen"},
                    {"name": "Ausrückzeit auswerten",
                     "kriterien": ("8.3",)},
                    {"name": "Zeit vor Ort auswerten",
                     "kriterien": ("8.3",),
                     "quelle": "ohne Zeitpunkt 3 nicht berechenbar"},
                ],
            },
            {
                "name": "Indikatordiagnosen",
                "zweck": "Messdaten zu einer definierten Diagnose in einem "
                         "definierten Zeitraum.",
                "ablauf": "kette",
                "schritte": [
                    {"name": "Messdaten zu einer Indikatordiagnose erheben "
                              "und bewerten",
                     "kriterien": ("8.4",)},
                    {"name": "First Hour Quintett auswerten",
                     "kriterien": ("8.4",),
                     "quelle": "Einsatzliste 2025, Spalten HD_is_*"},
                ],
            },
            {
                "name": "Reanimationsdaten",
                "zweck": "Die Erhebung endet nicht mit der Eingabe in "
                         "SWISSRECA, sie ist die Grundlage der Auswertung.",
                "ablauf": "kette",
                "schritte": [
                    {"name": "Daten zeitnah an SWISSRECA übermitteln",
                     "kriterien": ("7.10",)},
                    {"name": "Reanimationsdaten auswerten und analysieren",
                     "kriterien": ("8.5",),
                     "quelle": "SWISSRECA-Jahresbericht als PDF"},
                ],
            },
            {
                "name": "Der Qualitätskreislauf",
                "zweck": "Der Ablauf, der 2024 dreimal gefehlt hat. Die Daten "
                         "waren da, die Auswertung und die Massnahme nicht.",
                "ablauf": "kreis",
                "schritte": [
                    {"name": "Ausgangswert messen und Zielvorgabe vorher "
                              "festlegen",
                     "kriterien": (),
                     "ziel": "/massnahmen",
                     "quelle": "Schritt 1 von 4"},
                    {"name": "Massnahme beschliessen und zuweisen",
                     "kriterien": (),
                     "ziel": "/massnahmen",
                     "quelle": "Schritt 2 von 4"},
                    {"name": "Wirkungszeit abwarten, realistisch zwölf "
                              "Monate",
                     "kriterien": (),
                     "quelle": "Schritt 3 von 4"},
                    {"name": "Nachmessen und Wirksamkeit belegen",
                     "kriterien": (),
                     "ziel": "/massnahmen",
                     "quelle": "Schritt 4 von 4"},
                ],
            },
        ],
    },
    {
        "schluessel": "kern",
        "name": "Kernprozesse",
        "rolle": "Die Leistung selbst, vom Notruf bis zur wiederhergestellten "
                 "Einsatzbereitschaft. Die Reihenfolge ist nicht gewählt, sie "
                 "ist die Kette der zehn Zeitpunkte nach Kriterium 7.4.",
        "prozesse": [
            {
                "name": "Alarmierung und Disposition",
                "zweck": "Der Einsatz beginnt ausserhalb des Betriebs, in der "
                         "Sanitätsnotrufzentrale.",
                "ablauf": "kette",
                "schritte": [
                    {"name": "Notruf geht bei der SNZ 144 ein",
                     "kriterien": ("7.4",),
                     "quelle": "Einsatzliste, Spalte ZeitErfassung"},
                    {"name": "Disposition durch die zuständige SNZ 144",
                     "kriterien": ("6.2",)},
                    {"name": "Dringlichkeit festlegen, P1 bis P3 und S1 bis "
                              "S4",
                     "kriterien": ("7.2",)},
                    {"name": "Alarm an den Rettungsdienst, Zeitpunkt 0",
                     "kriterien": ("7.4",),
                     "quelle": "Einsatzliste, Spalte ZeitDispo"},
                    {"name": "Notarzt nach Indikationsliste aufbieten",
                     "kriterien": ("7.3.7", "6.10")},
                    {"name": "Zwei unabhängige Kommunikationsmittel halten",
                     "kriterien": ("6.3.1",),
                     "dauernd": True},
                    {"name": "Statusmeldungen und Position an die SNZ "
                              "übermitteln",
                     "kriterien": ("6.3.2",),
                     "dauernd": True},
                ],
            },
            {
                "name": "Ausrücken",
                "zweck": "Von der Alarmierung bis zur Abfahrt. Das Handbuch "
                         "verlangt ausdrücklich einen Fokus auf diese Spanne.",
                "ablauf": "kette",
                "schritte": [
                    {"name": "Einsatzequipe nach Dringlichkeit stellen",
                     "kriterien": ("7.8", "6.7")},
                    {"name": "Ab zum Ereignisort, Zeitpunkt 1",
                     "kriterien": ("7.4",),
                     "quelle": "Einsatzliste, Spalte ZeitAus"},
                    {"name": "Ausrückzeit messen, Zeitpunkt 0 bis 1",
                     "kriterien": ("8.3",)},
                    {"name": "Rettungswagen Typ C einsatzbereit halten",
                     "kriterien": ("6.5.1",),
                     "dauernd": True},
                    {"name": "Ausrüstung nach IVR-Richtlinie mitführen",
                     "kriterien": ("6.5.2",),
                     "dauernd": True},
                ],
            },
            {
                "name": "Anfahrt und Eintreffen",
                "zweck": "Die Spanne, an der der Betrieb gemessen wird: 15 "
                         "Minuten in 90 Prozent der P1-Einsätze.",
                "ablauf": "kette",
                "schritte": [
                    {"name": "Am Ereignisort, Zeitpunkt 2",
                     "kriterien": ("7.4",),
                     "quelle": "Einsatzliste, Spalte ZeitAn"},
                    {"name": "Hilfsfrist einhalten, Zeitpunkt 0 bis 2",
                     "kriterien": ("8.3",),
                     "quelle": "2025 gemessen: 95,7 Prozent unter 15 Minuten"},
                    {"name": "Gesamthilfsfrist auswerten, Notruf bis "
                              "Zeitpunkt 2",
                     "kriterien": ("8.3", "7.4")},
                ],
            },
            {
                "name": "Versorgung am Ereignisort",
                "zweck": "Die eigentliche Leistung. Hier greifen Algorithmen, "
                         "Delegation und Patientenrechte ineinander.",
                "ablauf": "kette",
                "schritte": [
                    {"name": "Erster Patientenkontakt, Zeitpunkt 2a",
                     "kriterien": ("7.4",),
                     "quelle": "fehlt im Export der soH"},
                    {"name": "Nach Einsatzalgorithmen behandeln",
                     "kriterien": ("7.3.16",)},
                    {"name": "Ärztlich delegierte Massnahmen anwenden",
                     "kriterien": ("6.9", "6.10")},
                    {"name": "Einsatzablauf und Kommunikation im Einsatz "
                              "führen",
                     "kriterien": ("7.3.14",)},
                    {"name": "Patientenrechte wahren",
                     "kriterien": ("7.3.20",),
                     "dauernd": True},
                    {"name": "Mit Partnerorganisationen und Respondern "
                              "zusammenarbeiten",
                     "kriterien": ("7.3.11",),
                     "dauernd": True},
                ],
            },
            {
                "name": "Transport und Zielklinik",
                "zweck": "Wohin der Patient gebracht wird, und wie lange der "
                         "Aufenthalt vor Ort gedauert hat.",
                "ablauf": "kette",
                "schritte": [
                    {"name": "Zielklinik nach betriebseigener Richtlinie "
                              "wählen",
                     "kriterien": ("7.3.12",)},
                    {"name": "Abfahrt Ereignisort, Zeitpunkt 3",
                     "kriterien": ("7.4",),
                     "quelle": "fehlt im Export der soH"},
                    {"name": "Am Ziel, Zeitpunkt 4",
                     "kriterien": ("7.4",),
                     "quelle": "fehlt im Export der soH"},
                    {"name": "Zeit vor Ort auswerten, Zeitpunkt 2 bis 3",
                     "kriterien": ("8.3",),
                     "quelle": "aus dem Export nicht berechenbar"},
                ],
            },
            {
                "name": "Übergabe",
                "zweck": "Die Schnittstelle zum Spital. Strukturiert, damit "
                         "nichts verloren geht.",
                "ablauf": "kette",
                "schritte": [
                    {"name": "Patienten strukturiert übergeben",
                     "kriterien": ("7.3.17",)},
                    {"name": "Patientenübergabe, Zeitpunkt 4a",
                     "kriterien": ("7.4",),
                     "quelle": "fehlt im Export der soH"},
                    {"name": "Zielort, übernehmendes Team und Zustand bei "
                              "Übergabe dokumentieren",
                     "kriterien": ("7.5",)},
                ],
            },
            {
                "name": "Retablierung und Einsatzbereitschaft",
                "zweck": "Der Einsatz ist erst zu Ende, wenn das Fahrzeug "
                         "wieder vollständig ist. Genau hier setzte die "
                         "EMRIS-Meldung an, die das Handbuch als Beispiel "
                         "nennt.",
                "ablauf": "kette",
                "schritte": [
                    {"name": "Hygienemassnahmen nach dem Einsatz durchführen",
                     "kriterien": ("7.3.10",)},
                    {"name": "Fahrzeug und Material retablieren",
                     "kriterien": ("7.3.8",),
                     "quelle": "EMRIS-Beispiel: Fahrzeug bei Dienstübernahme "
                                "nicht vollständig"},
                    {"name": "Einsatzbereit, Zeitpunkt 5",
                     "kriterien": ("7.4",),
                     "quelle": "fehlt in allen Exporten"},
                ],
            },
            {
                "name": "Dokumentation und Nachbearbeitung",
                "zweck": "Was nach dem Einsatz entsteht, ist die Grundlage "
                         "jeder späteren Auswertung.",
                "ablauf": "kette",
                "schritte": [
                    {"name": "Einsatzprotokoll führen",
                     "kriterien": ("6.11", "6.11.1")},
                    {"name": "Basisdatensatz vollständig erfassen",
                     "kriterien": ("7.5",)},
                    {"name": "Die zehn Zeitpunkte erfassen",
                     "kriterien": ("7.4",),
                     "quelle": "vier der zehn liefert der Export"},
                    {"name": "Einsatz im Team nachbesprechen",
                     "kriterien": ("7.6",)},
                    {"name": "Reanimationsdaten an SWISSRECA übermitteln",
                     "kriterien": ("7.10",)},
                    {"name": "Elektronisches Einsatzprotokoll führen",
                     "kriterien": ("6.11.2",),
                     "dauernd": True},
                    {"name": "Zugriff auf das elektronische Patientendossier "
                              "sicherstellen",
                     "kriterien": ("6.11.3",),
                     "dauernd": True},
                ],
            },
            {
                "name": "Besondere Lagen und Sonderfälle",
                "zweck": "Was selten vorkommt und deshalb eine geschriebene "
                         "Regel braucht.",
                "ablauf": "buendel",
                "schritte": [
                    {"name": "Besondere und ausserordentliche Lagen "
                              "bewältigen",
                     "kriterien": ("7.3.9",)},
                    {"name": "Vorgehen im Todesfall eines Patienten",
                     "kriterien": ("7.3.15",)},
                    {"name": "Fürsorgerische Unterbringung durchführen",
                     "kriterien": ("7.3.18",)},
                    {"name": "Belastende Einsätze psychologisch aufarbeiten",
                     "kriterien": ("7.3.13",)},
                    {"name": "Besatzung eines Rettungshelikopters stellen",
                     "kriterien": ("7.9",)},
                ],
            },
        ],
    },
    {
        "schluessel": "unterstuetzung",
        "name": "Unterstützungsprozesse",
        "rolle": "Was der Kernprozess braucht, um überhaupt stattfinden zu "
                 "können. Im Alltag unsichtbar, beim Prüfbesuch nicht.",
        "prozesse": [
            {
                "name": "Personal führen und entwickeln",
                "zweck": "Sechzehn Mitarbeitende, von der Einführung bis zu "
                         "den vierzig Fortbildungsstunden im Jahr.",
                "ablauf": "kette",
                "schritte": [
                    {"name": "Neue Mitarbeitende einführen",
                     "kriterien": ("7.3.4",)},
                    {"name": "Mitarbeitergespräch und -dialog führen",
                     "kriterien": ("7.3.3",)},
                    {"name": "Fort- und Weiterbildung, mindestens 40 Stunden "
                              "je Mitarbeitendem und Jahr",
                     "kriterien": ("7.7",)},
                    {"name": "Auszubildende einführen und begleiten",
                     "kriterien": ("7.3.6",),
                     "dauernd": True},
                ],
            },
            {
                "name": "Material, Fahrzeuge und Bekleidung",
                "zweck": "Was gefahren, getragen und mitgeführt wird, und wer "
                         "es kontrolliert.",
                "ablauf": "buendel",
                "schritte": [
                    {"name": "Fahrzeuge, Geräte und Verbrauchsmaterial "
                              "unterhalten und kontrollieren",
                     "kriterien": ("7.3.8",)},
                    {"name": "Minimale Rettungsmittel vorhalten",
                     "kriterien": ("6.5.1",)},
                    {"name": "Ausrüstung der Rettungsmittel nach IVR- "
                              "Richtlinie halten",
                     "kriterien": ("6.5.2",)},
                    {"name": "IVR-Bekleidungsrichtlinien einhalten",
                     "kriterien": ("6.6",)},
                ],
            },
            {
                "name": "Hygiene",
                "zweck": "Eigener Betriebsablauf nach 7.3, und zugleich der "
                         "Kreislauf, an dem die Wirksamkeit gemessen wird.",
                "ablauf": "kette",
                "schritte": [
                    {"name": "Hygienekonzept führen und umsetzen",
                     "kriterien": ("7.3.10",)},
                    {"name": "Fahrzeug und Material nach dem Einsatz "
                              "aufbereiten",
                     "kriterien": ("7.3.10", "7.3.8")},
                ],
            },
            {
                "name": "Arbeitssicherheit und Gesundheitsschutz",
                "zweck": "Der Schutz der eigenen Leute, vor und nach dem "
                         "Einsatz.",
                "ablauf": "buendel",
                "schritte": [
                    {"name": "Richtlinien und Massnahmen für die "
                              "Arbeitssicherheit führen",
                     "kriterien": ("7.3.19",)},
                    {"name": "Psychologische Aufarbeitung belastender "
                              "Einsätze anbieten",
                     "kriterien": ("7.3.13",)},
                ],
            },
            {
                "name": "Information und Kommunikation",
                "zweck": "Innerbetrieblich auf- und absteigend, nach aussen "
                         "zu SNZ und Partnern.",
                "ablauf": "buendel",
                "schritte": [
                    {"name": "Innerbetriebliche Information und "
                              "Kommunikation regeln",
                     "kriterien": ("7.3.5",)},
                    {"name": "Zusammenarbeit mit Partnerorganisationen "
                              "beschreiben",
                     "kriterien": ("7.3.11",)},
                    {"name": "Kommunikation mit der SNZ 144 sicherstellen",
                     "kriterien": ("6.3.1", "6.3.2")},
                ],
            },
        ],
    },
]


def alle_kriterien():
    """Jede Kriteriumsnummer, die irgendwo auf der Landkarte vorkommt.

    Damit laesst sich pruefen, ob die Landkarte die 56 Kriterien wirklich
    deckt. Eine Luecke waere ein Prozess, den der Betrieb nicht beschrieben
    hat, und genau das soll sichtbar werden statt unbemerkt zu bleiben.
    """
    nummern = set()
    for band in BAENDER:
        for prozess in band["prozesse"]:
            for schritt in prozess["schritte"]:
                nummern.update(schritt["kriterien"])
    return nummern
