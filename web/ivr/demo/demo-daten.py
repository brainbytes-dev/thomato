"""Baut eine Demodatenbank mit erfundenen Daten.

Alles hier ist frei erfunden: der Betrieb «Rettungsdienst Musterstadt»
existiert nicht, die Beschwerden, Messwerte und Dokumente auch nicht. Kein
Wert stammt aus einem echten Betrieb, und kein Satz aus der Richtlinie des
IVR. Die Kriterien stehen mit Nummer, Titel und Kapitel in
«kriterien.json»; ihre Erlaeuterungen gehoeren dem IVR und sind hier nicht
enthalten.

Die Fristen rechnen ab dem Tag des Aufrufs. So zeigt die Demo immer eine
laufende Anerkennung und nicht eine, die vor zwei Jahren abgelaufen ist.

Aufruf aus dem Ordner der Anwendung:

    python ../demo/demo-daten.py

Vorhandene Daten werden dabei geloescht.
"""

import json
import random
import shutil
import sys
from datetime import date, timedelta
from pathlib import Path

HIER = Path(__file__).resolve().parent
ANWENDUNG = HIER.parent / "anwendung"
sys.path.insert(0, str(ANWENDUNG))

import anmeldung  # noqa: E402
import datenbank  # noqa: E402
import handbuch  # noqa: E402
import pfade  # noqa: E402

HEUTE = date.today()
zufall = random.Random(20260915)   # dieselbe Demo bei jedem Lauf


def tage(n):
    return (HEUTE + timedelta(days=n)).isoformat()


BETRIEB = "Rettungsdienst Musterstadt"

# Die Uhr der Demo: Anerkennung laeuft in gut anderthalb Jahren ab, das
# Dossier ist vier Monate vorher faellig, der Antrag sechs.
FRISTEN = {
    "betrieb": BETRIEB,
    "ablauf": tage(580),
    "antrag": tage(400),
    "dossier": tage(460),
    "tragende": "8.1.1,8.1.2,8.1.4",
    "zyklus": "dmaic",
}

# Ein erfundener Expertenbericht. Die Vorlagen beschriften den Stand
# als «2024»; die Demo bleibt bei diesem Jahr, sonst stehen zwei
# nebeneinander. Erfuellt ist die Regel, die Ausnahmen
# stehen hier und sind die Geschichte, die die Demo erzaehlt.
STAND_2024 = {
    "6.9": "Auflage",
    "6.10": "Auflage",
    "7.3.10": "nicht erfüllt",
    "7.3.19": "teilweise erfüllt",
    "8.1.1": "nicht erfüllt",
    "8.1.2": "nicht erfüllt",
    "8.1.4": "nicht erfüllt",
    "8.1.5": "nicht erfüllt",
    "8.2": "nicht erfüllt",
}

EMPFEHLUNG_2024 = {
    "6.9": "Die Kompetenzerteilung ist für alle Anstellungsarten gleich zu "
           "beschreiben, auch für Aushilfen.",
    "6.10": "Die Delegation ärztlicher Tätigkeiten ist nachvollziehbar zu "
            "regeln und die Rücksprache zu dokumentieren.",
    "7.3.10": "Das Hygienekonzept ist zu überarbeiten und den Mitarbeitenden "
              "nachweislich bekannt zu machen.",
    "7.3.19": "Die Gefährdungsbeurteilung ist auf die Werkstatt auszuweiten.",
    "8.1.1": "Aus der Auswertung der Einsätze sind Massnahmen abzuleiten.",
    "8.1.2": "Die Meldungen sind auszuwerten und Erkenntnisse festzuhalten.",
    "8.1.4": "Die Befragung ist auszuwerten und daraus zu handeln.",
    "8.1.5": "Ein eigenes Prozesskriterium ist zu wählen und zu bearbeiten.",
    "8.2": "Die Indikatordiagnosen sind zu bestimmen und zu erheben.",
}

KOMMENTARE = {
    "7.3.10": [("Das Konzept liegt überarbeitet vor, Schulung am "
                "Weiterbildungstag durchgeführt.", "A. Muster")],
    "6.9": [("Der Abschnitt zu den Aushilfen ist ergänzt und von der "
             "ärztlichen Leitung freigegeben.", "A. Muster")],
}

BEHOBEN = {"7.3.10": ("A. Muster", tage(-120))}

AUFLAGEN = [
    ("6.9", "Die Kompetenzerteilung ist für alle Anstellungsarten gleich zu "
            "beschreiben und nachzuweisen.", "Rezertifizierung 2024",
     tage(-300), tage(-280)),
    ("6.10", "Die Delegation ärztlicher Tätigkeiten ist zu regeln, die "
             "telefonische Rücksprache lückenlos zu dokumentieren.",
     "Rezertifizierung 2024", tage(-300), tage(-250)),
    ("8.1.2", "Die Ereignismeldungen sind jährlich auszuwerten; aus der "
              "Auswertung sind Massnahmen abzuleiten.", "Rezertifizierung 2024",
     tage(120), None),
]

# --- Die Qualitätskreisläufe ------------------------------------------------
# Jeder Kreislauf ist eine Geschichte: was war das Problem, was wurde
# gemessen, woran lag es, was wurde getan, was kam dabei heraus.
KREISLAEUFE = [
    {
        "kriterium": "8.1.1", "strang": "notarzt",
        "ausloeser": "Rückmeldungen aus der Einsatznachbesprechung",
        "definition": "Bei Einsätzen mit Notarztindikation wird der Notarzt "
                      "uneinheitlich aufgeboten. Ziel: In jedem Einsatz mit "
                      "Indikation ist das Aufgebot dokumentiert.",
        "analyse": "Die Indikationsliste ist zweideutig formuliert und den "
                   "Teams nur als Anhang bekannt. Die Leitstelle disponiert "
                   "nach eigener Lesart.",
        "beschreibung": "Indikationsliste neu gefasst, mit der Leitstelle "
                        "abgestimmt und an allen Fahrzeugen ausgehängt.",
        "verantwortlich": "A. Muster",
        "gemessen_am": tage(-430), "messwert": "27 von 118 Einsätzen ohne "
                                               "dokumentiertes Aufgebot",
        "frist": tage(-150),
        "nachgemessen_am": tage(-140),
        "nachmessung_ergebnis": "6 von 121 Einsätzen ohne dokumentiertes "
                                "Aufgebot",
    },
    {
        "kriterium": "8.1.1", "strang": "uebergabe",
        "ausloeser": "Hinweis der Zielklinik",
        "definition": "Die strukturierte Übergabe im Schockraum wird nicht "
                      "einheitlich angewandt. Ziel: ein Schema, das alle "
                      "kennen und benutzen.",
        "analyse": "Zwei Schemata sind im Umlauf, eines aus der Ausbildung "
                   "und eines aus der Dienstanweisung von 2019.",
        "beschreibung": "Ein Schema festgelegt, im Skills-Training geübt, "
                        "Karte an jedem Funkgerät.",
        "verantwortlich": "B. Beispiel",
        "gemessen_am": tage(-90),
        "messwert": "In 9 von 20 beobachteten Übergaben vollständig",
        "frist": tage(150),
        "nachgemessen_am": None, "nachmessung_ergebnis": None,
    },
    {
        "kriterium": "8.1.2", "strang": "melderate",
        "ausloeser": "Auswertung der Ereignismeldungen",
        "definition": "Es werden wenige Ereignisse gemeldet, und die "
                      "Meldenden erfahren nichts über den Ausgang. Ziel: "
                      "mehr Meldungen und eine sichtbare Antwort darauf.",
        "analyse": "Das Meldeformular ist nur über zwei Klicks erreichbar, "
                   "und es gibt keine Rückmeldung an die meldende Person.",
        "beschreibung": "Meldeformular auf dem Startbildschirm der Tablets, "
                        "Ergebnisse jeden Monat im Newsletter.",
        "verantwortlich": "C. Beispiel",
        "gemessen_am": tage(-380), "messwert": "31 Meldungen im Vorjahr",
        "frist": tage(-60),
        "nachgemessen_am": tage(-40),
        "nachmessung_ergebnis": "74 Meldungen, davon 12 mit Massnahme",
    },
    {
        "kriterium": "8.1.4", "strang": "zufriedenheit",
        "ausloeser": "Mitarbeitendenbefragung",
        "definition": "Die Zufriedenheit mit der Einsatzplanung liegt unter "
                      "dem Durchschnitt der übrigen Fragen. Ziel: Anschluss "
                      "an den Durchschnitt.",
        "analyse": "Dienstpläne erscheinen kurzfristig, Tauschwünsche "
                   "brauchen mehrere Tage bis zur Antwort.",
        "beschreibung": "Dienstplan sechs Wochen im Voraus, Tauschbörse mit "
                        "Antwort innert 48 Stunden.",
        "verantwortlich": "A. Muster",
        "gemessen_am": tage(-330), "messwert": "3,1 von 5 Punkten",
        "frist": tage(90),
        "nachgemessen_am": None, "nachmessung_ergebnis": None,
    },
    {
        "kriterium": "8.1.5", "strang": "material",
        "ausloeser": "Selbst gewähltes Prozesskriterium",
        "definition": "Die Kontrolle der Notfallrucksäcke wird unterschiedlich "
                      "dokumentiert. Ziel: eine lückenlose Nachweiskette.",
        "analyse": "Die Checkliste liegt auf Papier im Fahrzeug und wird bei "
                   "Schichtwechsel oft vergessen.",
        "beschreibung": "Kontrolle als Aufgabe im Tablet, mit Erinnerung zum "
                        "Schichtbeginn.",
        "verantwortlich": "D. Beispiel",
        "gemessen_am": tage(-200),
        "messwert": "In 62 Prozent der Schichten dokumentiert",
        "frist": tage(60),
        "nachgemessen_am": None, "nachmessung_ergebnis": None,
    },
]

# --- Themen je Bereich ------------------------------------------------------
THEMEN = [
    ("8.1.1", "Notarzt nicht aufgeboten", 12),
    ("8.1.1", "Notarzt nicht nachgefordert", 7),
    ("8.1.1", "Alarmierungstext unklar", 4),
    ("8.1.1", "Medikation nicht dokumentiert", 10),
    ("8.1.1", "Lob für die Zusammenarbeit", 5),
    ("8.1.2", "Materialfehler", 9),
    ("8.1.2", "Kommunikation im Team", 14),
    ("8.1.2", "Medikamentenverwechslung beinahe", 3),
    ("8.1.2", "Fahrzeug und Technik", 11),
    ("8.1.2", "Übergabe an die Klinik", 8),
    ("8.1.4", "Einsatzplanung", 21),
    ("8.1.4", "Weiterbildung", 9),
    ("8.1.4", "Führung und Information", 12),
    ("8.1.4", "Material und Fahrzeuge", 6),
]

# --- Beschwerden ------------------------------------------------------------
# Erfundene Fälle ohne Namen und ohne Ort. Sie zeigen die Auswertung, nicht
# einen echten Vorgang.
BESCHWERDEN = [
    (-700, "direkt an den Rettungsdienst", "Wartezeit oder Eintreffzeit",
     "abgeschlossen", "nach Protokoll korrekt", "transportiert",
     "nicht berechtigt", 0,
     "Eintreffzeit als zu lang empfunden; Disposition war korrekt, das "
     "nächste Fahrzeug war gebunden."),
    (-640, "über die Stadtkanzlei", "Verhalten und Auftreten", "abgeschlossen",
     "nach Protokoll korrekt", "transportiert", "teilweise berechtigt", 1,
     "Ton gegenüber Angehörigen als knapp empfunden. Gespräch geführt."),
    (-580, "direkt an den Rettungsdienst", "Fachliche Versorgung",
     "abgeschlossen", "Abweichung vom Protokoll", "transportiert",
     "berechtigt", 1,
     "Schmerzmittel erst in der Klinik verabreicht, obwohl indiziert."),
    (-520, "Feedbackformular der Stadt", "Abrechnung und Verwaltung",
     "abgeschlossen", "nicht zutreffend", "nicht zutreffend",
     "nicht berechtigt", 0, "Rechnung als zu hoch empfunden, Tarif erklärt."),
    (-470, "Partnerorganisation", "Kommunikation mit Partnerorganisationen",
     "abgeschlossen", "nach Protokoll korrekt", "transportiert",
     "teilweise berechtigt", 1,
     "Übergabe im Schockraum unvollständig. Führte zum Kreislauf Übergabe."),
    (-410, "direkt an den Rettungsdienst",
     "Kommunikation mit Patient oder Angehörigen", "abgeschlossen",
     "nach Protokoll korrekt", "nicht transportiert", "teilweise berechtigt",
     1, "Entscheid gegen den Transport wurde nicht verständlich erklärt."),
    (-350, "vom eigenen Team gemeldet", "Material, Fahrzeug, Sachschaden",
     "abgeschlossen", "nicht zutreffend", "nicht zutreffend", "berechtigt", 1,
     "Trage beim Verladen beschädigt, Ersatzbeschaffung ausgelöst."),
    (-300, "direkt an den Rettungsdienst", "Wartezeit oder Eintreffzeit",
     "abgeschlossen", "nach Protokoll korrekt", "transportiert",
     "nicht berechtigt", 0, "Zweitfahrzeug aus der Nachbarregion, korrekt."),
    (-250, "über die Stadtkanzlei", "Fachliche Versorgung", "abgeschlossen",
     "nach Protokoll korrekt", "Transport verweigert", "nicht berechtigt", 0,
     "Transportverweigerung sauber dokumentiert und aufgeklärt."),
    (-190, "direkt an den Rettungsdienst", "Verhalten und Auftreten",
     "beantwortet", "nach Protokoll korrekt", "transportiert",
     "teilweise berechtigt", 1,
     "Gespräch im Treppenhaus als zu laut empfunden."),
    (-140, "Partnerorganisation", "Kommunikation mit Partnerorganisationen",
     "beantwortet", "nach Protokoll korrekt", "transportiert",
     "teilweise berechtigt", 0, "Voranmeldung zu spät erfolgt."),
    (-95, "Feedbackformular der Stadt",
     "Kommunikation mit Patient oder Angehörigen", "in Bearbeitung",
     "noch nicht geprüft", "transportiert", "noch offen", 0,
     "Angehörige durften nicht mitfahren; Begründung wird geprüft."),
    (-40, "direkt an den Rettungsdienst", "Fachliche Versorgung",
     "in Bearbeitung", "noch nicht geprüft", "transportiert", "noch offen", 0,
     "Zugang mehrfach punktiert; fachliche Prüfung läuft."),
    (-12, "vom eigenen Team gemeldet", "Material, Fahrzeug, Sachschaden",
     "eingegangen", "nicht zutreffend", "nicht zutreffend", "noch offen", 0,
     "Defekter Absaugbeutel im Rucksack gefunden."),
]

# --- Dossierdateien ---------------------------------------------------------
# Je Kriterium ein paar Dateien mit erfundenem Inhalt. Sie werden wirklich
# geschrieben, damit sich in der Demo jede Datei oeffnen laesst.
DATEIEN = {
    "5.2.1": [("Betriebsbewilligung Kanton", "Fertig"),
              ("Leistungsvereinbarung Stadt", "Fertig"),
              ("Bewilligung 2019", "Alt")],
    "5.2.2": [("Organigramm", "Fertig"), ("Organigramm 2023", "Alt")],
    "5.2.3": [("Vorstellung des Betriebs", "Fertig"),
              ("Informationsbroschüre", "In Bearbeitung")],
    "5.2.4": [("Jahresbericht Vorjahr", "Fertig"),
              ("Jahresbericht Vorvorjahr", "Fertig"),
              ("Einsatzstatistik", "Fertig")],
    "6.1": [("Qualitätskonzept", "Fertig"), ("Leitbild", "Fertig"),
            ("Organigramm Qualität", "In Bearbeitung")],
    "6.2": [("Vereinbarung mit der SNZ 144", "Fertig")],
    "6.3.1": [("Kommunikationsmittel Übersicht", "Fertig"),
              ("Funkkonzept", "In Bearbeitung")],
    "6.4": [("Dienstplanmodell", "Fertig"), ("Bereitschaftsregelung", "Fertig")],
    "6.5.1": [("Fahrzeugliste", "Fertig")],
    "6.5.2": [("Ausrüstungsliste RTW", "Fertig"),
              ("Prüfprotokoll Geräte", "Fertig")],
    "6.6": [("Bekleidungsreglement", "Fertig")],
    "6.7": [("Personalplanung", "Fertig"), ("Stellenplan", "In Bearbeitung")],
    "6.8": [("Fachliche Leitung Pflichtenheft", "Fertig")],
    "6.9": [("Kompetenzenregelung", "Fertig"),
            ("Kompetenzenregelung 2021", "Alt")],
    "6.10": [("Delegationsvereinbarung", "Fertig"),
             ("Rücksprachprotokoll Vorlage", "Fertig")],
    "7.1": [("Qualitätsbericht Vorjahr", "Fertig"),
            ("Qualitätsbericht Vorvorjahr", "Fertig")],
    "7.2": [("Einsatzstatistik nach Dringlichkeit", "Fertig")],
    "7.3.1": [("Dienstanweisung Dienstplanung", "Fertig")],
    "7.3.2": [("Stellenbeschreibungen", "Fertig"),
              ("Stellenbeschreibung Praktikum", "In Bearbeitung")],
    "7.3.3": [("Leitfaden Mitarbeitergespräch", "Fertig")],
    "7.3.4": [("Einführungskonzept", "Fertig"), ("Checkliste Einführung", "Fertig")],
    "7.3.7": [("Notarztindikationsliste", "Fertig"),
              ("Notarztindikationsliste 2019", "Alt")],
    "7.3.10": [("Hygienekonzept", "Fertig"),
               ("Reinigungsplan Fahrzeuge", "Fertig"),
               ("Hygienekonzept 2018", "Alt")],
    "7.3.14": [("Dienstanweisung Einsatzablauf", "Fertig")],
    "7.3.15": [("Vorgehen im Todesfall", "Fertig")],
    "7.3.16": [("Einsatzalgorithmen", "Fertig")],
    "7.3.17": [("Übergabeschema", "In Bearbeitung")],
    "7.3.19": [("Gefährdungsbeurteilung", "In Bearbeitung"),
               ("Sicherheitsunterweisung", "Fertig")],
    "7.4": [("Zeiterfassungskonzept", "Fertig")],
    "7.5": [("Basisdatensatz Beschreibung", "Fertig")],
    "7.6": [("Konzept Einsatznachbesprechung", "Fertig")],
    "7.7": [("Weiterbildungsplan", "Fertig"), ("Kursnachweise", "Fertig")],
    "8.1.1": [("Auswertung Einsatzrückmeldungen", "Fertig")],
    "8.1.2": [("Auswertung Ereignismeldungen", "Fertig")],
    "8.1.3": [("Beschwerdereglement", "Fertig")],
    "8.1.4": [("Bericht Mitarbeitendenbefragung", "Fertig")],
    "8.2": [("Indikatordiagnosen Konzept", "In Bearbeitung")],
}

INHALT = """{titel}
{strich}

Beispieldokument des {betrieb}.

Dieses Dokument gehört zur Demoversion des Werkzeugs für die
IVR-Anerkennung. Es ist erfunden und beschreibt keinen echten Betrieb.
An dieser Stelle stünde im Einsatz die Dienstanweisung, das Konzept oder
die Checkliste, die zum Kriterium {nummer} gilt.

Stand: {stand}
Kriterium: {nummer} {kriterium}
Ablage: {ordner}
"""


def dossier_schreiben(v):
    """Legt die erfundenen Dateien an und traegt sie ein."""
    wurzel = handbuch.DOSSIER
    if wurzel.exists():
        shutil.rmtree(wurzel)
    wurzel.mkdir(parents=True, exist_ok=True)

    titel = {r["nummer"]: r["titel"] for r in
             v.execute("SELECT nummer, titel FROM kriterium")}
    gesetzt = 0
    for nummer, liste in DATEIEN.items():
        if nummer not in titel:
            continue
        ordnername = handbuch._ordnername(nummer, titel[nummer])
        for name, stand in liste:
            ziel = wurzel / ordnername / stand
            ziel.mkdir(parents=True, exist_ok=True)
            datei = ziel / f"{name}.txt"
            datei.write_text(INHALT.format(
                titel=name, strich="=" * len(name), betrieb=BETRIEB,
                nummer=nummer, kriterium=titel[nummer], stand=stand,
                ordner=ordnername), encoding="utf-8")
            relativ = str(datei.relative_to(wurzel)).replace("\\", "/")
            status = {"Fertig": "fertig", "In Bearbeitung": "in Bearbeitung",
                      "Alt": "alt"}[stand]
            jahr = HEUTE.year - (2 if stand == "Alt" else 0)
            zeiger = v.execute(
                """INSERT INTO dokument (titel, pfad, status, endung, groesse,
                       ordner, datum, datum_herkunft, eigen)
                   VALUES (?,?,?,?,?,?,?,?,0)""",
                (name, relativ, status, "txt", datei.stat().st_size,
                 ordnername, f"{jahr}-{zufall.randint(1, 12):02d}-"
                             f"{zufall.randint(1, 28):02d}", "erstellt"))
            v.execute("INSERT OR IGNORE INTO beleg (kriterium, dokument) "
                      "VALUES (?,?)", (nummer, zeiger.lastrowid))
            gesetzt += 1
    v.commit()
    return gesetzt


def kriterien_setzen(v):
    liste = json.loads((HIER / "kriterien.json").read_text(encoding="utf-8"))
    for k in liste:
        v.execute(
            """INSERT INTO kriterium (nummer, titel, kapitel,
                   anerkennung_muss, anerkennung_soll, erneuerung_muss,
                   erneuerung_soll, min_anerkennung, min_erneuerung,
                   sortierung, status_2024, empfehlung_2024, nachweise)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT(nummer) DO UPDATE SET titel = excluded.titel""",
            (k["nummer"], k["titel"], k["kapitel"],
             int(k["anerkennung_muss"]), int(k["anerkennung_soll"]),
             int(k["erneuerung_muss"]), int(k["erneuerung_soll"]),
             k["min_anerkennung"], k["min_erneuerung"], k["sortierung"],
             STAND_2024.get(k["nummer"], "erfüllt"),
             EMPFEHLUNG_2024.get(k["nummer"]), "[]"))
    for nummer, (wer, wann) in BEHOBEN.items():
        v.execute("UPDATE kriterium SET behoben_am = ?, behoben_von = ? "
                  "WHERE nummer = ?", (wann, wer, nummer))
    v.commit()
    return len(liste)


def aufbauen():
    ordner = pfade.DATEN
    if ordner.exists():
        shutil.rmtree(ordner)
    ordner.mkdir(parents=True)

    v = datenbank.verbindung()
    v.executescript(datenbank.SCHEMA)
    datenbank.nachziehen(v)
    v.executescript(handbuch.SCHEMA + handbuch.PRUEFUNG_SCHEMA)
    for tabelle, spalte in handbuch.NACHTRAEGE + handbuch.PRUEFUNG_NACHTRAEGE:
        try:
            v.execute(f"ALTER TABLE {tabelle} ADD COLUMN {spalte}")
        except Exception:  # noqa: BLE001
            pass
    v.commit()

    anzahl = kriterien_setzen(v)
    datenbank.zusatzkriterien_setzen(v)

    for schluessel, wert in FRISTEN.items():
        datenbank.einstellung_setzen(v, schluessel, wert)

    dateien = dossier_schreiben(v)

    for nummer, text, verfahren, frist, erfuellt in AUFLAGEN:
        v.execute(
            """INSERT INTO auflage (kriterium, text, verfahren, frist,
                   erfuellt_am, erfuellt_von, erfasst_am, erfasst_von)
               VALUES (?,?,?,?,?,?,?,?)""",
            (nummer, text, verfahren, frist, erfuellt,
             "A. Muster" if erfuellt else None, tage(-320), "A. Muster"))

    for nummer, eintraege in KOMMENTARE.items():
        for text, wer in eintraege:
            v.execute(
                """INSERT INTO kommentar (kriterium, text, verfasser, erstellt)
                   VALUES (?,?,?,?)""", (nummer, text, wer, tage(-115)))

    for k in KREISLAEUFE:
        v.execute(
            """INSERT INTO massnahme (kriterium, ausloeser, beschreibung,
                   verantwortlich, frist, stand, gemessen_am, messwert,
                   nachgemessen_am, nachmessung_ergebnis, erstellt, strang,
                   definition, analyse)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (k["kriterium"], k["ausloeser"], k["beschreibung"],
             k["verantwortlich"], k["frist"],
             "abgeschlossen" if k["nachgemessen_am"] else "offen",
             k["gemessen_am"], k["messwert"], k["nachgemessen_am"],
             k["nachmessung_ergebnis"], k["gemessen_am"], k["strang"],
             k["definition"], k["analyse"]))

    jahr = HEUTE.year - 1
    for nummer, name, zahl in THEMEN:
        v.execute(
            """INSERT INTO thema (kriterium, name, anzahl, von, bis, erstellt)
               VALUES (?,?,?,?,?,?)""",
            (nummer, name, zahl, f"{jahr}-01-01", f"{jahr}-12-31", tage(-200)))

    for nr, (versatz, weg, kategorie, stand, medizinisch, transport,
             bewertung, massnahme, notiz) in enumerate(BESCHWERDEN, start=1):
        v.execute(
            """INSERT INTO beschwerde (nr, datum, eingang, weg, kategorie,
                   stand, medizinisch, transport, bewertung, massnahme_noetig,
                   notiz, protokoll, dateien, erstellt)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (nr, tage(versatz), tage(versatz + 1), weg, kategorie, stand,
             medizinisch, transport, bewertung, massnahme, notiz,
             1 if massnahme else 0, 0, tage(versatz + 1)))

    # Ein Teil des Dossiers ist schon durchgesehen, damit die Spalte
    # «Geprüft» nicht überall null zeigt.
    fertige = [r["pfad"] for r in v.execute(
        "SELECT pfad FROM dokument WHERE status = 'fertig' ORDER BY id")]
    handbuch.pruefen(v, fertige[:18], "A. Muster")

    # Zwei Dossierdateien gelten als Handbuchdokument.
    for nummer in ("7.3.10", "7.3.16"):
        z = v.execute(
            """SELECT d.id FROM dokument d JOIN beleg b ON b.dokument = d.id
               WHERE b.kriterium = ? AND d.status = 'fertig' LIMIT 1""",
            (nummer,)).fetchone()
        if z:
            handbuch.verknuepfen(v, nummer, z["id"],
                                 handbuch.VORGABE_INTERVALL, "A. Muster",
                                 FRISTEN["dossier"])
    v.commit()

    zahlen = {
        "Kriterien": anzahl,
        "Dossierdateien": dateien,
        "Kreisläufe": len(KREISLAEUFE),
        "Themen": len(THEMEN),
        "Beschwerden": len(BESCHWERDEN),
        "Auflagen": len(AUFLAGEN),
        "geprüft": v.execute(
            "SELECT COUNT(*) FROM pruefung WHERE geprueft_am IS NOT NULL"
        ).fetchone()[0],
    }
    v.close()
    return zahlen


def konten_anlegen():
    """Ein Konto für die Demo. Das Passwort steht in der Anmeldung."""
    datei = anmeldung.DATEI
    if datei.exists():
        datei.unlink()
    anmeldung.benutzer_anlegen("demo", "Demo Verwaltung", "verwalten")
    anmeldung.passwort_setzen("demo", "demo-ansehen")
    anmeldung.benutzer_anlegen("gast", "Demo Lesen", "lesen")
    anmeldung.passwort_setzen("gast", "demo-ansehen")


if __name__ == "__main__":
    zahlen = aufbauen()
    konten_anlegen()
    print(f"Demodaten für «{BETRIEB}» angelegt:")
    for name, zahl in zahlen.items():
        print(f"  {zahl:>4}  {name}")
    print(f"\nDossier: {handbuch.DOSSIER}")
    print("Konten: demo / demo-ansehen (Verwalten), "
          "gast / demo-ansehen (Lesen)")
