"""IVR-Anerkennung und Betriebshandbuch für einen Rettungsdienst.

Vier Ansichten auf einer Wirbelsäule, dem Kriterienregister:
Dossier, Handbuch, Analysen, Fälle. Der Fortschrittsbalken ist nicht die
Zahl der Dokumente, sondern die Zahl der geschlossenen Qualitätskreisläufe.
"""

import json
import os
import re
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

import anhaenge
import anmeldung
import datenbank
import diagramme
import dossier
import emris
import handbuch
import listen
import landkarte
import pfade
import praefix

app = FastAPI(title="IVR-Anerkennung und Betriebshandbuch")
vorlagen = Jinja2Templates(directory=str(pfade.VORLAGEN))

# Das Handbuch und die Fallanhaenge brauchen ihre Tabellen, auch in einer
# Datenbank, die vor ihnen angelegt wurde. Beim Start, nicht beim ersten
# Aufruf.
datenbank.einrichten()
handbuch.einrichten()
anhaenge.einrichten()
# Die Zahl neben «Handbuch» in der Seitenleiste: faellige Pruefungen.
vorlagen.env.globals["handbuch_faellig"] = handbuch.anzahl_faellig


def schweizer_datum(wert):
    """Ein Datum, ein Format. Die Datenbank haelt ISO, der Bildschirm zeigt
    25.12.2026. Vorher standen beide Formate auf benachbarten Seiten."""
    if not wert:
        return ""
    try:
        return datetime.strptime(str(wert)[:10], "%Y-%m-%d").strftime("%d.%m.%Y")
    except ValueError:
        return wert


vorlagen.env.filters["datum"] = schweizer_datum

# Die fünf Monitoringbereiche nach 8.1. Zur Erneuerung sind drei zu belegen.
MONITORING = {
    "8.1.1": "Angemessenheitsmonitoring",
    "8.1.2": "Fehler-, Ereignis- und Risikomonitoring",
    "8.1.3": "Beschwerdemanagement",
    "8.1.4": "Zufriedenheitsmonitoring",
    "8.1.5": "Selbstgewähltes Prozesskriterium",
}


# Wie aus einem Auslöser ein Kreislauf wird, je Bereich. Grundlage ist das
# IVR-Handbuch zu 8.1: «Eine genügend hohe Fallzahl muss vorhanden sein» und
# «Die Ergebnisse müssen mit der Zielvorgabe verglichen werden». Ein
# Einzelfall ist deshalb nie ein Kreislauf, sondern sein Anlass.
ANLEITUNG = {
    "8.1.1": {
        "auslöser": "Ein Einsatz über NACA 4, eine Abweichung von der "
                    "Notarztindikation oder eine unpassende Einsatzequipe.",
        "zahl": "Anteil der Einsätze über NACA 4, bei denen Equipe, Zielspital "
                "und Algorithmus der Lage entsprachen. Grundgesamtheit ist ein "
                "Jahr, nicht ein Fall.",
        "ziel": "Vorgabe vor der Messung festlegen, sonst gibt es nichts zu "
                "vergleichen.",
    },
    "8.1.2": {
        "auslöser": "Eine EMRIS-Meldung. Zum Beispiel: ein Fahrzeug war bei "
                    "Dienstübernahme nicht vollständig retabliert.",
        "zahl": "Nicht der Einzelfall, sondern seine Kategorie. Entweder "
                "rückwärts alle Meldungen dieser Kategorie im Jahr zählen, "
                "oder vorwärts vier Wochen lang bei jeder Dienstübernahme "
                "erfassen, ob etwas fehlte. Das ergibt rund 56 Beobachtungen "
                "und damit eine tragfähige Fallzahl.",
        "ziel": "Zum Beispiel: höchstens 5 Prozent der Dienstübernahmen mit "
                "Beanstandung.",
        "ursache": "Nicht fragen, wer vergessen hat, sondern an welcher Stelle "
                   "im Ablauf es durchfällt. Beim Retablieren sind die "
                   "üblichen Ursachen: Folgeeinsatz unmittelbar danach, "
                   "Schichtwechsel mitten im Ablauf, keine verbindliche Liste, "
                   "oder Material am Lager nicht vorhanden.",
        "rueckfluss": "Das Handbuch verlangt Informationswege in auf- und "
                      "absteigender Richtung. Wer meldet und nie erfährt, was "
                      "daraus wurde, meldet beim nächsten Mal nicht mehr.",
    },
    "8.1.3": {
        "auslöser": "Eine Rückmeldung von aussen. Auch Lob und Anregungen, "
                    "nicht nur Beschwerden.",
        "zahl": "Wer nur Beschwerden erfasst, hat bei zwei Fällen im Jahr "
                "nichts auszuwerten. Wer jede Rückmeldung von aussen erfasst, "
                "hat eine Grundgesamtheit.",
        "ziel": "Bearbeitungsdauer und Anteil der Fälle mit abgeleiteter "
                "Massnahme.",
    },
    "8.1.4": {
        "auslöser": "Eine Befragung von Partnerspitälern oder Mitarbeitenden.",
        "zahl": "Der Mittelwert je Frage, zusammen mit der Streuung. Ein "
                "Mittelwert von 3,2 kann zwei völlig verschiedene "
                "Wirklichkeiten bedeuten.",
        "ziel": "Die Verbesserung gegenüber der ersten Runde, gemessen mit "
                "derselben Frage.",
        "rueckfluss": "Vor der nächsten Runde prüfen, ob «Namen erfassen» in "
                      "Microsoft Forms ausgeschaltet ist. Bei sechzehn "
                      "Mitarbeitenden entscheidet das, ob die Antworten "
                      "brauchbar sind oder vorsichtig.",
    },
    "8.1.5": {
        "auslöser": "Frei gewählt. Ein Prozess, der im Betrieb ohnehin "
                    "Aufmerksamkeit braucht.",
        "zahl": "Frei, aber zählbar und über die Zeit wiederholbar.",
        "ziel": "Vor der ersten Messung festlegen.",
    },
}


# Das Handbuch verlangt eine Auswertung, «um Auffälligkeiten und Systemfehler
# zu erkennen». Das geht nur über Kategorien. Diese hier lehnen sich an die
# EMRIS-Systematik an, damit beide Bereiche vergleichbar bleiben.
BESCHWERDE_KATEGORIEN = [
    "Kommunikation mit Patient oder Angehörigen",
    "Kommunikation mit Partnerorganisationen",
    "Fachliche Versorgung",
    "Wartezeit oder Eintreffzeit",
    "Verhalten und Auftreten",
    "Material, Fahrzeug, Sachschaden",
    "Abrechnung und Verwaltung",
    "Sonstiges",
]

BESCHWERDE_STAENDE = ["eingegangen", "in Bearbeitung", "beantwortet", "abgeschlossen"]

BESCHWERDE_WEGE = ["direkt an den Rettungsdienst", "über die Stadtkanzlei",
                   "Feedbackformular der Stadt", "Partnerorganisation",
                   "vom eigenen Team gemeldet", "andere"]

# Die fachliche Prüfung: Wurde nach Protokoll gehandelt? Das ist die Frage,
# die über die Art der Massnahme entscheidet.
MEDIZINISCH = ["nach Protokoll korrekt", "Abweichung vom Protokoll",
               "noch nicht geprüft", "nicht beurteilbar"]

TRANSPORT = ["transportiert", "nicht transportiert", "Transport verweigert",
             "nicht zutreffend"]

# Berechtigt heisst: im Ablauf ist etwas schiefgegangen. Nicht berechtigt
# heisst nicht «unwichtig», sondern: fachlich war es richtig, die Erwartung
# wurde trotzdem enttäuscht. Beides braucht eine Massnahme, aber eine andere.
BEWERTUNG = ["berechtigt", "teilweise berechtigt", "nicht berechtigt",
             "noch offen"]


# Je Monitoringbereich: welche Daten dazugehören und was dort erfasst wird.
BEREICHE = {
    "8.1.1": {
        "themen": True,
        "kurz": "Angemessenheit",
        "quelle": "naca",
        "erfassung": "Rückmeldung der ärztlichen Leitung",
        "erklaerung":
            "Beurteilung der Einsatzprotokolle ab NACA 5 auf Algorithmen, "
            "Medikation, Guidelines, Bergung und Zeitmanagement. Das IVR nennt "
            "hier ausdrücklich die Einhaltung der Notarztindikation und die "
            "Zusammensetzung der Einsatzequipe nach 7.8.",
    },
    "8.1.2": {
        "themen": True,
        "kurz": "Ereignisse",
        "quelle": "emris",
        # Der Export wird auf der Bereichsseite hochgeladen und fuellt die
        # Themen je Jahr und die Monatsreihe.
        "upload": "emris",
        "upload_name": "EMRIS-Export",
        "upload_hinweis": "Excel oder CSV, das Blatt «Export_Feedback» mit "
                          "Datum und Fehlerkategorie je Meldung. Die "
                          "Kategorien sind in EMRIS vorgegeben und werden je "
                          "Jahr als Themen eingetragen; ein neuer Export "
                          "ersetzt die Themen seiner Jahre, von Hand ergänzte "
                          "bleiben. Die Datei liegt danach auch unter Listen.",
        "erfassung": "Auswertung der Meldungen",
        "erklaerung":
            "Meldungen aus dem CIRS, erfasst in EMRIS. Das Handbuch verlangt "
            "einen niederschwelligen Zugang, anonyme Meldung und geregelte "
            "Informationswege in auf- und absteigender Richtung.",
    },
    "8.1.3": {
        "themen": False,
        "kurz": "Beschwerden",
        "quelle": "beschwerden",
        "erfassung": "Fall",
        "erklaerung":
            "Rückmeldungen von aussen. Das Handbuch verlangt, dass der "
            "Bearbeitungsstand ersichtlich ist und dass ausgewertet wird, um "
            "Auffälligkeiten und Systemfehler zu erkennen.",
    },
    "8.1.4": {
        "themen": False,
        "kurz": "Zufriedenheit",
        "quelle": "umfragen",
        # Zwei Zielgruppen, zwei Auswertungen: auf einer Seite wird es lang.
        "reiter": [("notfall", "Notfallbefragung"),
                   ("mitarbeitende", "Mitarbeitendenbefragung")],
        # Die Ergebnisliste aus Microsoft Forms wird hier hochgeladen.
        "upload": "befragungen",
        "upload_name": "Befragung (Ergebnisliste aus Microsoft Forms)",
        "upload_hinweis": "Excel oder CSV, je Runde eine Datei; "
                          "Partnerorganisationen und Mitarbeitende getrennt. "
                          "Die Datei wird abgelegt und gelesen (Blatt, Zeilen, "
                          "Spalten, Prüfung auf Personendaten) und liegt "
                          "danach auch unter Listen. Die Auswertung der "
                          "Fragen rechnet das Werkzeug noch nicht selbst.",
        "erfassung": "Umfrage",
        "erklaerung":
            "Befragungen von Partnerspitälern und Mitarbeitenden. Durchgeführt "
            "wird mit Microsoft, die Anwendung nimmt nur das Ergebnis auf. "
            "Keine Patientenbefragungen.",
    },
    "8.1.5": {
        "themen": True,
        # Nur hier: der Betrieb waehlt das Kriterium selbst, also waehlt er
        # auch, wie es ausgewertet wird. Bei den uebrigen vier gibt die
        # Richtlinie die Form vor.
        "diagrammwahl": True,
        "kurz": "Selbstgewählt",
        "quelle": None,
        "erfassung": "Messung",
        "erklaerung":
            "Frei gewählt. Ein Prozess, der im Betrieb ohnehin Aufmerksamkeit "
            "braucht, zählbar und über die Zeit wiederholbar.",
    },
}

# Die Seitenleiste braucht die Bereiche auf jeder Seite, nicht nur auf
# der Bereichsseite.
vorlagen.env.globals["navbereiche"] = BEREICHE


def kommentare_laden(v, nummern=None):
    """Kommentare je Kriterium, die juengsten zuoberst."""
    if nummern is None:
        zeilen = v.execute(
            "SELECT * FROM kommentar ORDER BY erstellt DESC, id DESC")
    elif not nummern:
        return {}
    else:
        platz = ",".join("?" * len(nummern))
        zeilen = v.execute(
            f"SELECT * FROM kommentar WHERE kriterium IN ({platz}) "
            "ORDER BY erstellt DESC, id DESC", tuple(nummern))
    je_kriterium = {}
    for z in zeilen:
        je_kriterium.setdefault(z["kriterium"], []).append(z)
    return je_kriterium


def auflagen_laden(v, nummern=None):
    """Auflagen je Kriterium, offene zuerst, danach nach Frist."""
    if nummern is None:
        zeilen = v.execute("SELECT * FROM auflage")
    elif not nummern:
        return {}
    else:
        platz = ",".join("?" * len(nummern))
        zeilen = v.execute(
            f"SELECT * FROM auflage WHERE kriterium IN ({platz})", tuple(nummern))
    heute = date.today()
    je_kriterium = {}
    for z in zeilen:
        frist = _datum_oder_none(z["frist"])
        tage = (frist - heute).days if frist else None
        je_kriterium.setdefault(z["kriterium"], []).append({
            "id": z["id"], "kriterium": z["kriterium"], "text": z["text"],
            "verfahren": z["verfahren"], "frist": z["frist"],
            "erfuellt_am": z["erfuellt_am"], "erfuellt_von": z["erfuellt_von"],
            "erfasst_am": z["erfasst_am"], "erfasst_von": z["erfasst_von"],
            "tage": tage,
            "stufe": ("gruen" if z["erfuellt_am"] else
                      "rot" if tage is not None and tage < 30 else
                      "gelb" if tage is not None and tage < 120 else ""),
        })
    for liste in je_kriterium.values():
        liste.sort(key=lambda x: (bool(x["erfuellt_am"]), x["frist"] or "9999"))
    return je_kriterium


def _datum_oder_none(wert):
    try:
        return datetime.strptime(str(wert)[:10], "%Y-%m-%d").date() if wert else None
    except ValueError:
        return None


def offene_auflagen(v):
    """Alle Auflagen, die noch nicht erfüllt sind, die dringendste zuerst.
    Für die Übersicht und die Zahl in der Seitenleiste."""
    alle = auflagen_laden(v)
    titel = {k["nummer"]: k["titel"] for k in
             v.execute("SELECT nummer, titel FROM kriterium")}
    offen = [dict(x, titel=titel.get(nummer, ""))
             for nummer, liste in alle.items() for x in liste
             if not x["erfuellt_am"]]
    offen.sort(key=lambda x: (x["frist"] or "9999", x["kriterium"]))
    return offen


def maengel_laden(v, nummern=None):
    """Je Kriterium alles, was zu einem Mangel gehoert: die Anmerkung der
    Pruefer, der Stand aus dem Bericht, ob er behoben ist, und die eigenen
    Kommentare. Eine Stelle, die Landkarte, Dossier, Kriteriumsseite und
    Handbuch gleich bedienen."""
    if nummern is None:
        zeilen = v.execute(
            "SELECT nummer, titel, status_2024, empfehlung_2024, behoben_am, "
            "behoben_von FROM kriterium").fetchall()
    elif not nummern:
        return {}
    else:
        platz = ",".join("?" * len(nummern))
        zeilen = v.execute(
            "SELECT nummer, titel, status_2024, empfehlung_2024, behoben_am, "
            f"behoben_von FROM kriterium WHERE nummer IN ({platz})",
            tuple(nummern)).fetchall()
    nummern_liste = [z["nummer"] for z in zeilen]
    kommentare = kommentare_laden(v, nummern_liste)
    auflagen = auflagen_laden(v, nummern_liste)
    ergebnis = {}
    for z in zeilen:
        bemaengelt = z["status_2024"] in ("nicht erfüllt", "Auflage",
                                          "nicht beurteilbar")
        eigene_auflagen = auflagen.get(z["nummer"], [])
        ergebnis[z["nummer"]] = {
            "auflagen": eigene_auflagen,
            "auflagen_offen": [x for x in eigene_auflagen if not x["erfuellt_am"]],
            "nummer": z["nummer"],
            "titel": z["titel"],
            "status_2024": z["status_2024"],
            "empfehlung": z["empfehlung_2024"],
            "bemaengelt": bemaengelt,
            "behoben_am": z["behoben_am"],
            "behoben_von": z["behoben_von"],
            "kommentare": kommentare.get(z["nummer"], []),
        }
    return ergebnis


def bereich_stand():
    """Je Monitoringbereich: wie viele Kreisläufe geschlossen, wie viele
    offen. Für die Seitenleiste, deshalb mit eigener Verbindung und auf
    jeder Seite; eine Abfrage über fünf Bereiche.

    Grün steht für geschlossen, Blau für offen, das rote Ausrufezeichen
    für einen Bereich ohne einen einzigen begonnenen Kreislauf. Das ist
    die Frage, an der die Erneuerung hängt, und sie soll auf jeder Seite
    sichtbar sein, nicht nur auf der Übersicht.
    """
    v = datenbank.verbindung()
    stand = {n: {"zu": 0, "offen": 0, "gesamt": 0} for n in BEREICHE}
    for z in v.execute(
            """SELECT kriterium,
                      SUM(CASE WHEN nachgemessen_am IS NOT NULL
                               AND nachgemessen_am <> '' THEN 1 ELSE 0 END) AS zu,
                      COUNT(*) AS gesamt
               FROM massnahme GROUP BY kriterium"""):
        if z["kriterium"] in stand:
            stand[z["kriterium"]] = {"zu": z["zu"], "gesamt": z["gesamt"],
                                     "offen": z["gesamt"] - z["zu"]}
    v.close()
    return stand


vorlagen.env.globals["bereich_stand"] = bereich_stand


def auflagen_offen_zahl():
    """Für die Seitenleiste: wie viele Auflagen noch offen sind."""
    v = datenbank.verbindung()
    try:
        n = v.execute("SELECT COUNT(*) FROM auflage WHERE erfuellt_am IS NULL "
                      "OR erfuellt_am = ''").fetchone()[0]
    except Exception:  # noqa: BLE001 - Tabelle fehlt noch
        n = 0
    v.close()
    return n


vorlagen.env.globals["auflagen_offen"] = auflagen_offen_zahl


def ungeprueft_zahl():
    """Für die Seitenleiste: wie viele Dateien des Dossiers noch niemand
    geprüft hat. Eigene Verbindung, weil die Seitenleiste auf jeder Seite
    steht und keine hat."""
    v = datenbank.verbindung()
    try:
        n = v.execute(
            """SELECT COUNT(*) FROM dokument d
               LEFT JOIN pruefung p ON p.pfad = d.pfad
               WHERE p.geprueft_am IS NULL OR p.geprueft_am = ''"""
        ).fetchone()[0]
    except Exception:  # noqa: BLE001 - Tabelle fehlt noch
        n = 0
    v.close()
    return n


vorlagen.env.globals["dokumente_ungeprueft"] = ungeprueft_zahl


def betrieb_name():
    """Der Name des Betriebs, für die Seitenleiste. Eigene Verbindung, weil
    das Grundgerüst auf jeder Seite steht und keine hat."""
    v = datenbank.verbindung()
    try:
        z = v.execute("SELECT wert FROM einstellung WHERE schluessel = 'betrieb'"
                      ).fetchone()
        name = z["wert"] if z else ""
    except Exception:  # noqa: BLE001 - Tabelle fehlt noch
        name = ""
    v.close()
    return name


vorlagen.env.globals["betrieb_name"] = betrieb_name


def einstellungen(v):
    return {r["schluessel"]: r["wert"] for r in
            v.execute("SELECT schluessel, wert FROM einstellung")}


# Zwei Arten, denselben Kreislauf zu zeigen. Die Daten sind dieselben:
# Messung, Massnahme, Nachmessung. PDCA zeigt diese drei Schritte. DMAIC
# nach Six Sigma zeigt fünf und braucht dafür zwei Texte mehr: Define
# (Problem und Ziel) und Analyze (die Ursache). Michael am 15.09.2026: «ich
# finde den DMAIC-Vorgehenszyklus übersichtlicher und besser».
ZYKLEN = {
    "pdca": {
        "kurz": "PDCA",
        "name": "Plan, Do, Check, Act",
        "erklaerung": "Drei Schritte je Kreislauf: Messung, Massnahme, "
                      "Nachmessung.",
        "legende": "Plan, Do, Check, Act",
        "fortfuehren": "Act: neue Runde mit demselben Messwert",
        "dt_zahl": "Plan, die Zahl",
        "dt_check": "Check und Act",
        "beginn": "Beginnt mit einer Messung als Ausgangswert.",
    },
    "dmaic": {
        "kurz": "DMAIC",
        "name": "Six Sigma: Define, Measure, Analyze, Improve, Control",
        "erklaerung": "Fünf Phasen je Kreislauf. Define benennt Problem und "
                      "Ziel, Measure ist der Ausgangswert, Analyze die "
                      "Ursache, Improve die Massnahme, Control die "
                      "Nachmessung.",
        "legende": "Define, Measure, Analyze, Improve, Control",
        "fortfuehren": "Control: neue Runde mit demselben Messwert",
        "dt_zahl": "Measure, die Zahl",
        "dt_check": "Control",
        "beginn": "Beginnt mit Define, Problem und Ziel, dann der Messung "
                  "als Ausgangswert.",
    },
}


def zyklus_von(v):
    wahl = einstellungen(v).get("zyklus") or "pdca"
    return wahl if wahl in ZYKLEN else "pdca"


def schritte_von(m, zyklus):
    """Die Schritte eines Kreislaufs mit ihrem Inhalt, im gewählten Zyklus.

    m ist eine Massnahme oder None (noch kein Kreislauf). Jeder Schritt
    trägt typ (für Farbe und Ring), symbol, name, erledigt, inhalt, datum.
    Bei DMAIC gilt Define als erledigt, sobald ein Text oder wenigstens der
    Auslöser da ist; Analyze erst mit einer eingetragenen Ursache. Alte
    Kreisläufe zeigen dort deshalb eine Lücke, und das ist richtig so.
    """
    def wert(feld):
        return m[feld] if m else None

    messung = {"typ": "messung", "symbol": "messung", "name": "Messung",
               "erledigt": bool(m and m["gemessen_am"]),
               "inhalt": wert("messwert"), "datum": wert("gemessen_am")}
    massnahme = {"typ": "massnahme", "symbol": "massnahme", "name": "Massnahme",
                 "erledigt": bool(m), "inhalt": wert("beschreibung"),
                 "datum": wert("frist")}
    nachmessung = {"typ": "nachmessung", "symbol": "nachmessung",
                   "name": "Nachmessung",
                   "erledigt": bool(m and m["nachgemessen_am"]),
                   "inhalt": (wert("nachmessung_ergebnis")
                              if m and m["nachgemessen_am"] else None),
                   "datum": wert("nachgemessen_am")}
    if zyklus != "dmaic":
        return [messung, massnahme, nachmessung]

    definition = wert("definition") or (
        f"Auslöser: {m['ausloeser']}" if m and m["ausloeser"] else None)
    return [
        {"typ": "define", "symbol": "define", "name": "Define",
         "erledigt": bool(definition), "inhalt": definition, "datum": None},
        dict(messung, typ="measure", name="Measure"),
        {"typ": "analyze", "symbol": "analyze", "name": "Analyze",
         "erledigt": bool(m and m["analyse"]), "inhalt": wert("analyse"),
         "datum": None},
        dict(massnahme, typ="improve", name="Improve"),
        dict(nachmessung, typ="control", name="Control"),
    ]


def ring_von(m, zyklus, groesse=44):
    return diagramme.fortschrittskreis(
        [(s["typ"], s["erledigt"]) for s in schritte_von(m, zyklus)], groesse)


# Ein Kreislauf braucht Messung, Massnahme, Wirkungszeit und Nachmessung.
# Realistisch zwölf Monate. Die Uhr muss deshalb auf den letzten sinnvollen
# Starttag zeigen, nicht nur auf die Einreichefrist: eine Ampel, die erst
# vier Monate vor dem Dossier auf Rot springt, warnt, nachdem der letzte
# Handlungszeitpunkt verstrichen ist.
VORLAUF_KREISLAUF_TAGE = 365


# Die drei festen Fristen. Sie stehen in der Tabelle einstellung und lassen
# sich auf der Uebersicht aendern; an «dossier» haengt ausserdem der
# berechnete letzte Starttag.
FRISTEN = (
    ("antrag", "Antrag auf Erneuerung beim IVR"),
    ("dossier", "vollständiges Dossier, Besuchstermin vereinbart"),
    ("ablauf", "Ablauf der Anerkennung"),
)
FRIST_NAME = dict(FRISTEN)


def _iso_datum(wert):
    """Ein Datum aus einem Formular, oder ein ValueError mit Klartext."""
    try:
        return datetime.strptime((wert or "").strip(), "%Y-%m-%d").date()
    except ValueError:
        raise ValueError("Das Datum fehlt oder ist nicht lesbar.") from None


def uhr(v):
    """Alle Termine mit Restzeit, nach Datum sortiert: der berechnete letzte
    Starttag, die drei festen Fristen und die eigenen Termine. Was vorbei
    ist, bleibt in der Liste mit negativen Tagen; der Zeitstrahl laesst es
    weg."""
    e = einstellungen(v)
    heute = date.today()
    posten = []

    dossier = e.get("dossier")
    if dossier:
        d = datetime.strptime(dossier, "%Y-%m-%d").date()
        start = d - timedelta(days=VORLAUF_KREISLAUF_TAGE)
        tage = (start - heute).days
        posten.append({
            "beschriftung": "letzter sinnvoller Start für einen Kreislauf",
            "datum": start.strftime("%d.%m.%Y"),
            "iso": start.isoformat(),
            "tage": tage,
            "monate": round(tage / 30.4),
            "stufe": "rot" if tage < 90 else "gelb" if tage < 240 else "gruen",
            "fuehrend": True,
            "schluessel": None, "id": None,
        })

    for schluessel, beschriftung in FRISTEN:
        wert = e.get(schluessel)
        if not wert:
            continue
        d = datetime.strptime(wert, "%Y-%m-%d").date()
        tage = (d - heute).days
        posten.append({
            "beschriftung": beschriftung,
            "datum": d.strftime("%d.%m.%Y"),
            "iso": d.isoformat(),
            "tage": tage,
            "monate": round(tage / 30.4),
            "stufe": "rot" if tage < 120 else "gelb" if tage < 365 else "gruen",
            "fuehrend": False,
            "schluessel": schluessel, "id": None,
        })

    # Eigene Termine: kuerzere Vorwarnung als bei den Fristen, weil sie
    # keine Vorbereitungszeit von Monaten brauchen.
    for t in v.execute("SELECT * FROM termin ORDER BY datum, id"):
        d = datetime.strptime(t["datum"], "%Y-%m-%d").date()
        tage = (d - heute).days
        posten.append({
            "beschriftung": t["beschriftung"],
            "datum": d.strftime("%d.%m.%Y"),
            "iso": t["datum"],
            "tage": tage,
            "monate": round(tage / 30.4),
            "stufe": "rot" if tage < 30 else "gelb" if tage < 120 else "gruen",
            "fuehrend": False,
            "schluessel": None, "id": t["id"],
        })

    posten.sort(key=lambda p: p["tage"])
    return posten


def kreislaeufe(v):
    """Offen heisst: Massnahme da, Nachmessung fehlt. Das ist der Kern."""
    offen = v.execute(
        "SELECT COUNT(*) FROM massnahme WHERE nachgemessen_am IS NULL "
        "OR nachgemessen_am = ''").fetchone()[0]
    zu = v.execute(
        "SELECT COUNT(*) FROM massnahme WHERE nachgemessen_am IS NOT NULL "
        "AND nachgemessen_am <> ''").fetchone()[0]
    # Zur Erneuerung zaehlen nur die drei tragenden Bereiche. Ein
    # geschlossener Kreislauf anderswo ist gute Arbeit, aber kein Beleg.
    tragend = [x for x in (einstellungen(v).get("tragende") or "").split(",") if x]
    belegt = v.execute(
        f"""SELECT COUNT(DISTINCT kriterium) FROM massnahme
            WHERE kriterium IN ({','.join('?' * len(tragend))})
            AND nachgemessen_am IS NOT NULL AND nachgemessen_am <> ''""",
        tuple(tragend)).fetchone()[0] if tragend else 0
    # Welche tragenden noch offen sind, gehoert auf die Startseite: das ist
    # die Arbeit, die bis zum Dossier noch ansteht.
    fehlend = [n for n in tragend if not v.execute(
        """SELECT 1 FROM massnahme WHERE kriterium = ?
           AND nachgemessen_am IS NOT NULL AND nachgemessen_am <> '' LIMIT 1""",
        (n,)).fetchone()]
    return {"offen": offen, "geschlossen": zu, "monitoring_belegt": belegt,
            "tragend_gesamt": len(tragend), "fehlend": fehlend}


def _gekuerzt(text, zeichen):
    """Kuerzt an der Wortgrenze und setzt drei Punkte.

    Hart nach n Zeichen abzuschneiden hinterlaesst Wortreste wie «die daraus
    abgeleiteten Ma», und das liest sich wie ein Fehler und nicht wie eine
    Kuerzung.
    """
    text = (text or "").strip()
    if len(text) <= zeichen:
        return text
    schnitt = text[:zeichen].rsplit(" ", 1)[0].rstrip(" ,;:.")
    return (schnitt or text[:zeichen]) + "…"


def monitoring_stand(v):
    """Die fünf Bereiche nach 8.1 mit ihrem Stand im Qualitätskreislauf.

    Das ist die Frage, an der die Erneuerung hängt, und sie stand bisher
    nirgends auf dem Bildschirm. Drei Schritte, aus den Massnahmen abgeleitet:
    gemessen, Massnahme beschlossen, nachgemessen. Erst der dritte schliesst
    den Kreislauf.
    """
    tragend = set(filter(None, (einstellungen(v).get("tragende") or "").split(",")))
    zyklus = zyklus_von(v)
    stand = []
    for nummer, name in MONITORING.items():
        # Angezeigt wird der laufende Kreislauf; ein geschlossener ist
        # erledigte Arbeit und steht eingeklappt in der Liste.
        m = v.execute(
            """SELECT * FROM massnahme WHERE kriterium = ?
               ORDER BY (nachgemessen_am IS NOT NULL AND nachgemessen_am <> '')
                        ASC, id DESC LIMIT 1""", (nummer,)).fetchone()
        # Für den Bereichsstatus zählt, ob überhaupt einer geschlossen ist.
        hat_geschlossenen = v.execute(
            """SELECT 1 FROM massnahme WHERE kriterium = ?
               AND nachgemessen_am IS NOT NULL AND nachgemessen_am <> ''
               LIMIT 1""", (nummer,)).fetchone() is not None
        k = v.execute("SELECT status_2024 FROM kriterium WHERE nummer = ?",
                      (nummer,)).fetchone()
        anzahl = v.execute(
            "SELECT COUNT(*) FROM massnahme WHERE kriterium = ?",
            (nummer,)).fetchone()[0]

        # Die Knoten je Bereich, drei oder fünf je nach Zyklus. Jeder traegt
        # seinen echten Inhalt, sonst ist das Ablaufbild nur Dekoration.
        schritte = schritte_von(m, zyklus)
        # Alle Kreisläufe des Bereichs, für die Ringe in der Übersicht.
        alle = v.execute(
            """SELECT * FROM massnahme WHERE kriterium = ?
               ORDER BY gemessen_am DESC, id DESC""", (nummer,)).fetchall()
        kreise = [{
            "strang": x["strang"],
            "titel": _gekuerzt(x["beschreibung"], 70),
            "schritte": [(s["typ"], s["erledigt"])
                         for s in schritte_von(x, zyklus)],
            "geschlossen": bool(x["nachgemessen_am"]),
            "frist": x["frist"],
        } for x in alle]

        stand.append({
            "nummer": nummer,
            "name": name,
            "tragend": nummer in tragend,
            "status_2024": k["status_2024"] if k else None,
            "schritte": schritte,
            "anzahl": anzahl,
            "kreise": kreise,
            "geschlossen": hat_geschlossenen,
        })
    return stand


ABFRAGE_KRITERIEN = """
    SELECT k.*,
           COUNT(b.dokument) AS belege,
           SUM(CASE WHEN d.status = 'fertig' THEN 1 ELSE 0 END) AS fertig,
           SUM(CASE WHEN d.status = 'in Bearbeitung' THEN 1 ELSE 0 END) AS in_arbeit,
           SUM(CASE WHEN d.status = 'alt' THEN 1 ELSE 0 END) AS alt,
           SUM(CASE WHEN d.status = 'ohne Zuordnung' THEN 1 ELSE 0 END) AS offen_abgelegt,
           MAX(CASE WHEN d.status = 'fertig' THEN d.datum END) AS juengster_freigegeben,
           MAX(d.datum) AS juengster,
           MIN(d.datum) AS aeltester,
           (SELECT COUNT(*) FROM massnahme m WHERE m.kriterium = k.nummer)
               AS massnahmen,
           (SELECT COUNT(*) FROM massnahme m WHERE m.kriterium = k.nummer
                AND m.nachgemessen_am IS NOT NULL AND m.nachgemessen_am <> '')
               AS geschlossen
    FROM kriterium k
    LEFT JOIN beleg b ON b.kriterium = k.nummer
    LEFT JOIN dokument d ON d.id = b.dokument
    GROUP BY k.nummer ORDER BY k.sortierung
"""


def gliederungszeilen(kriterien):
    """Ein Kriterium mit Unterkriterien ist eine Gliederungszeile, kein
    eigener Nachweis. Betrifft 6.11 und 7.3. Ohne diese Regel meldet die
    Anwendung dort dauerhaft eine Lücke, die keine ist."""
    nummern = {k["nummer"] for k in kriterien}
    return {n for n in nummern
            if any(a != n and a.startswith(n + ".") for a in nummern)}


def einordnen(k, gliederung=frozenset()):
    """Gruppen nach Dringlichkeit. Die Reihenfolge ist die Arbeitsliste.

    Wichtig ist die Gruppe «unklar»: Wo alle Dateien direkt im Ordner liegen,
    ohne Fertig, In Bearbeitung oder Alt, sagt die Ablage nichts über den
    Stand. Das als «nicht freigegeben» zu melden wäre ein falscher Alarm.
    """
    if k["status_2024"] in ("nicht erfüllt", "Auflage", "nicht beurteilbar"):
        # Ein behobener Mangel ist keine offene Arbeit mehr. Er bleibt
        # sichtbar, aber er ruft nicht mehr.
        return "behoben" if k["behoben_am"] else "bemaengelt"
    if k["status_2024"] == "nicht anwendbar":
        return "entfaellt"
    # Erst hier, damit 8.1 nicht verschwindet: es hat Unterpunkte, wurde aber
    # vom Experten eigenstaendig bewertet und oben schon einsortiert.
    if k["nummer"] in gliederung:
        return "entfaellt"
    if k["belege"] == 0:
        return "ohne_nachweis" if k["erneuerung_muss"] else "entfaellt"
    if k["fertig"]:
        return "belegt"
    if k["in_arbeit"] or k["alt"]:
        return "nichts_fertig"
    return "unklar"


# Dieselben Gruppen wie im Dossier, hier zusätzlich in eine Rangfolge
# gebracht. Ein Teilprozess erbt den schlechtesten Stand seiner Kriterien:
# Wer fünf belegte trägt und ein bemängeltes, hat ein bemängeltes.
STAND_RANG = ("bemaengelt", "ohne_nachweis", "nichts_fertig", "soll_offen",
              "unklar", "behoben", "belegt", "gliederung", "nicht_anwendbar",
              "ohne_kriterium")

STAND_TEXT = {
    "bemaengelt": "2024 bemängelt",
    "behoben": "bemängelt, behoben",
    "ohne_nachweis": "ohne Nachweis",
    "nichts_fertig": "nichts freigegeben",
    "soll_offen": "Soll ohne Nachweis",
    "unklar": "Ablage unklar",
    "belegt": "belegt",
    "gliederung": "über Unterpunkte",
    "nicht_anwendbar": "nicht anwendbar",
    "ohne_kriterium": "ohne Kriterium",
}

# Farbe trägt hier nur, was Arbeit auslöst. «Belegt» bleibt leise: der
# Zustand, der nichts verlangt, belegt die grösste Fläche und darf deshalb
# nicht der lauteste Teil der Seite sein.
STAND_FARBE = {"bemaengelt": "rot", "ohne_nachweis": "rot",
               "nichts_fertig": "gelb", "soll_offen": "gelb",
               "behoben": "gruen"}

# Die Segmente des Lagebalkens, in der Reihenfolge der Dringlichkeit.
STAND_LAGE = {"bemaengelt": "l-rot", "ohne_nachweis": "l-rot",
              "nichts_fertig": "l-gelb", "soll_offen": "l-gelb",
              "unklar": "l-grau", "behoben": "l-gruen", "belegt": "l-gruen",
              "gliederung": "l-grau", "nicht_anwendbar": "l-grau",
              "ohne_kriterium": "l-grau"}


def landkarte_stand(k, gliederung):
    """Wie einordnen, nur mit drei getrennten Gruppen dort, wo das Dossier
    alles unter «entfällt» führt.

    Auf einer Prozesslandkarte ist der Unterschied wesentlich: Eine
    Gliederungszeile wie 7.3 entfällt nicht, sie wird von ihren zwanzig
    Unterpunkten belegt. Ein Soll ohne Nachweis ist eine echte, wenn auch
    kleine Lücke. Und nicht anwendbar heisst wirklich nicht anwendbar.
    """
    stand = einordnen(k, gliederung)
    if stand != "entfaellt":
        return stand
    if k["status_2024"] == "nicht anwendbar":
        return "nicht_anwendbar"
    if k["nummer"] in gliederung:
        return "gliederung"
    return "soll_offen"

# Teilprozesse, die eine eigene Seite haben, führen dorthin weiter.
ZIEL_NAMEN = {
    "/": "Dossier",
    "/handbuch": "Handbuch",
    "/massnahmen": "Massnahmen",
    "/analysen": "Analysen",
    "/faelle": "Beschwerden",
}


def schritt_stand(schritt, stand_je_kriterium):
    staende = [stand_je_kriterium[n] for n in schritt["kriterien"]
               if n in stand_je_kriterium]
    if not staende:
        return "ohne_kriterium"
    return min(staende, key=STAND_RANG.index)


# Hinter einer Zahl gelesen braucht «2024 bemängelt» eine andere Wortstellung:
# «2 2024 bemängelt» stellt zwei Zahlen nebeneinander und ist unlesbar.
HINWEIS_TEXT = dict(STAND_TEXT, bemaengelt="bemängelt 2024")

# Die Legende des Lagebalkens. Sie nennt dieselben Wörter wie die Zeilen der
# Landkarte, nicht eigene Oberbegriffe: ein Zustand, ein Name, überall.
# Die Zahl steht hier und nicht nur im Balken, weil der Balken am Telefon in
# voller Breite so flach wird, dass seine Beschriftung nicht mehr lesbar ist.
LEGENDE_GRUPPEN = [
    ("l-rot", ("bemaengelt", "ohne_nachweis")),
    ("l-gelb", ("nichts_fertig", "soll_offen")),
    ("l-grau", ("unklar", "gliederung", "nicht_anwendbar", "ohne_kriterium")),
    ("l-gruen", ("belegt",)),
]


def dringlichster(zaehler):
    """Die dringlichste Gruppe mit ihrer Zahl, oder nichts.

    Eine zugeklappte Zeile trägt einen Hinweis und nicht sieben. Was sonst
    noch drinsteckt, steht aufgeklappt Zeile für Zeile.
    """
    for stand in ("bemaengelt", "ohne_nachweis", "nichts_fertig",
                  "soll_offen"):
        if zaehler.get(stand):
            return {"zahl": zaehler[stand], "text": HINWEIS_TEXT[stand],
                    "farbe": STAND_FARBE[stand]}
    return None


@app.get("/")
def uebersicht(request: Request, meldung: str = "", art: str = ""):
    """Die Übersicht über das Dossier. Sie heisst nicht «dossier», weil so
    das Modul heisst, das den Dossierordner liest; ein def überschriebe den
    Namen für die ganze Datei."""
    v = datenbank.verbindung()
    kriterien = v.execute(ABFRAGE_KRITERIEN).fetchall()

    gruppen = {g: [] for g in ("bemaengelt", "ohne_nachweis", "nichts_fertig",
                               "unklar", "behoben", "belegt", "entfaellt")}
    gliederung = gliederungszeilen(kriterien)
    for k in kriterien:
        gruppen[einordnen(k, gliederung)].append(k)

    bereiche_stand = monitoring_stand(v)
    # Das Brett der Uebersicht zeigt Kreislaeufe, nicht Bereiche: so viele
    # Felder, wie gerade laufen. Jedes traegt mit, zu welchem Bereich es
    # gehoert, damit ein Ring nie ohne sein Feld dasteht.
    laufende = []
    geschlossene = 0
    for b in bereiche_stand:
        for kreis in b["kreise"]:
            # Auf dem Brett ist der Ring das Bild und nicht ein Sinnbild
            # neben Text. Die Strichdicke bleibt 5 Einheiten und wird auf 120
            # Einheiten Zeichenflaeche schlank: gross gezeigt, nicht fett.
            kreis["ring"] = diagramme.fortschrittskreis(kreis["schritte"], 120)
            if kreis["geschlossen"]:
                # Geschlossene verschwinden vom Brett: dort steht, was noch
                # Arbeit auslöst. Gezählt werden sie weiter, damit ein leeres
                # Brett nicht mit einem unbegonnenen verwechselt wird.
                geschlossene += 1
                continue
            laufende.append(dict(
                kreis,
                bereich=b["nummer"],
                bereich_name=b["name"],
                tragend=b["tragend"],
                # Der Stand als Zahlen: im Ring steht er als Text, nicht mehr
                # als blosse Ziffer in der Mitte.
                fertig=sum(1 for _, e in kreis["schritte"] if e),
                gesamt=len(kreis["schritte"]),
            ))
        if not b["kreise"]:
            b["leerring"] = ring_von(None, zyklus_von(v), 72)
    # Die nächste Nachmessung zuerst; wo keine Frist steht, ans Ende.
    laufende.sort(key=lambda k: (k["frist"] or "9999", k["bereich"]))

    fristen = uhr(v)
    lage = diagramme.lage_balken([
        ("bemängelt 2024", len(gruppen["bemaengelt"]), "l-rot"),
        ("bemängelt, behoben", len(gruppen["behoben"]), "l-gruen"),
        ("ohne Nachweis", len(gruppen["ohne_nachweis"]), "l-rot"),
        ("nichts freigegeben", len(gruppen["nichts_fertig"]), "l-gelb"),
        ("Ablage unklar", len(gruppen["unklar"]), "l-grau"),
        ("belegt", len(gruppen["belegt"]), "l-gruen"),
        ("entfällt", len(gruppen["entfaellt"]), "l-grau"),
    ])

    antwort = vorlagen.TemplateResponse(request, "dossier.html", {
        "gruppen": gruppen,
        "uhr": fristen,
        # Vergangenes steht in der Tabelle, nicht auf dem Strahl: dort
        # wuerde es auf dem Punkt «heute» liegen und nichts sagen.
        "zeitstrahl": diagramme.zeitstrahl([p for p in fristen if p["tage"] >= 0]),
        "meldung": meldung, "art": art,
        "lagebalken": lage,
        "stand": kreislaeufe(v),
        "monitoring": MONITORING,
        "bereiche": bereiche_stand,
        "laufende": laufende,
        "geschlossene": geschlossene,
        "betrieb": einstellungen(v).get("betrieb", ""),
        "dateien": v.execute("SELECT COUNT(*) FROM dokument").fetchone()[0],
        # Nicht 56: die Antragsunterlagen 5.x und 7.4.1 sind dazugekommen.
        "kriterienzahl": len(kriterien),
        "plan": handbuch.pruefplan(v, einstellungen(v).get("dossier")),
        # Die Erinnerung aus dem Handbuch gehoert auch hierher: die
        # Uebersicht ist die Seite, auf der man landet.
        "handbuch_faellige": handbuch.faellige(v),
        "auflagen": offene_auflagen(v),
        "titel": "Dossier",
        "seite": "dossier",
    })
    v.close()
    return antwort


# --- Termine: die festen Fristen aendern, eigene eintragen ----------------

def _zu_fristen(art, meldung):
    return RedirectResponse(f"/?art={art}&meldung={quote(meldung)}#fristen",
                            status_code=303)


@app.post("/termine/einstellung/{schluessel}")
def frist_setzen(schluessel: str, datum: str = Form("")):
    if schluessel not in FRIST_NAME:
        return _zu_fristen("fehler", "Diese Frist gibt es nicht.")
    try:
        tag = _iso_datum(datum)
    except ValueError as e:
        return _zu_fristen("fehler", str(e))
    v = datenbank.verbindung()
    datenbank.einstellung_setzen(v, schluessel, tag.isoformat())
    v.close()
    return _zu_fristen(
        "gut", f"«{FRIST_NAME[schluessel]}» steht jetzt auf "
               f"{schweizer_datum(tag.isoformat())}.")


@app.post("/termine/neu")
def termin_neu(beschriftung: str = Form(""), datum: str = Form("")):
    beschriftung = " ".join(beschriftung.split())
    if not beschriftung:
        return _zu_fristen("fehler", "Der Termin braucht eine Bezeichnung.")
    try:
        tag = _iso_datum(datum)
    except ValueError as e:
        return _zu_fristen("fehler", str(e))
    v = datenbank.verbindung()
    v.execute("INSERT INTO termin (beschriftung, datum) VALUES (?,?)",
              (beschriftung, tag.isoformat()))
    v.commit()
    v.close()
    return _zu_fristen(
        "gut", f"«{beschriftung}» eingetragen, {schweizer_datum(tag.isoformat())}.")


@app.post("/termine/{tid}")
def termin_aendern(tid: int, beschriftung: str = Form(""), datum: str = Form("")):
    beschriftung = " ".join(beschriftung.split())
    if not beschriftung:
        return _zu_fristen("fehler", "Der Termin braucht eine Bezeichnung.")
    try:
        tag = _iso_datum(datum)
    except ValueError as e:
        return _zu_fristen("fehler", str(e))
    v = datenbank.verbindung()
    v.execute("UPDATE termin SET beschriftung = ?, datum = ? WHERE id = ?",
              (beschriftung, tag.isoformat(), tid))
    v.commit()
    v.close()
    return _zu_fristen(
        "gut", f"«{beschriftung}» steht jetzt auf {schweizer_datum(tag.isoformat())}.")


@app.post("/termine/{tid}/loeschen")
def termin_loeschen(tid: int):
    v = datenbank.verbindung()
    t = v.execute("SELECT beschriftung FROM termin WHERE id = ?", (tid,)).fetchone()
    if not t:
        v.close()
        return _zu_fristen("fehler", "Diesen Termin gibt es nicht.")
    v.execute("DELETE FROM termin WHERE id = ?", (tid,))
    v.commit()
    v.close()
    return _zu_fristen("gut", f"«{t['beschriftung']}» ist gelöscht.")


# --- Mängel: Kommentare und Behebung ---------------------------------------

def _zurueck_zu(zurueck, standard):
    ziel = zurueck if zurueck.startswith("/") else standard
    return RedirectResponse(ziel, status_code=303)


@app.post("/kriterium/{nummer}/kommentar")
def kommentar_anlegen(request: Request, nummer: str, text: str = Form(""),
                      zurueck: str = Form("")):
    text = text.strip()
    if not text:
        return _zurueck_zu(zurueck, f"/kriterium/{nummer}")
    v = datenbank.verbindung()
    if v.execute("SELECT 1 FROM kriterium WHERE nummer = ?", (nummer,)).fetchone():
        v.execute(
            "INSERT INTO kommentar (kriterium, text, verfasser, erstellt) "
            "VALUES (?,?,?,?)",
            (nummer, text, _wer(request), date.today().isoformat()))
        v.commit()
    v.close()
    return _zurueck_zu(zurueck, f"/kriterium/{nummer}")


@app.post("/kommentar/{kid}/loeschen")
def kommentar_loeschen(kid: int, zurueck: str = Form("")):
    v = datenbank.verbindung()
    k = v.execute("SELECT kriterium FROM kommentar WHERE id = ?", (kid,)).fetchone()
    if k:
        v.execute("DELETE FROM kommentar WHERE id = ?", (kid,))
        v.commit()
    ziel = f"/kriterium/{k['kriterium']}" if k else "/"
    v.close()
    return _zurueck_zu(zurueck, ziel)


@app.post("/kriterium/{nummer}/auflage")
def auflage_anlegen(request: Request, nummer: str, text: str = Form(""),
                    verfahren: str = Form(""), frist: str = Form(""),
                    zurueck: str = Form("")):
    text = text.strip()
    if not text:
        return _zurueck_zu(zurueck, f"/kriterium/{nummer}")
    v = datenbank.verbindung()
    if v.execute("SELECT 1 FROM kriterium WHERE nummer = ?", (nummer,)).fetchone():
        v.execute(
            """INSERT INTO auflage (kriterium, text, verfahren, frist,
                   erfasst_am, erfasst_von)
               VALUES (?,?,?,?,?,?)""",
            (nummer, text, " ".join(verfahren.split()) or None,
             frist.strip() or None, date.today().isoformat(), _wer(request)))
        v.commit()
    v.close()
    return _zurueck_zu(zurueck, f"/kriterium/{nummer}")


@app.post("/auflage/{aid}/erfuellt")
def auflage_erfuellt(request: Request, aid: int, wieder_offen: str = Form(""),
                     zurueck: str = Form("")):
    v = datenbank.verbindung()
    a = v.execute("SELECT kriterium FROM auflage WHERE id = ?", (aid,)).fetchone()
    if a:
        if wieder_offen:
            v.execute("UPDATE auflage SET erfuellt_am = NULL, "
                      "erfuellt_von = NULL WHERE id = ?", (aid,))
        else:
            v.execute("UPDATE auflage SET erfuellt_am = ?, erfuellt_von = ? "
                      "WHERE id = ?",
                      (date.today().isoformat(), _wer(request), aid))
        v.commit()
    ziel = f"/kriterium/{a['kriterium']}" if a else "/"
    v.close()
    return _zurueck_zu(zurueck, ziel)


@app.post("/auflage/{aid}/loeschen")
def auflage_loeschen(aid: int, zurueck: str = Form("")):
    v = datenbank.verbindung()
    a = v.execute("SELECT kriterium FROM auflage WHERE id = ?", (aid,)).fetchone()
    if a:
        v.execute("DELETE FROM auflage WHERE id = ?", (aid,))
        v.commit()
    ziel = f"/kriterium/{a['kriterium']}" if a else "/"
    v.close()
    return _zurueck_zu(zurueck, ziel)


@app.post("/kriterium/{nummer}/behoben")
def mangel_behoben(request: Request, nummer: str, wieder_offen: str = Form(""),
                   zurueck: str = Form("")):
    """Einen Mangel aus dem Expertenbericht als behoben markieren oder
    wieder öffnen. Der Bericht selbst bleibt unangetastet; behoben ist die
    Antwort des Betriebs darauf."""
    v = datenbank.verbindung()
    if wieder_offen:
        v.execute("UPDATE kriterium SET behoben_am = NULL, behoben_von = NULL "
                  "WHERE nummer = ?", (nummer,))
    else:
        v.execute("UPDATE kriterium SET behoben_am = ?, behoben_von = ? "
                  "WHERE nummer = ?",
                  (date.today().isoformat(), _wer(request), nummer))
    v.commit()
    v.close()
    return _zurueck_zu(zurueck, f"/kriterium/{nummer}")


@app.get("/kriterium/{nummer}")
def kriterium(request: Request, nummer: str):
    v = datenbank.verbindung()
    k = v.execute("SELECT * FROM kriterium WHERE nummer = ?", (nummer,)).fetchone()
    if not k:
        v.close()
        return RedirectResponse("/")
    massnahmen = v.execute(
        "SELECT * FROM massnahme WHERE kriterium = ? ORDER BY id DESC",
        (nummer,)).fetchall()
    # Dieselbe Liste wie im Handbuch, mit demselben Pruefdatum: es waere
    # dieselbe Abfrage ein zweites Mal.
    belege = handbuch.nachweise(v, nummer, einstellungen(v).get("dossier"))
    # Fuer die Monitoringbereiche: die Anleitung und das Bild des Kreislaufs.
    fuehrung = ANLEITUNG.get(nummer)
    kreislauf_bild = None
    if nummer in MONITORING:
        erste = next((x for x in massnahmen if x["gemessen_am"]), None)
        if erste:
            kreislauf_bild = diagramme.vorher_nachher(
                erste["messwert"] or "erfasst",
                erste["nachmessung_ergebnis"] if erste["nachgemessen_am"] else None,
                titel=f"Kreislauf {nummer}")

    antwort = vorlagen.TemplateResponse(request, "kriterium.html", {
        "k": k,
        "fuehrung": fuehrung,
        "kreislauf_bild": kreislauf_bild,
        "ist_monitoring": nummer in MONITORING,
        "nachweise": json.loads(k["nachweise"] or "[]"),
        "massnahmen": massnahmen,
        "belege": belege,
        # Was im Handbuch zu diesem Kriterium liegt, mit dem dringlichsten
        # Stand. Das Dossier zeigt die SharePoint-Kopie, das Handbuch das
        # Geltende; beides gehoert auf dieselbe Seite.
        "im_handbuch": handbuch.uebersicht(v, [nummer])[nummer],
        "mangel": maengel_laden(v, [nummer]).get(nummer),
        "zyklus": ZYKLEN[zyklus_von(v)],
        "dmaic": zyklus_von(v) == "dmaic",
        "titel": f"Kriterium {nummer}",
        "seite": "dossier",
    })
    v.close()
    return antwort


@app.post("/kriterium/{nummer}/massnahme")
def massnahme_anlegen(
    nummer: str,
    beschreibung: str = Form(...),
    ausloeser: str = Form(""),
    verantwortlich: str = Form(""),
    frist: str = Form(""),
    gemessen_am: str = Form(""),
    messwert: str = Form(""),
    strang: str = Form(""),
    definition: str = Form(""),
    analyse: str = Form(""),
    # Zurueck dorthin, wo erfasst wurde, nicht immer aufs Kriterium.
    zurueck: str = Form(""),
):
    v = datenbank.verbindung()
    v.execute(
        """INSERT INTO massnahme (kriterium, beschreibung, ausloeser,
               verantwortlich, frist, gemessen_am, messwert, strang,
               definition, analyse)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (nummer, beschreibung, ausloeser, verantwortlich, frist,
         gemessen_am, messwert, strang or None,
         definition.strip() or None, analyse.strip() or None))
    v.commit()
    v.close()
    ziel = zurueck if zurueck.startswith("/") else f"/kriterium/{nummer}"
    return RedirectResponse(ziel, status_code=303)


@app.post("/massnahme/{mid}/phasen")
def massnahme_phasen(mid: int, definition: str = Form(""),
                     analyse: str = Form(""), zurueck: str = Form("")):
    """Define und Analyze nachtragen, auch bei einem geschlossenen
    Kreislauf: die Ursache zu benennen ist nachträglich noch Wissen."""
    v = datenbank.verbindung()
    v.execute("UPDATE massnahme SET definition = ?, analyse = ? WHERE id = ?",
              (definition.strip() or None, analyse.strip() or None, mid))
    v.commit()
    v.close()
    return RedirectResponse(zurueck if zurueck.startswith("/") else "/massnahmen",
                            status_code=303)


@app.post("/massnahme/{mid}/nachmessung")
def nachmessung(
    mid: int,
    nachgemessen_am: str = Form(...),
    nachmessung_ergebnis: str = Form(...),
    zurueck: str = Form(""),
):
    v = datenbank.verbindung()
    v.execute(
        "UPDATE massnahme SET nachgemessen_am = ?, nachmessung_ergebnis = ?, "
        "stand = 'geschlossen' WHERE id = ?",
        (nachgemessen_am, nachmessung_ergebnis, mid))
    zeile = v.execute("SELECT kriterium FROM massnahme WHERE id = ?",
                      (mid,)).fetchone()
    v.commit()
    if zurueck.startswith("/"):
        ziel = zurueck
    elif zeile and zeile["kriterium"]:
        ziel = f"/kriterium/{zeile['kriterium']}"
    else:
        ziel = "/massnahmen"
    v.close()
    return RedirectResponse(ziel, status_code=303)


@app.get("/massnahmen")
def massnahmen(request: Request):
    v = datenbank.verbindung()
    alle = v.execute(
        """SELECT m.*, k.titel AS kriterium_titel FROM massnahme m
           LEFT JOIN kriterium k ON k.nummer = m.kriterium
           ORDER BY (m.nachgemessen_am IS NOT NULL AND m.nachgemessen_am <> ''),
                    m.frist""").fetchall()
    antwort = vorlagen.TemplateResponse(request, "massnahmen.html", {
        "massnahmen": alle,
        "stand": kreislaeufe(v),
        "monitoring": MONITORING,
        "titel": "Massnahmen",
        "seite": "massnahmen",
    })
    v.close()
    return antwort


@app.get("/handbuch")
def handbuch_seite(request: Request, q: str = "", meldung: str = "",
                   art: str = "", kapitel: str = ""):
    """Das Handbuch führt alle 56 Kriterien, nach Kapiteln gegliedert.

    Hier wird verwaltet, was auf der Übersicht und der Prozesslandkarte
    angezeigt wird: die Dokumente, die Prüffristen, die Auflagen und die
    Mängel. Mit Suchwort zwei Trefferlisten, die Kriterien mit ihrem
    IVR-Text und die abgelegten Dokumente nach Titel, Version und Inhalt.
    """
    v = datenbank.verbindung()
    dokument_treffer = []
    if q:
        treffer = v.execute(
            """SELECT nummer, titel, kapitel,
                      substr(handbuch, 1, 400) AS auszug
               FROM kriterium
               WHERE titel LIKE ? OR handbuch LIKE ? OR beschreibung LIKE ?
               ORDER BY sortierung""",
            (f"%{q}%", f"%{q}%", f"%{q}%")).fetchall()
        dokument_treffer = handbuch.suchen(v, q)
    else:
        # Kapitel 8 wird nicht hier verwaltet: die Ergebnisqualität hat
        # ihre eigenen Seiten unter «Qualitätskreisläufe nach 8.1».
        # Michael am 15.09.2026: «die 8er Kriterien sollen dort nicht
        # verwaltet werden, diese haben ja einen eigenen Abschnitt.»
        treffer = v.execute(
            """SELECT nummer, titel, kapitel, erneuerung_muss, erneuerung_soll,
                      anerkennung_muss, anerkennung_soll, min_erneuerung,
                      substr(handbuch, 1, 400) AS auszug
               FROM kriterium WHERE kapitel <> 'Ergebnis'
               ORDER BY sortierung""").fetchall()

    nummern = [z["nummer"] for z in treffer]
    stand = handbuch.uebersicht(v, nummern)
    dossier = handbuch.dossier_zahlen(v)
    auflagen_je = auflagen_laden(v, nummern)
    maengel = maengel_laden(v, nummern)

    # Nach Kapiteln gruppieren, in der Reihenfolge der Richtlinie. Ein
    # Kapitelfilter hält die Seite bei 56 Kriterien noch lesbar.
    gruppen, folge = {}, []
    for z in treffer:
        kap = z["kapitel"]
        if kap not in gruppen:
            gruppen[kap] = []
            folge.append(kap)
        m = maengel.get(z["nummer"]) or {}
        auf = auflagen_je.get(z["nummer"], [])
        gruppen[kap].append({
            "nummer": z["nummer"], "titel": z["titel"], "kapitel": kap,
            "auszug": z["auszug"],
            # Die Latte der Erneuerung, nicht die der Erstanerkennung: der
            # Qualitätsbericht 7.1 etwa wechselt von Soll auf Muss.
            "muss": z["erneuerung_muss"] if "erneuerung_muss" in z.keys() else 0,
            "soll": z["erneuerung_soll"] if "erneuerung_soll" in z.keys() else 0,
            "nur_erst": (z["anerkennung_muss"] and not z["erneuerung_muss"]
                         and not z["erneuerung_soll"])
                        if "anerkennung_muss" in z.keys() else False,
            "min_erneuerung": z["min_erneuerung"] if "min_erneuerung" in z.keys() else None,
            "dokumente": stand[z["nummer"]]["anzahl"],
            "stand": stand[z["nummer"]]["stand"],
            "dossier": dossier.get(z["nummer"],
                                   {"gesamt": 0, "fertig": 0, "geprueft": 0}),
            "auflagen_offen": [x for x in auf if not x["erfuellt_am"]],
            "auflagen": auf,
            "bemaengelt": m.get("bemaengelt"),
            "behoben_am": m.get("behoben_am"),
            "kommentare": len(m.get("kommentare") or []),
            "ablauf": z["nummer"].startswith("7.3."),
        })
    kapitel = kapitel if kapitel in gruppen else ""
    plan = handbuch.pruefplan(v, einstellungen(v).get("dossier"))
    baender = [{"name": k, "kriterien": gruppen[k]} for k in folge
               if not kapitel or k == kapitel]

    antwort = vorlagen.TemplateResponse(request, "handbuch.html", {
        "treffer": treffer,
        "baender": baender,
        "kapitelnamen": folge,
        "kapitel": kapitel,
        "gesamt": len(treffer),
        "dokument_treffer": dokument_treffer,
        "faellige": handbuch.faellige(v),
        "auflagen": offene_auflagen(v),
        # Bis zum Einreichen muss jede Datei des Dossiers einmal angeschaut
        # sein. Der Plan sagt, wie weit das ist und wie viel Zeit bleibt.
        "plan": plan,
        "planbalken": diagramme.lage_balken([
            ("geprüft", plan["geprueft"], "l-gruen"),
            ("noch ungeprüft", plan["offen"], "l-grau"),
        ]),
        "spaet": v.execute(
            """SELECT COUNT(*) FROM handbuch_dokument
               WHERE naechste_pruefung IS NULL OR naechste_pruefung > ?""",
            (plan["frist"] or "9999-12-31",)).fetchone()[0],
        "q": q, "meldung": meldung, "art": art,
        "titel": "Handbuch",
        "seite": "handbuch",
    })
    v.close()
    return antwort


@app.post("/handbuch/pruefdatum")
def handbuch_pruefdatum(request: Request):
    """Zieht die Pruefung aller Handbuchdokumente auf die Dossierfrist vor,
    soweit sie spaeter laege oder ganz fehlt. Damit ist bis zum Einreichen
    jedes Dokument einmal durchgesehen."""
    v = datenbank.verbindung()
    frist = einstellungen(v).get("dossier")
    zahl = handbuch.vorziehen(v, frist)
    v.close()
    if not frist:
        art, meldung = "fehler", "Ohne Dossierfrist gibt es kein Prüfdatum."
    elif zahl:
        art = "gut"
        meldung = (f"{zahl} {'Dokument wird' if zahl == 1 else 'Dokumente werden'} "
                   f"jetzt spätestens am {schweizer_datum(frist)} geprüft.")
    else:
        art, meldung = "gut", "Jedes Dokument wird vor dem Einreichen geprüft."
    return RedirectResponse(f"/handbuch?art={art}&meldung={quote(meldung)}",
                            status_code=303)


def _pfade_von(v, nummer, umfang, dokument):
    """Welche Dossierdateien gemeint sind: eine, die freigegebenen oder die
    uebrigen. Die Auswahl kommt aus der Datenbank und nicht aus dem
    Formular; von dort kommt nur, welche."""
    if umfang in ("fertig", "uebrige"):
        bedingung = ("d.status = 'fertig'" if umfang == "fertig"
                     else "d.status <> 'fertig'")
        return [z["pfad"] for z in v.execute(
            f"""SELECT d.pfad FROM dokument d JOIN beleg b ON b.dokument = d.id
                WHERE b.kriterium = ? AND {bedingung}""", (nummer,))]
    try:
        kennung = int(dokument or 0)
    except ValueError:
        return []
    z = v.execute(
        """SELECT d.pfad FROM dokument d JOIN beleg b ON b.dokument = d.id
           WHERE d.id = ? AND b.kriterium = ?""", (kennung, nummer)).fetchone()
    return [z["pfad"]] if z else []


@app.post("/handbuch/{nummer}/geprueft")
def dossier_geprueft(request: Request, nummer: str, dokument: str = Form(""),
                     umfang: str = Form(""), zurueck: str = Form("")):
    """Eine Dossierdatei ist angeschaut und gilt, oder eine ganze Liste.

    Michael am 15.09.2026: «füge allen dokumenten ein prüfdatum ein, dass
    wir bis zum einreichen alles auf einem aktuellen stand sind.»
    """
    v = datenbank.verbindung()
    pfade = _pfade_von(v, nummer, umfang, dokument)
    if not pfade:
        v.close()
        return _zum_ablauf(nummer, "fehler",
                           "Diese Datei gehört nicht zu diesem Kriterium.",
                           "dossier")
    if zurueck:
        zahl, bewegt = handbuch.pruefung_zuruecknehmen(v, pfade)
        if not zahl:
            meldung = "Da war keine Prüfung, die sich zurücknehmen liesse."
        elif zahl == 1:
            meldung = "Die Prüfung ist zurückgenommen."
            if bewegt:
                meldung += " Die Datei liegt wieder, wo sie vorher lag."
        else:
            meldung = f"{zahl} Prüfungen sind zurückgenommen."
            if bewegt:
                meldung += (f" {bewegt} {'Datei liegt' if bewegt == 1 else 'Dateien liegen'} "
                            "wieder, wo sie vorher lagen.")
    else:
        # Michael am 15.09.2026: «wenn die datei geprüft wurde soll sie in
        # fertig verschoben werden.»
        zahl, bewegt = handbuch.pruefen(v, pfade, _wer(request))
        if zahl == 1:
            meldung = ("Die Datei ist geprüft und liegt jetzt in «Fertig»."
                       if bewegt else
                       "Die Datei ist geprüft und gilt als aktuell.")
        else:
            meldung = f"{zahl} Dateien sind geprüft und gelten als aktuell."
            if bewegt:
                meldung += (f" {bewegt} davon "
                            f"{'liegt' if bewegt == 1 else 'liegen'} "
                            "jetzt in «Fertig».")
    v.close()
    return _zum_ablauf(nummer, "gut", meldung, "dossier")


@app.post("/handbuch/{nummer}/prueffrist")
def dossier_prueffrist(request: Request, nummer: str, dokument: str = Form(""),
                       frist: str = Form("")):
    """Eine eigene Frist fuer eine Datei, die vor dem Dossier ablaeuft: eine
    Bewilligung, ein Vertrag, ein Zertifikat. Leer heisst wieder: es gilt
    die Frist des Dossiers."""
    v = datenbank.verbindung()
    pfade = _pfade_von(v, nummer, "", dokument)
    if not pfade:
        v.close()
        return _zum_ablauf(nummer, "fehler",
                           "Diese Datei gehört nicht zu diesem Kriterium.",
                           "dossier")
    ziel = handbuch.frist_setzen(v, pfade[0], frist)
    vorgabe = einstellungen(v).get("dossier")
    v.close()
    meldung = (f"Zu prüfen bis {schweizer_datum(ziel.isoformat())}." if ziel
               else f"Es gilt wieder die Frist des Dossiers, "
                    f"{schweizer_datum(vorgabe)}.")
    return _zum_ablauf(nummer, "gut", meldung, "dossier")


def _zum_ablauf(nummer, art, meldung, anker=""):
    ziel = f"/handbuch/{quote(nummer)}?art={art}&meldung={quote(meldung)}"
    return RedirectResponse(ziel + (f"#{anker}" if anker else ""),
                            status_code=303)


def _wer(request):
    kennung = anmeldung.wer(request)
    return anmeldung.name_von(kennung) if kennung else ""


@app.get("/nachweis/{dokument_id}")
def nachweis_datei(dokument_id: int):
    """Eine Datei aus dem Dossier öffnen. Sie liegt unter «IVR Dokumente»
    und wird nur gelesen, nie verändert."""
    v = datenbank.verbindung()
    d = v.execute("SELECT * FROM dokument WHERE id = ?", (dokument_id,)).fetchone()
    v.close()
    if not d:
        return RedirectResponse("/", status_code=303)
    try:
        pfad = handbuch.dossier_pfad(d["pfad"])
    except listen.Abgelehnt:
        return RedirectResponse("/", status_code=303)
    if not pfad.is_file():
        return RedirectResponse("/", status_code=303)
    name = listen.sicherer_name(pfad.name)
    im_browser = pfad.suffix.lower() in (".pdf", ".png", ".jpg", ".jpeg", ".txt")
    return FileResponse(
        pfad, filename=name,
        content_disposition_type="inline" if im_browser else "attachment")


@app.post("/handbuch/{nummer}/uebernehmen")
def handbuch_uebernehmen(request: Request, nummer: str,
                         dokument: str = Form("")):
    """Eine Dossierdatei ins Handbuch aufnehmen. Ein Knopf, keine Kopie:
    die Datei bleibt im Dossier, das Handbuch führt sie."""
    v = datenbank.verbindung()
    try:
        kennung, d = handbuch.verknuepfen(v, nummer, int(dokument or 0),
                                          handbuch.VORGABE_INTERVALL,
                                          _wer(request),
                                          einstellungen(v).get("dossier"))
        neu = handbuch.holen(v, kennung)
    except (listen.Abgelehnt, ValueError) as e:
        v.close()
        return _zum_ablauf(nummer, "fehler", str(e))
    v.close()
    meldung = f"«{neu['titel']}» ist jetzt im Handbuch, verknüpft mit dem Dossier."
    if neu["naechste_pruefung"]:
        meldung += f" Prüfung am {schweizer_datum(neu['naechste_pruefung'])}."
    return _zum_ablauf(nummer, "gut", meldung, f"dok-{kennung}")


@app.get("/handbuch/dokument/{kennung}")
def handbuch_datei(kennung: int):
    """Die Datei selbst. PDF und Bilder oeffnet der Browser, alles andere
    laedt er herunter; der Dateiname ist der Titel, nicht der Zeitstempel."""
    v = datenbank.verbindung()
    try:
        d = handbuch.holen(v, kennung)
        pfad = handbuch.pfad_von(d)
    except listen.Abgelehnt:
        v.close()
        return RedirectResponse("/handbuch", status_code=303)
    v.close()
    if not pfad.is_file():
        return RedirectResponse("/handbuch", status_code=303)
    name = listen.sicherer_name(f"{d['titel']}.{d['endung']}")
    im_browser = d["endung"] in ("pdf", "png", "jpg", "jpeg", "txt")
    return FileResponse(
        pfad, filename=name,
        content_disposition_type="inline" if im_browser else "attachment")


@app.post("/handbuch/dokument/{kennung}/bestaetigen")
def handbuch_bestaetigen(request: Request, kennung: int):
    v = datenbank.verbindung()
    try:
        d = handbuch.holen(v, kennung)
        naechste = handbuch.bestaetigen(v, kennung, _wer(request))
    except listen.Abgelehnt as e:
        v.close()
        return RedirectResponse(f"/handbuch?art=fehler&meldung={quote(str(e))}",
                                status_code=303)
    v.close()
    meldung = f"«{d['titel']}» ist als aktuell bestätigt."
    if naechste:
        meldung += f" Nächste Prüfung am {schweizer_datum(naechste)}."
    return _zum_ablauf(d["kriterium"], "gut", meldung, f"dok-{kennung}")


@app.post("/handbuch/dokument/{kennung}/erinnerung")
def handbuch_erinnerung(kennung: int, intervall: str = Form("0"),
                        naechste_pruefung: str = Form("")):
    v = datenbank.verbindung()
    try:
        d = handbuch.holen(v, kennung)
        ziel = handbuch.erinnerung(v, kennung, intervall, naechste_pruefung)
    except (listen.Abgelehnt, ValueError) as e:
        v.close()
        return RedirectResponse(f"/handbuch?art=fehler&meldung={quote(str(e))}",
                                status_code=303)
    v.close()
    if ziel:
        meldung = (f"Erinnerung für «{d['titel']}» gesetzt: Prüfung am "
                   f"{schweizer_datum(ziel)}.")
    else:
        meldung = f"Für «{d['titel']}» gibt es keine Erinnerung mehr."
    return _zum_ablauf(d["kriterium"], "gut", meldung, f"dok-{kennung}")


@app.post("/handbuch/dokument/{kennung}/loeschen")
def handbuch_loeschen(kennung: int):
    v = datenbank.verbindung()
    try:
        d = handbuch.loeschen(v, kennung)
    except listen.Abgelehnt as e:
        v.close()
        return RedirectResponse(f"/handbuch?art=fehler&meldung={quote(str(e))}",
                                status_code=303)
    v.close()
    return _zum_ablauf(d["kriterium"], "gut", f"«{d['titel']}» ist gelöscht.")


@app.get("/handbuch/{nummer}")
def handbuch_ablauf(request: Request, nummer: str, meldung: str = "",
                    art: str = ""):
    """Ein Betriebsablauf mit seinen geltenden Dokumenten."""
    v = datenbank.verbindung()
    k = v.execute("SELECT * FROM kriterium WHERE nummer = ?", (nummer,)).fetchone()
    if not k:
        v.close()
        return RedirectResponse("/handbuch", status_code=303)
    antwort = vorlagen.TemplateResponse(request, "handbuch_ablauf.html", {
        "k": k,
        "mangel": maengel_laden(v, [nummer]).get(nummer),
        "dokumente": handbuch.dokumente(v, nummer),
        "nachweise": handbuch.nachweise(v, nummer,
                                        einstellungen(v).get("dossier")),
        "dossierfrist": einstellungen(v).get("dossier"),
        "intervalle": handbuch.INTERVALLE,
        "intervall_namen": dict(handbuch.INTERVALLE),
        "vorgabe_intervall": handbuch.VORGABE_INTERVALL,
        "grenze_mb": handbuch.GRENZE_BYTES // 1024 // 1024,
        "heute": date.today().isoformat(),
        "meldung": meldung, "art": art,
        "titel": f"Handbuch {nummer}",
        "seite": "handbuch",
    })
    v.close()
    return antwort


@app.post("/handbuch/{nummer}/hochladen")
async def handbuch_hochladen(request: Request, nummer: str,
                             datei: UploadFile = File(...),
                             titel: str = Form("")):
    """Eine Datei kommt ins Dossier, zum Kriterium, in «In Bearbeitung».

    Michael am 15.09.2026: «hochgeladene dokumente kommen in das dossier».
    Was daraus der geltende Stand wird, entscheidet danach der Verwalter.
    """
    try:
        # Stueckweise lesen und unterwegs abbrechen, wie bei den Listen.
        rohdaten = b""
        while True:
            stueck = await datei.read(256 * 1024)
            if not stueck:
                break
            rohdaten += stueck
            if len(rohdaten) > handbuch.GRENZE_BYTES:
                raise listen.Abgelehnt(
                    f"Die Datei ist grösser als "
                    f"{handbuch.GRENZE_BYTES // 1024 // 1024} MB.")
        v = datenbank.verbindung()
        try:
            kennung, relativ = handbuch.ins_dossier(
                v, nummer, datei.filename, rohdaten, titel, _wer(request))
            frist = einstellungen(v).get("dossier")
        finally:
            v.close()
    except listen.Abgelehnt as e:
        return _zum_ablauf(nummer, "fehler", str(e), "hochladen")
    finally:
        await datei.close()

    ordner = relativ.rsplit("/", 1)[0] if "/" in relativ else "Dossier"
    meldung = (f"Die Datei liegt jetzt im Dossier unter «{ordner}». "
               "Geprüft ist sie damit nicht")
    meldung += (f"; das muss bis zum {schweizer_datum(frist)} geschehen."
                if frist else ".")
    return _zum_ablauf(nummer, "gut", meldung, "dossier")


@app.post("/handbuch/{nummer}/dossier-loeschen")
def dossier_datei_loeschen(request: Request, nummer: str,
                           dokument: str = Form("")):
    """Eine selbst hochgeladene Datei wieder aus dem Dossier nehmen. Was aus
    dem SharePoint stammt, bleibt: das Dossier ist die Kopie eines
    Bestandes, den das Werkzeug nicht führt."""
    v = datenbank.verbindung()
    try:
        titel = handbuch.dossier_loeschen(v, nummer, int(dokument or 0))
    except (listen.Abgelehnt, ValueError) as e:
        v.close()
        return _zum_ablauf(nummer, "fehler", str(e), "dossier")
    v.close()
    return _zum_ablauf(nummer, "gut", f"«{titel}» ist aus dem Dossier "
                       "entfernt.", "dossier")


@app.get("/analysen")
def analysen(request: Request, meldung: str = "", art: str = ""):
    """Die Analysen nach Kapitel 8, beginnend mit der Zeiterfassung (8.3).

    Richtwert aus der Richtlinie: Hilfsfrist bei P1 unter 15 Minuten in
    90 Prozent der Fälle, auf zehn Minuten ist hinzuarbeiten.
    """
    v = datenbank.verbindung()
    pfad = pfade.daten("hilfsfrist.json")
    daten = json.loads(pfad.read_text(encoding="utf-8")) if pfad.exists() else None

    zeichnungen = {}
    eigener = (einstellungen(v).get("eigener_dienst")
               or einstellungen(v).get("betrieb") or "")
    if daten:
        monate = daten["monate"]
        kurz = [m["monat"][5:7] + "." for m in monate]
        zeichnungen["verlauf"] = diagramme.linie_quote(
            [{"werte": [m["anteil_u15"] for m in monate]},
             {"werte": [m["anteil_u10"] for m in monate]}],
            kurz, richtwert=daten["richtwert_u15"], y_von=75, y_bis=100,
            titel="Hilfsfrist P1 über zwölf Monate")
        # Der eigene Dienst wird hervorgehoben. Wie er in den Daten der
        # Leitstelle heisst, sagt die Einstellung; steht dort nichts, ist
        # kein Balken hervorgehoben, und das ist ehrlicher als ein Name,
        # den jemand anderes eingetragen hat.
        zeichnungen["dienste"] = diagramme.balken_quote(
            [{"name": d["dienst"], "wert": d["u15"], "n": d["n"],
              "klasse": "r1" if d["dienst"] == eigener else "rest"}
             for d in daten["nach_dienst"]],
            richtwert=daten["richtwert_u15"],
            titel="Anteil unter 15 Minuten nach ausrückendem Dienst")

    # Indikatordiagnosen nach 8.4
    ind_pfad = pfade.daten("indikatordiagnosen.json")
    ind = json.loads(ind_pfad.read_text(encoding="utf-8")) if ind_pfad.exists() else None
    if ind:
        posten = []
        for name, e in ind["diagnosen"].items():
            if not e:
                continue
            posten.append({
                "name": name, "wert": e["u15"],
                # Kein eigenes Label: so steht der Prozentwert am Balken und
                # die Fallzahl rechts aussen, und beides ist noetig.
                "klasse": "unter" if e["u15"] < ind["richtwert_u15"] else "r1",
                "n": e["n"],
            })
        zeichnungen["diagnosen"] = diagramme.balken_quote(
            posten, richtwert=ind["richtwert_u15"],
            titel="Hilfsfrist je Indikatordiagnose")

    antwort = vorlagen.TemplateResponse(request, "analysen.html", {
        "daten": daten,
        "ind": ind,
        "meldung": meldung, "art": art,
        # Die Reanimationsdaten gehören zu 8.5 und haben keinen eigenen
        # Bereich; sie werden hier hochgeladen.
        "swissreca": listen.QUELLEN["swissreca"],
        "swissreca_dateien": listen.bestand("swissreca"),
        "zeichnungen": zeichnungen,
        "eigener_dienst": eigener,
        "betrieb": einstellungen(v).get("betrieb", ""),
        "titel": "Analysen",
        "seite": "analysen",
    })
    v.close()
    return antwort


@app.get("/faelle")
def faelle(request: Request, meldung: str = "", art: str = ""):
    """Beschwerden und Rückmeldungen von aussen, Kriterium 8.1.3.

    Die Felder des Falls bleiben ohne Personendaten: Fallnummer, Datum,
    Kategorie und Bearbeitungsstand. Die Anhaenge am Fall sind davon
    ausgenommen, siehe anhaenge.py.
    """
    v = datenbank.verbindung()
    alle = v.execute(
        "SELECT * FROM beschwerde ORDER BY datum IS NULL, datum DESC, nr"
    ).fetchall()

    je_jahr = {}
    for b in alle:
        j = (b["datum"] or "ohne Datum")[:4]
        je_jahr[j] = je_jahr.get(j, 0) + 1
    ohne_kategorie = sum(1 for b in alle if not b["kategorie"] or
                         b["kategorie"] == "Negativ")
    mit_protokoll = sum(1 for b in alle if b["protokoll"])

    # «ohne Datum» gehört nicht in die Jahresreihe, es wäre sonst der
    # längste Balken und verzerrte den Verlauf.
    je_kategorie = {}
    for b in alle:
        k = b["kategorie"] or "ohne Kategorie"
        je_kategorie[k] = je_kategorie.get(k, 0) + 1
    kat_sortiert = sorted(je_kategorie.items(), key=lambda x: (-x[1], x[0]))
    hoechste_kat = max(je_kategorie.values(), default=1)
    kat_bild = diagramme.balken_quote(
        [{"name": k,
          "wert": n / hoechste_kat * 100,
          "label": f"{n} Fälle" if n != 1 else "1 Fall",
          "klasse": "rest" if k == "Sonstiges" else "r1"}
         for k, n in kat_sortiert],
        titel="Fälle je Kategorie", beschriftung_breite=260)

    jahre = sorted(k for k in je_jahr if k != "ohne")
    hoechster = max((je_jahr[j] for j in jahre), default=1)
    bild = diagramme.balken_quote(
        [{"name": j, "wert": je_jahr[j] / hoechster * 100,
          "label": f"{je_jahr[j]} Fälle" if je_jahr[j] != 1 else "1 Fall",
          "klasse": "r1"} for j in jahre],
        titel="Fälle je Jahr") if jahre else ""
    ohne_datum = je_jahr.get("ohne", 0)

    antwort = vorlagen.TemplateResponse(request, "faelle.html", {
        "faelle": alle,
        "je_jahr": je_jahr,
        "kat_bild": kat_bild,
        "kat_sortiert": kat_sortiert,
        "ohne_datum": ohne_datum,
        "ohne_kategorie": ohne_kategorie,
        "mit_protokoll": mit_protokoll,
        "kategorien": BESCHWERDE_KATEGORIEN,
        "staende": BESCHWERDE_STAENDE,
        "wege": BESCHWERDE_WEGE,
        "medizinisch_werte": MEDIZINISCH,
        "transport_werte": TRANSPORT,
        "bewertung_werte": BEWERTUNG,
        "heute": date.today().isoformat(),
        "bild": bild,
        "anhaenge": anhaenge.je_fall(v),
        "grenze_mb": anhaenge.GRENZE_BYTES // 1024 // 1024,
        "meldung": meldung, "art": art,
        "betrieb": einstellungen(v).get("betrieb", ""),
        "titel": "Beschwerdemanagement",
        "seite": "faelle",
    })
    v.close()
    return antwort


def _zum_fall(nr, art, meldung):
    return RedirectResponse(
        f"/faelle?art={art}&meldung={quote(meldung)}#fall-{nr}", status_code=303)


@app.post("/fall/{nr}/anhang")
async def fall_anhang(request: Request, nr: int,
                      datei: UploadFile = File(...), titel: str = Form("")):
    try:
        rohdaten = b""
        while True:
            stueck = await datei.read(256 * 1024)
            if not stueck:
                break
            rohdaten += stueck
            if len(rohdaten) > anhaenge.GRENZE_BYTES:
                raise listen.Abgelehnt(
                    f"Die Datei ist grösser als "
                    f"{anhaenge.GRENZE_BYTES // 1024 // 1024} MB.")
        v = datenbank.verbindung()
        try:
            kennung = anhaenge.speichern(v, nr, datei.filename, rohdaten,
                                         titel, _wer(request))
            a = anhaenge.holen(v, kennung)
        finally:
            v.close()
    except listen.Abgelehnt as e:
        return _zum_fall(nr, "fehler", str(e))
    finally:
        await datei.close()
    return _zum_fall(nr, "gut", f"«{a['titel']}» hängt jetzt an Fall {nr}.")


@app.get("/fall/anhang/{kennung}")
def fall_anhang_datei(kennung: int):
    v = datenbank.verbindung()
    try:
        a = anhaenge.holen(v, kennung)
        pfad = anhaenge.pfad_von(a)
    except listen.Abgelehnt:
        v.close()
        return RedirectResponse("/faelle", status_code=303)
    v.close()
    if not pfad.is_file():
        return RedirectResponse("/faelle", status_code=303)
    name = listen.sicherer_name(f"{a['titel']}.{a['endung']}")
    im_browser = a["endung"] in ("pdf", "png", "jpg", "jpeg", "txt")
    return FileResponse(
        pfad, filename=name,
        content_disposition_type="inline" if im_browser else "attachment")


@app.post("/fall/anhang/{kennung}/loeschen")
def fall_anhang_loeschen(kennung: int):
    v = datenbank.verbindung()
    try:
        a = anhaenge.loeschen(v, kennung)
    except listen.Abgelehnt as e:
        v.close()
        return RedirectResponse(f"/faelle?art=fehler&meldung={quote(str(e))}",
                                status_code=303)
    v.close()
    return _zum_fall(a["fall_nr"], "gut", f"«{a['titel']}» ist gelöscht.")


# --- Einstellungen: Erscheinungsbild, eigenes Konto, Benutzer --------------

def dossier_stand():
    """Was im Dossier liegt: Dateien, Ordner, Grösse und wann zuletzt
    gelesen wurde. Damit sieht man vor dem Knopfdruck, worauf er wirkt."""
    wurzel = handbuch.DOSSIER
    stand = {"pfad": str(wurzel), "dateien": 0, "ordner": 0, "bytes": 0,
             "gelesen": None, "da": wurzel.is_dir()}
    if stand["da"]:
        for p in wurzel.rglob("*"):
            if p.is_dir():
                continue
            try:
                stand["bytes"] += p.stat().st_size
            except OSError:
                continue
            stand["dateien"] += 1
        stand["ordner"] = sum(1 for p in wurzel.iterdir() if p.is_dir())
    liste = dossier.LISTE
    if liste.is_file():
        stand["gelesen"] = datetime.fromtimestamp(
            liste.stat().st_mtime).strftime("%d.%m.%Y um %H:%M")
    v = datenbank.verbindung()
    stand["in_der_datenbank"] = v.execute(
        "SELECT COUNT(*) FROM dokument").fetchone()[0]
    stand["eigene"] = v.execute(
        "SELECT COUNT(*) FROM dokument WHERE eigen = 1").fetchone()[0]
    v.close()
    return stand


def _zu_einstellungen(art, meldung, anker=""):
    ziel = f"/einstellungen?art={art}&meldung={quote(meldung)}"
    return RedirectResponse(ziel + (f"#{anker}" if anker else ""),
                            status_code=303)


DIAGRAMMARTEN = {"balken": "Balken", "kuchen": "Kuchen"}


def diagrammart_von(v, nummer):
    wahl = einstellungen(v).get(f"diagramm_{nummer}") or "balken"
    return wahl if wahl in DIAGRAMMARTEN else "balken"


def tragende_bereiche(v):
    """Die fünf Bereiche nach 8.1 mit dem Vermerk, ob sie tragend sind."""
    gewaehlt = set(filter(None, (einstellungen(v).get("tragende") or "").split(",")))
    return [{"nummer": n, "name": name, "tragend": n in gewaehlt}
            for n, name in MONITORING.items()]


@app.get("/einstellungen")
def einstellungen_seite(request: Request, meldung: str = "", art: str = ""):
    kennung = anmeldung.wer(request)
    v = datenbank.verbindung()
    bereiche = tragende_bereiche(v)
    zyklus = zyklus_von(v)
    v.close()
    antwort = vorlagen.TemplateResponse(request, "einstellungen.html", {
        "ich": anmeldung.benutzer(kennung),
        "rechte": anmeldung.RECHTE,
        "bereiche": bereiche,
        "zyklen": ZYKLEN,
        "zyklus": zyklus,
        # Die Liste sieht nur, wer verwaltet; die Vorlage prueft es noch
        # einmal, die Routen darunter prueft die Tuer.
        "benutzer": (anmeldung.benutzer_liste()
                     if anmeldung.darf(kennung, "verwalten") else []),
        "meldung": meldung, "art": art,
        "titel": "Einstellungen",
        "dossier_stand": dossier_stand(),
        "tuerwaechter": anmeldung.TUERWAECHTER,
        "seite": "einstellungen",
    })
    return antwort


@app.post("/dossier/einlesen")
def dossier_einlesen(request: Request):
    """Geht das Dossier auf dem Server durch und schreibt die Dateiliste neu.

    Michael am 15.09.2026: «nichts soll auf dem rechner laufen, alles auf
    dem proxmox». Vorher lief das Durchgehen auf seinem Rechner und die
    Liste wurde übertragen; jetzt liegt das Dossier hier und wird hier
    gelesen. Selbst hochgeladene Dateien bleiben dabei erhalten.
    """
    try:
        e = dossier.neu_einlesen()
    except Exception as fehler:  # noqa: BLE001 - dem Bedienenden sagen, was war
        return _zu_einstellungen(
            "fehler", f"Das Dossier liess sich nicht lesen: {fehler}",
            "dossier")
    meldung = (f"{e['gelesen']} Dateien gelesen, {e['zugeordnet']} einem "
               f"Kriterium zugeordnet, {e['belegte']} Kriterien belegt.")
    if e["unbekannt"]:
        meldung += (f" {len(e['unbekannt'])} Ordner tragen eine Nummer, zu "
                    "der es kein Kriterium gibt: "
                    + ", ".join(e["unbekannt"][:4])
                    + ("…" if len(e["unbekannt"]) > 4 else ""))
    return _zu_einstellungen("gut", meldung, "dossier")


@app.post("/einstellungen/zyklus")
def zyklus_setzen(zyklus: str = Form("pdca")):
    if zyklus not in ZYKLEN:
        return _zu_einstellungen("fehler", "Diesen Zyklus gibt es nicht.", "zyklus")
    v = datenbank.verbindung()
    datenbank.einstellung_setzen(v, "zyklus", zyklus)
    v.close()
    return _zu_einstellungen(
        "gut", f"Die Kreisläufe werden jetzt als {ZYKLEN[zyklus]['kurz']} "
               f"gezeigt: {ZYKLEN[zyklus]['legende']}.", "zyklus")


@app.post("/einstellungen/tragende")
async def tragende_setzen(request: Request):
    """Welche der fünf Bereiche zur Erneuerung zählen. Das IVR verlangt
    drei; weniger sind erlaubt, werden aber angesagt, mehr sind Vorsorge."""
    formular = await request.form()
    gewaehlt = [n for n in formular.getlist("tragend") if n in MONITORING]
    v = datenbank.verbindung()
    datenbank.einstellung_setzen(v, "tragende", ",".join(gewaehlt))
    v.close()
    if not gewaehlt:
        meldung = ("Kein Bereich ist tragend. Zur Erneuerung braucht es drei "
                   "mit geschlossenem Kreislauf.")
        return _zu_einstellungen("warnung", meldung, "tragend")
    meldung = f"Tragend: {', '.join(gewaehlt)}."
    if len(gewaehlt) < 3:
        return _zu_einstellungen(
            "warnung", meldung + " Das IVR verlangt drei Bereiche.", "tragend")
    return _zu_einstellungen("gut", meldung, "tragend")


@app.post("/einstellungen/konto/passwort")
def konto_passwort(request: Request, aktuell: str = Form(""),
                   neu: str = Form(""), wiederholung: str = Form("")):
    try:
        anmeldung.passwort_aendern(anmeldung.wer(request), aktuell, neu,
                                   wiederholung)
    except ValueError as e:
        return _zu_einstellungen("fehler", str(e), "konto")
    return _zu_einstellungen("gut", "Das Passwort ist geändert.", "konto")


@app.post("/einstellungen/benutzer/neu")
def benutzer_neu(kennung: str = Form(""), name: str = Form(""),
                 recht: str = Form("lesen")):
    try:
        k = anmeldung.benutzer_anlegen(kennung, name, recht)
    except ValueError as e:
        return _zu_einstellungen("fehler", str(e), "benutzer")
    return _zu_einstellungen(
        "gut", f"Konto «{k}» angelegt. Das Passwort legt die Person bei der "
               "ersten Anmeldung selbst fest.", f"b-{k}")


@app.post("/einstellungen/benutzer/{kennung}")
def benutzer_aendern(kennung: str, name: str = Form(""),
                     recht: str = Form("lesen")):
    try:
        anmeldung.benutzer_aendern(kennung, name, recht)
    except ValueError as e:
        return _zu_einstellungen("fehler", str(e), f"b-{kennung}")
    return _zu_einstellungen(
        "gut", f"«{kennung}» gespeichert: {anmeldung.RECHT_NAME[recht]}.",
        f"b-{kennung}")


@app.post("/einstellungen/benutzer/{kennung}/passwort")
def benutzer_passwort_zuruecksetzen(kennung: str):
    try:
        anmeldung.passwort_loeschen(kennung)
    except KeyError:
        return _zu_einstellungen("fehler", "Dieses Konto gibt es nicht.",
                                 "benutzer")
    return _zu_einstellungen(
        "gut", f"Das Passwort von «{kennung}» ist zurückgesetzt. Bei der "
               "nächsten Anmeldung wird ein neues festgelegt.", f"b-{kennung}")


@app.post("/einstellungen/benutzer/{kennung}/entfernen")
def benutzer_entfernen(request: Request, kennung: str):
    try:
        name = anmeldung.benutzer_entfernen(kennung, anmeldung.wer(request))
    except ValueError as e:
        return _zu_einstellungen("fehler", str(e), f"b-{kennung}")
    return _zu_einstellungen("gut", f"Das Konto von {name} ist entfernt.",
                             "benutzer")


FALL_FELDER = ("datum", "eingang", "kategorie", "stand", "mitarbeitende",
               "medizinisch", "transport", "bewertung", "notiz")


@app.post("/massnahme/{mid}/fortfuehren")
def massnahme_fortfuehren(
    mid: int,
    beschreibung: str = Form(...),
    verantwortlich: str = Form(""),
    frist: str = Form(""),
    analyse: str = Form(""),
    zurueck: str = Form(""),
):
    """Setzt einen geschlossenen Kreislauf fort.

    Die Nachmessung der alten Runde wird zum Ausgangswert der neuen. Das ist
    der Act-Schritt: Die Massnahme hat nicht oder nicht genug gewirkt, die
    Ursachenannahme wird korrigiert, und gemessen wird weiter mit derselben
    Grösse.
    """
    v = datenbank.verbindung()
    alt = v.execute("SELECT * FROM massnahme WHERE id = ?", (mid,)).fetchone()
    if not alt or not alt["nachgemessen_am"]:
        v.close()
        return RedirectResponse(zurueck or "/massnahmen", status_code=303)

    # Define bleibt, das Problem ist dasselbe. Analyze ist neu: die zweite
    # Runde folgt einer anderen Ursachenannahme.
    v.execute(
        """INSERT INTO massnahme (kriterium, strang, ausloeser, beschreibung,
               verantwortlich, frist, gemessen_am, messwert, vorgaenger,
               definition, analyse)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (alt["kriterium"], alt["strang"], alt["ausloeser"], beschreibung,
         verantwortlich or alt["verantwortlich"], frist or None,
         alt["nachgemessen_am"], alt["nachmessung_ergebnis"], mid,
         alt["definition"], analyse.strip() or None))
    v.commit()
    v.close()
    return RedirectResponse(zurueck or f"/bereich/{alt['kriterium']}",
                            status_code=303)


@app.post("/fall/neu")
def fall_anlegen(
    datum: str = Form(""), eingang: str = Form(""), kategorie: str = Form(""),
    mitarbeitende: str = Form(""), medizinisch: str = Form(""),
    transport: str = Form(""), bewertung: str = Form(""), notiz: str = Form(""),
    aus_nichttransport: str = Form(""), angehoerige_aufgebracht: str = Form(""),
    massnahme_noetig: str = Form(""),
):
    v = datenbank.verbindung()
    naechste = (v.execute("SELECT MAX(nr) FROM beschwerde").fetchone()[0] or 0) + 1
    v.execute(
        """INSERT INTO beschwerde (nr, datum, eingang, kategorie, stand,
               mitarbeitende, medizinisch, transport, bewertung, notiz,
               aus_nichttransport, angehoerige_aufgebracht, massnahme_noetig,
               protokoll, dateien)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0,0)""",
        (naechste, datum or None, eingang or None, kategorie or None,
         "eingegangen", mitarbeitende or None, medizinisch or None,
         transport or None, bewertung or None, notiz or None,
         int(bool(aus_nichttransport)), int(bool(angehoerige_aufgebracht)),
         int(bool(massnahme_noetig))))
    v.commit()
    v.close()
    return RedirectResponse("/faelle", status_code=303)


@app.post("/fall/{fid}")
def fall_aendern(
    fid: int,
    datum: str = Form(""), eingang: str = Form(""), kategorie: str = Form(""),
    stand: str = Form("eingegangen"), mitarbeitende: str = Form(""),
    medizinisch: str = Form(""), transport: str = Form(""),
    bewertung: str = Form(""), notiz: str = Form(""),
    aus_nichttransport: str = Form(""), angehoerige_aufgebracht: str = Form(""),
    massnahme_noetig: str = Form(""),
):
    v = datenbank.verbindung()
    v.execute(
        """UPDATE beschwerde SET datum = ?, eingang = ?, kategorie = ?,
               stand = ?, mitarbeitende = ?, medizinisch = ?, transport = ?,
               bewertung = ?, notiz = ?, aus_nichttransport = ?,
               angehoerige_aufgebracht = ?, massnahme_noetig = ?
           WHERE id = ?""",
        (datum or None, eingang or None, kategorie or None,
         stand or "eingegangen", mitarbeitende or None, medizinisch or None,
         transport or None, bewertung or None, notiz or None,
         int(bool(aus_nichttransport)), int(bool(angehoerige_aufgebracht)),
         int(bool(massnahme_noetig)), fid))
    v.commit()
    v.close()
    return RedirectResponse("/faelle", status_code=303)



def frage_kurz(frage):
    """Sprechender Kurzname für ein Balkendiagramm.

    Ein blosses Abschneiden nach 25 Zeichen macht aus drei Fahrzeugfragen
    dreimal «Die Einrichtung des RTW W…». Der unterscheidende Teil steht hier
    aber am Ende, also muss er nach vorne.
    """
    import re
    f = " ".join(frage.split())
    m = re.search(r"RTW (WB3\d).*?, (.+?) zu arbeiten", f)
    if m:
        return f"{m.group(1)}: {m.group(2).lower()}"
    for muster, kurz in (
        (r"12h Dienste", "12-Stunden-Dienste"),
        (r"24h Dienste", "24-Stunden-Dienste"),
        (r"Ferien- und Freiwünsche", "Ferienwünsche"),
        (r"schriftlich mitgeteilt", "Aufgaben schriftlich"),
        (r"gewissenhaft die Ämtli", "Ämtli gewissenhaft"),
        (r"gewissenhaft am Patienten", "Gewissenhaft am Patienten"),
        (r"unterstützen sich gegenseitig", "Gegenseitige Unterstützung"),
        (r"Entwicklungsmöglichkeiten", "Entwicklungsmöglichkeiten"),
        (r"Mitspracherecht", "Mitsprache Arbeitsplatz"),
        (r"Entscheidungen und Veränderungen", "Mitbestimmung"),
        (r"Vorschläge und Anregungen ernst", "Vorschläge ernst genommen"),
        (r"Arbeit von hoher Qualität", "Qualität im Team"),
        (r"mit Freude aus", "Freude an der Arbeit"),
        (r"Fähigkeiten voll einsetzen", "Fähigkeiten einsetzen"),
        (r"Regelung von Zusatzaufgaben", "Zusatzaufgaben geregelt"),
        (r"offen und ehrlich", "Offene Kommunikation"),
        (r"entspannte und offene Atmosphäre", "Atmosphäre im Team"),
        (r"Respekts vor den Leistungen", "Respekt im Team"),
        (r"Respekts zwischen der Leitung", "Respekt Leitung und Team"),
        (r"klare Arbeitsaufträge", "Klare Arbeitsaufträge"),
        (r"genügend Zeit, um mich", "Zeit bei Problemen"),
        (r"Kritik mir gegenüber", "Kritik fair und konstruktiv"),
        (r"kennt meine Fähigkeiten", "Förderung der Fähigkeiten"),
        (r"Lob und Wertschätzung", "Lob und Wertschätzung"),
        (r"als kompetent", "Kompetenz der Leitung"),
        (r"aufgeschlossen für neue Ideen", "Offen für neue Ideen"),
        (r"Informationen über Änderungen", "Information über Neues"),
        (r"verständlich und übersichtlich", "Informationen verständlich"),
        (r"schnell auf nötige betriebliche", "Zugriff auf Informationen"),
    ):
        if re.search(muster, f, re.I):
            return kurz
    return f[:25].rstrip(" ,.") + "…" if len(f) > 26 else f


def daten_laden(name):
    pfad = pfade.daten(f"{name}.json")
    return json.loads(pfad.read_text(encoding="utf-8")) if pfad.exists() else None


# --- Themen der Rueckmeldungen, von Hand gefuehrt --------------------------

def _zum_bereich(nummer, teil, art, meldung, von="", bis="", anker="themen"):
    """Zurueck auf die Bereichsseite, mit Meldung und dem Filter, der
    gerade galt. Sonst springt die Ansicht nach jedem Speichern auf alle
    Zeitraeume zurueck."""
    ziel = f"/bereich/{quote(nummer)}?art={art}&meldung={quote(meldung)}"
    if teil:
        ziel += f"&teil={quote(teil)}"
    if von:
        ziel += f"&von={quote(von)}"
    if bis:
        ziel += f"&bis={quote(bis)}"
    return RedirectResponse(ziel + "#" + anker, status_code=303)


def _zahl(wert):
    try:
        zahl = int(str(wert).strip())
    except ValueError:
        raise ValueError("Die Anzahl muss eine ganze Zahl sein.") from None
    if zahl < 0:
        raise ValueError("Die Anzahl kann nicht negativ sein.")
    return zahl


def _zeitraum(von, bis):
    """Zwei Datumsangaben, beide freiwillig. Leer heisst offen."""
    v = _iso_datum(von).isoformat() if (von or "").strip() else None
    b = _iso_datum(bis).isoformat() if (bis or "").strip() else None
    if v and b and b < v:
        raise ValueError("«bis» liegt vor «von».")
    return v, b


def _ueberschneidet(zeile_von, zeile_bis, von, bis):
    """Eine Zeile zaehlt zum Filter, wenn sich die Zeitraeume beruehren.
    Ein offenes Ende, auf welcher Seite auch immer, ist unbegrenzt."""
    if von and zeile_bis and zeile_bis < von:
        return False
    if bis and zeile_von and zeile_von > bis:
        return False
    return True


def _filter_lesen(von, bis):
    """Der Filter aus der Adresse; was nicht lesbar ist, gilt nicht."""
    try:
        return _zeitraum(von, bis)
    except ValueError:
        return None, None


def themen_lesen(v, nummer, von=None, bis=None):
    """Die Eintraege eines Bereichs im Filter, sortiert nach Anzahl, dazu
    die Summe je Thema. Der Anteil rechnet gegen die Summe aller Themen im
    Filter; eine eigene Grundgesamtheit gibt es seit 15.09.2026 nicht mehr,
    Michael: «das zusätzliche feld rückmeldungen macht keinen sinn»."""
    zeilen = [t for t in v.execute(
        "SELECT * FROM thema WHERE kriterium = ? ORDER BY anzahl DESC, name, von, id",
        (nummer,)) if _ueberschneidet(t["von"], t["bis"], von, bis)]
    summen = {}
    for t in zeilen:
        summen[t["name"]] = summen.get(t["name"], 0) + t["anzahl"]
    gesamt = sum(summen.values()) or None
    zusammen = sorted(
        ({"name": n, "anzahl": a,
          "anteil": round(a / gesamt * 100, 1) if gesamt else None}
         for n, a in summen.items()),
        key=lambda x: (-x["anzahl"], x["name"]))
    return zeilen, zusammen, gesamt


@app.post("/bereich/{nummer}/diagramm")
def diagrammart_setzen(nummer: str, art: str = Form("balken"),
                       teil: str = Form(""), f_von: str = Form(""),
                       f_bis: str = Form("")):
    """Balken oder Kuchen, nur beim selbstgewählten Prozesskriterium."""
    b = BEREICHE.get(nummer)
    if not b or not b.get("diagrammwahl") or art not in DIAGRAMMARTEN:
        return RedirectResponse("/", status_code=303)
    v = datenbank.verbindung()
    datenbank.einstellung_setzen(v, f"diagramm_{nummer}", art)
    v.close()
    return _zum_bereich(nummer, teil, "gut",
                        f"Die Themen werden als {DIAGRAMMARTEN[art]} gezeigt.",
                        f_von, f_bis, "daten")


@app.post("/bereich/{nummer}/thema")
def thema_neu(nummer: str, name: str = Form(""), anzahl: str = Form("0"),
              von: str = Form(""), bis: str = Form(""), teil: str = Form(""),
              f_von: str = Form(""), f_bis: str = Form("")):
    name = " ".join(name.split())
    if nummer not in BEREICHE:
        return RedirectResponse("/", status_code=303)
    try:
        if not name:
            raise ValueError("Das Thema braucht einen Namen.")
        zahl = _zahl(anzahl)
        v_von, v_bis = _zeitraum(von, bis)
    except ValueError as e:
        return _zum_bereich(nummer, teil, "fehler", str(e), f_von, f_bis)
    v = datenbank.verbindung()
    v.execute("INSERT INTO thema (kriterium, name, anzahl, von, bis) "
              "VALUES (?,?,?,?,?)", (nummer, name, zahl, v_von, v_bis))
    v.commit()
    v.close()
    return _zum_bereich(nummer, teil, "gut", f"«{name}» mit {zahl} eingetragen.",
                        f_von, f_bis)


@app.post("/thema/{tid}")
def thema_aendern(tid: int, name: str = Form(""), anzahl: str = Form("0"),
                  von: str = Form(""), bis: str = Form(""), teil: str = Form(""),
                  f_von: str = Form(""), f_bis: str = Form("")):
    v = datenbank.verbindung()
    t = v.execute("SELECT * FROM thema WHERE id = ?", (tid,)).fetchone()
    if not t:
        v.close()
        return RedirectResponse("/", status_code=303)
    name = " ".join(name.split())
    try:
        if not name:
            raise ValueError("Das Thema braucht einen Namen.")
        zahl = _zahl(anzahl)
        v_von, v_bis = _zeitraum(von, bis)
    except ValueError as e:
        v.close()
        return _zum_bereich(t["kriterium"], teil, "fehler", str(e), f_von, f_bis)
    v.execute("UPDATE thema SET name = ?, anzahl = ?, von = ?, bis = ? "
              "WHERE id = ?", (name, zahl, v_von, v_bis, tid))
    v.commit()
    v.close()
    return _zum_bereich(t["kriterium"], teil, "gut", f"«{name}»: {zahl}.",
                        f_von, f_bis)


@app.post("/thema/{tid}/loeschen")
def thema_loeschen(tid: int, teil: str = Form(""), f_von: str = Form(""),
                   f_bis: str = Form("")):
    v = datenbank.verbindung()
    t = v.execute("SELECT * FROM thema WHERE id = ?", (tid,)).fetchone()
    if not t:
        v.close()
        return RedirectResponse("/", status_code=303)
    v.execute("DELETE FROM thema WHERE id = ?", (tid,))
    v.commit()
    v.close()
    return _zum_bereich(t["kriterium"], teil, "gut", f"«{t['name']}» ist gelöscht.",
                        f_von, f_bis)


@app.post("/bereich/{nummer}/export")
async def bereich_export(request: Request, nummer: str,
                         datei: UploadFile = File(...), teil: str = Form(""),
                         f_von: str = Form(""), f_bis: str = Form("")):
    """Der Export der Quelle direkt auf der Bereichsseite. Die Datei geht
    denselben Weg wie auf der Listenseite und liegt danach auch dort; dazu
    werden Themen und Monatsreihe neu gerechnet."""
    b = BEREICHE.get(nummer)
    if not b or not b.get("upload"):
        return RedirectResponse("/", status_code=303)
    try:
        rohdaten = b""
        while True:
            stueck = await datei.read(256 * 1024)
            if not stueck:
                break
            rohdaten += stueck
            if len(rohdaten) > listen.GRENZE_BYTES:
                raise listen.Abgelehnt(
                    f"Die Datei ist grösser als "
                    f"{listen.GRENZE_BYTES // 1024 // 1024} MB.")
        pfad = listen.speichern(b["upload"], datei.filename, rohdaten)
    except listen.Abgelehnt as e:
        return _zum_bereich(nummer, teil, "fehler", str(e), f_von, f_bis, "daten")
    finally:
        await datei.close()

    name = pfad.name.split("__", 1)[-1]
    if b["upload"] == "emris":
        bericht = emris.aktualisieren()
        if not bericht["meldungen"]:
            return _zum_bereich(
                nummer, teil, "warnung",
                f"«{name}» ist abgelegt, aber es liess sich keine Meldung mit "
                "Datum und Fehlerkategorie lesen. Erwartet wird das Blatt "
                "«Export_Feedback» aus EMRIS.", f_von, f_bis, "daten")
        jahre = ", ".join(bericht["jahre"])
        return _zum_bereich(
            nummer, teil, "gut",
            f"«{name}» eingelesen. Über alle Exporte: {bericht['meldungen']} "
            f"Meldungen {jahre} in {bericht['kategorien']} Kategorien, letzte "
            f"Meldung {schweizer_datum(bericht['letzte'])}.", f_von, f_bis, "daten")

    # Andere Quellen: ablegen und hineinschauen, wie auf der Listenseite.
    befund = listen.pruefen(pfad)
    if befund["fehler"]:
        return _zum_bereich(
            nummer, teil, "warnung",
            f"«{name}» ist abgelegt, liess sich aber nicht lesen: "
            f"{befund['fehler']}", f_von, f_bis, "daten")
    zeilen = sum(bl["zeilen"] for bl in befund["blaetter"])
    meldung = f"«{name}» abgelegt, {zeilen} Zeilen."
    art = "gut"
    if befund["direkt"]:
        meldung += (" Achtung: Spalten mit Personendaten gefunden ("
                    + ", ".join(befund["direkt"][:4]) + "). Bei Microsoft "
                    "Forms entscheidet die Einstellung «Namen erfassen».")
        art = "warnung"
    return _zum_bereich(nummer, teil, art, meldung, f_von, f_bis, "daten")


@app.post("/massnahme/{mid}/bearbeiten")
def massnahme_bearbeiten(
    mid: int,
    beschreibung: str = Form(...),
    ausloeser: str = Form(""),
    verantwortlich: str = Form(""),
    frist: str = Form(""),
    gemessen_am: str = Form(""),
    messwert: str = Form(""),
    definition: str = Form(""),
    analyse: str = Form(""),
    zurueck: str = Form(""),
):
    """Jeder Punkt eines laufenden Kreislaufs laesst sich aendern. Michael
    am 15.09.2026: «die laufenden kreisläufe muss ich jeden punkt
    bearbeiten können.» Die Nachmessung bleibt beim Schliessen."""
    v = datenbank.verbindung()
    v.execute(
        """UPDATE massnahme SET beschreibung = ?, ausloeser = ?,
               verantwortlich = ?, frist = ?, gemessen_am = ?, messwert = ?,
               definition = ?, analyse = ?
           WHERE id = ?""",
        (beschreibung.strip(), ausloeser or None, verantwortlich or None,
         frist or None, gemessen_am or None, messwert.strip() or None,
         definition.strip() or None, analyse.strip() or None, mid))
    v.commit()
    v.close()
    return RedirectResponse(zurueck if zurueck.startswith("/") else "/massnahmen",
                            status_code=303)


@app.get("/bereich/{nummer}")
def bereich(request: Request, nummer: str, teil: str = "", meldung: str = "",
            art: str = "", von: str = "", bis: str = ""):
    """Ein Monitoringbereich nach 8.1 mit seinen Daten und seiner Erfassung."""
    if nummer not in BEREICHE:
        return RedirectResponse("/")
    v = datenbank.verbindung()
    b = BEREICHE[nummer]
    k = v.execute("SELECT * FROM kriterium WHERE nummer = ?", (nummer,)).fetchone()
    gewaehlt = teil or (b.get("reiter", [("", "")])[0][0] if b.get("reiter") else "")
    if b.get("reiter"):
        # Jeder Strang hat seinen eigenen Kreislauf; Massnahmen ohne Zuordnung
        # gehören zum ersten Reiter.
        massnahmen = v.execute(
            """SELECT * FROM massnahme WHERE kriterium = ?
               AND (strang = ? OR (strang IS NULL AND ? = ?))
               ORDER BY gemessen_am DESC, id DESC""",
            (nummer, gewaehlt, gewaehlt, b["reiter"][0][0])).fetchall()
    else:
        massnahmen = v.execute(
            "SELECT * FROM massnahme WHERE kriterium = ? ORDER BY id DESC",
            (nummer,)).fetchall()

    # Welche Kreisläufe bereits fortgeführt wurden, damit nicht zweimal
    # dieselbe Runde angehängt wird.
    fortgefuehrt = {r["vorgaenger"] for r in v.execute(
        "SELECT vorgaenger FROM massnahme WHERE vorgaenger IS NOT NULL")}

    # Der Zeitraumfilter gilt für die Zeichnungen und die Themen. Michael am
    # 15.09.2026: «der filter soll über die daten-grafik».
    f_von, f_bis = _filter_lesen(von, bis)

    def im_filter(monat):
        """Ein Monat oder Jahr (als Textanfang eines ISO-Datums) im Filter."""
        if f_von and monat < f_von[:len(monat)]:
            return False
        if f_bis and monat > f_bis[:len(monat)]:
            return False
        return True

    stand = next(s for s in monitoring_stand(v) if s["nummer"] == nummer)

    # Jeder offene Kreislauf bekommt seine eigene Kette, nicht nur der
    # erste. Sonst zählt die Seitenleiste drei und die Seite zeigt einen.
    offene = [m for m in massnahmen if not m["nachgemessen_am"]]
    ketten = [{"m": m, "schritte": schritte_von(m, zyklus_von(v))}
              for m in offene]
    if not ketten:
        # Kein offener: die leere Kette zeigt, womit ein neuer beginnt.
        ketten = [{"m": None, "schritte": schritte_von(None, zyklus_von(v))}]
    if b.get("reiter"):
        stand = dict(stand)
        stand["geschlossen"] = bool(
            not offene and any(m["nachgemessen_am"] for m in massnahmen))

    # Wie viele offene Kreisläufe je Reiter, damit sichtbar ist, wo die
    # Zahl aus der Seitenleiste herkommt.
    reiter_offen = {}
    if b.get("reiter"):
        erster = b["reiter"][0][0]
        for m in v.execute(
                """SELECT strang, COUNT(*) AS zahl FROM massnahme
                   WHERE kriterium = ? AND (nachgemessen_am IS NULL
                         OR nachgemessen_am = '') GROUP BY strang""",
                (nummer,)):
            schluessel = m["strang"] or erster
            reiter_offen[schluessel] = reiter_offen.get(schluessel, 0) + m["zahl"]
    kreislauf = None
    erste = next((m for m in massnahmen if m["gemessen_am"]), None)
    if erste:
        kreislauf = diagramme.vorher_nachher(
            erste["messwert"] or "erfasst",
            erste["nachmessung_ergebnis"] if erste["nachgemessen_am"] else None,
            titel=f"Kreislauf {nummer}")

    # Die Daten und Zeichnungen, die zu diesem Bereich gehören.
    daten, zeichnungen, ma = None, {}, None
    if b["quelle"] == "naca":
        daten = daten_laden("naca")
        if daten:
            r = daten["rueckmeldungen"]
            jahre = [j for j in sorted(r["je_jahr"]) if im_filter(j)]
            if jahre:
                zeichnungen["verlauf"] = diagramme.linie_quote(
                    [{"werte": [round(r["je_jahr"][j]["mit_inhalt"]
                                      / r["je_jahr"][j]["protokolle"] * 100, 1)
                                for j in jahre]}], jahre, y_von=0, y_bis=100,
                    titel="Anteil der Protokolle mit fachlicher Rückmeldung")
            kat = [(x, n) for x, n in r["kategorien_neu"].items()
                   if x != "ohne Zuordnung"]
            hoch = max((n for _, n in kat), default=1)
            zeichnungen["themen"] = diagramme.balken_quote(
                [{"name": x, "wert": n / hoch * 100, "label": f"{n}×",
                  "klasse": "r2" if i == 0 else "r1"}
                 for i, (x, n) in enumerate(kat)],
                titel="Themen der Rückmeldungen seit 2025")
    elif b["quelle"] == "emris":
        daten = daten_laden("emris")
        if daten:
            monate = [m for m in daten["monate"] if im_filter(m["monat"])]
            # Markiert wird die Massnahme, nicht eine Vermutung: ab Anfang
            # 2025 wurde in den Teamsitzungen auf EMRIS hingewiesen und es
            # wurden Plakate aufgehängt.
            marke = next((i for i, m in enumerate(monate)
                          if m["monat"] == "2025-03"), None)
            if monate:
                zeichnungen["verlauf"] = diagramme.saeulen_zeit(
                    [m["anzahl"] for m in monate], [m["monat"] for m in monate],
                    marke=marke, marke_text="Teamsitzungen und Plakate",
                    titel="EMRIS-Meldungen je Monat")
    elif b["quelle"] == "umfragen":
        # Nur den gewählten Reiter laden und zeichnen.
        if teil == "mitarbeitende":
            ma = daten_laden("mitarbeitende")
        else:
            daten = daten_laden("umfragen")
        if ma:
            zeichnungen["ma_bloecke"] = diagramme.balken_quote(
                [{"name": x["name"], "wert": x["mittel"] * 10,
                  "label": f'{x["mittel"]:.2f}',
                  "klasse": "unter" if x["mittel"] < 8 else "r1"}
                 for x in ma["bloecke"]],
                richtwert=80, richtwert_text="Schwelle 8,0",
                titel="Mitarbeitendenbefragung nach Themenblock")
            # Der Fahrzeugvergleich wird gerechnet, nicht behauptet.
            import re as _re
            paare = {}
            for f in ma["fragen"]:
                m = _re.search(r"RTW (WB3\d).*?, (.+?) zu arbeiten", f["frage"])
                if m:
                    paare.setdefault(m.group(2).strip(), {})[m.group(1)] = f["mittel"]
            ma["fahrzeuge"] = [
                {"aspekt": a, "wb31": v.get("WB31"), "wb32": v.get("WB32"),
                 "abstand": round(v["WB31"] - v["WB32"], 2)}
                for a, v in paare.items() if "WB31" in v and "WB32" in v]

            schwach = ma["fragen"][:8]
            zeichnungen["ma_fragen"] = diagramme.balken_quote(
                [{"name": frage_kurz(f["frage"]),
                  "wert": f["mittel"] * 10, "label": f'{f["mittel"]:.2f}',
                  "n": f["n"], "klasse": "unter" if f["mittel"] < 7 else "r1"}
                 for f in schwach],
                richtwert=70, richtwert_text="Schwelle 7,0",
                titel="Die acht schwächsten Fragen")
        if daten and teil != "mitarbeitende":
            zeichnungen["vergleich"] = diagramme.vergleich_punkte(
                [{"name": f["frage"], "vorher": f["vorher"], "nachher": f["nachher"]}
                 for f in daten["fragen"]],
                von=1, bis=5,
                beschriftung_vorher=daten["runde1"]["jahr"],
                beschriftung_nachher=daten["runde2"]["jahr"],
                titel="Partnerbefragung, beide Runden im Vergleich")
    elif b["quelle"] == "beschwerden":
        alle = v.execute("SELECT * FROM beschwerde ORDER BY datum DESC").fetchall()
        je_kat = {}
        for f in alle:
            x = f["kategorie"] or "ohne Kategorie"
            je_kat[x] = je_kat.get(x, 0) + 1
        sortiert = sorted(je_kat.items(), key=lambda y: (-y[1], y[0]))
        hoch = max(je_kat.values(), default=1)
        zeichnungen["themen"] = diagramme.balken_quote(
            [{"name": x if len(x) < 34 else x[:32] + "…", "wert": n / hoch * 100,
              "label": f"{n} Fälle" if n != 1 else "1 Fall",
              "klasse": "rest" if x == "Sonstiges" else "r1"}
             for x, n in sortiert], titel="Fälle je Kategorie")
        daten = {"faelle": len(alle),
                 "mit_protokoll": sum(1 for f in alle if f["protokoll"])}

    # Der Ring je geschlossenem Kreislauf. Er steht vor jedem
    # abgeschlossenen Eintrag, damit das Erledigte nicht nur eingeklappt in
    # einer Zeile verschwindet. Bei DMAIC kann er eine Lücke zeigen: ein
    # alter Kreislauf ohne eingetragene Ursache ist nachgemessen, aber
    # nicht vollständig beschrieben.
    zyklus = zyklus_von(v)
    ringe_zu = {m["id"]: ring_von(m, zyklus)
                for m in massnahmen if m["nachgemessen_am"]}

    # Von Hand erfasste Themen. Wo es welche gibt, ersetzen sie die aus
    # den Listen gerechnete Themenzeichnung: der Betrieb hat entschieden,
    # was zaehlt, und die Zahl ist die seine.
    diagrammart = diagrammart_von(v, nummer)
    themen, zusammen, gesamt = ([], [], None)
    if b.get("themen"):
        themen, zusammen, gesamt = themen_lesen(v, nummer, f_von, f_bis)
    if zusammen:
        hoch = max(z["anzahl"] for z in zusammen) or 1
        if f_von or f_bis:
            spanne = (f"{schweizer_datum(f_von) if f_von else 'Anfang'} bis "
                      f"{schweizer_datum(f_bis) if f_bis else 'heute'}")
        else:
            spanne = "alle Zeiträume"
        # Fuer die Zeichnung ohne Klammerzusatz: «2.3 Entscheidungshilfen
        # (spezifische Ausrüstungen, …)» wird zu «2.3 Entscheidungshilfen».
        # Der volle Name steht in der Tabelle und im Tooltip.
        kurz = [re.sub(r"\s*\([^)]*\)", "", z["name"]).strip() or z["name"]
                for z in zusammen]
        if b.get("diagrammwahl") and diagrammart == "kuchen":
            zeichnungen["themen"] = diagramme.kuchen(
                [{"name": n, "wert": z["anzahl"], "label": f'{z["anzahl"]}×'}
                 for n, z in zip(kurz, zusammen)],
                titel=f"Themen der Rückmeldungen, {spanne}")
        else:
            zeichnungen["themen"] = diagramme.balken_quote(
                [{"name": n, "wert": z["anzahl"] / hoch * 100,
                  "label": f'{z["anzahl"]}×',
                  "klasse": "r2" if i == 0 else "r1"}
                 for i, (n, z) in enumerate(zip(kurz, zusammen))],
                titel=f"Themen der Rückmeldungen, {spanne}",
                beschriftung_breite=300)
    antwort = vorlagen.TemplateResponse(request, "bereich.html", {
        "ringe_zu": ringe_zu,
        "ketten": ketten,
        "reiter_offen": reiter_offen,
        "zyklus": ZYKLEN[zyklus],
        "dmaic": zyklus == "dmaic",
        "themen": themen,
        "zusammen": zusammen,
        "diagrammart": diagrammart,
        "diagrammarten": DIAGRAMMARTEN,
        "gesamt": gesamt,
        "f_von": f_von or "", "f_bis": f_bis or "",
        "meldung": meldung, "art": art,
        "nummer": nummer, "b": b, "k": k, "stand": stand,
        "massnahmen": massnahmen, "kreislauf": kreislauf,
        "fortgefuehrt": fortgefuehrt,
        "daten": daten, "zeichnungen": zeichnungen,
        "ma": ma,
        "teil": teil or (b.get("reiter", [("", "")])[0][0] if b.get("reiter") else ""),
        "fuehrung": ANLEITUNG.get(nummer),
        "bereiche": BEREICHE,
        "betrieb": einstellungen(v).get("betrieb", ""),
        "titel": f"{nummer} {b['kurz']}",
        "seite": f"bereich-{nummer}",
    })
    v.close()
    return antwort


@app.get("/landkarte")
def prozesslandkarte(request: Request):
    """Alle Prozesse des Betriebs, an ihre Kriterien gebunden.

    Die Seite erfindet nichts: Jeder Teilprozess zeigt die Kriterien, aus
    denen er stammt, und erbt von ihnen seinen Stand. Wo kein Kriterium
    dahintersteht, nennt er stattdessen seine Quelle.
    """
    v = datenbank.verbindung()
    kriterien = v.execute(ABFRAGE_KRITERIEN).fetchall()
    gliederung = gliederungszeilen(kriterien)
    stand_je_kriterium = {k["nummer"]: landkarte_stand(k, gliederung)
                          for k in kriterien}
    titel_je_kriterium = {k["nummer"]: k["titel"] for k in kriterien}
    # Die Anmerkungen der Prüfer und die eigenen Kommentare, damit ein
    # bemängeltes Feld auf der Landkarte sagt, was beanstandet wurde.
    maengel = maengel_laden(v)

    gesamt = dict.fromkeys(STAND_RANG, 0)
    baender = []
    for band in landkarte.BAENDER:
        band_zaehler = dict.fromkeys(STAND_RANG, 0)
        prozesse = []
        for p in band["prozesse"]:
            p_zaehler = dict.fromkeys(STAND_RANG, 0)
            schritte = []
            for s in p["schritte"]:
                stand = schritt_stand(s, stand_je_kriterium)
                gesamt[stand] += 1
                band_zaehler[stand] += 1
                p_zaehler[stand] += 1
                ziel = s.get("ziel")
                schritte.append({
                    "name": s["name"],
                    "quelle": s.get("quelle"),
                    "stand": stand,
                    "stand_text": STAND_TEXT[stand],
                    "stand_farbe": STAND_FARBE.get(stand, "leise"),
                    "ziel": ziel,
                    "ziel_name": ZIEL_NAMEN.get(ziel, "Bereich") if ziel else "",
                    "dauernd": bool(s.get("dauernd")),
                    "zusammen": bool(s.get("fuehrt_zusammen")),
                    "kriterien": [{"nummer": n,
                                   "titel": titel_je_kriterium.get(n, "")}
                                  for n in s["kriterien"]],
                    # Nur was beanstandet wurde; alles andere braucht hier
                    # keinen Platz.
                    "maengel": [maengel[n] for n in s["kriterien"]
                                if n in maengel and (maengel[n]["bemaengelt"]
                                                     or maengel[n]["auflagen"])],
                })
            # Dauerbedingungen stehen neben dem Ablauf, nicht in ihm. Wer sie
            # in die Kette zeichnet, behauptet eine Reihenfolge, die es nicht
            # gibt: «Zwei Kommunikationsmittel halten» kommt nicht nach dem
            # Alarm, es gilt die ganze Zeit.
            prozesse.append({"name": p["name"], "zweck": p["zweck"],
                             "ablauf": p.get("ablauf", "buendel"),
                             "schritte": schritte, "zahl": len(schritte),
                             "fluss": [x for x in schritte if not x["dauernd"]],
                             "dauernd": [x for x in schritte if x["dauernd"]],
                             "hinweis": dringlichster(p_zaehler)})
        baender.append({"schluessel": band["schluessel"], "name": band["name"],
                        "rolle": band["rolle"], "prozesse": prozesse,
                        "zahl": sum(p["zahl"] for p in prozesse),
                        "hinweis": dringlichster(band_zaehler)})

    lage = diagramme.lage_balken(
        [(STAND_TEXT[s], gesamt[s], STAND_LAGE[s]) for s in STAND_RANG])

    vorhanden = {z["code"] for z in landkarte.ZEITPUNKTE if z["spalte"]}
    zeitpunkt_namen = {z["code"]: z["voll"] for z in landkarte.ZEITPUNKTE}
    zahl = {
        "baender": len(baender),
        "prozesse": sum(len(b["prozesse"]) for b in baender),
        "schritte": sum(b["zahl"] for b in baender),
        "kriterien": len(kriterien),
        # Wenn die Landkarte ein Kriterium auslässt, soll das auf der Seite
        # stehen und nicht unbemerkt bleiben.
        "gedeckt": len(landkarte.alle_kriterien() & set(stand_je_kriterium)),
        "zeitpunkte": len(landkarte.ZEITPUNKTE),
        "zeitpunkte_da": len(vorhanden),
        "intervalle": len(landkarte.INTERVALLE),
        "intervalle_da": sum(1 for i in landkarte.INTERVALLE
                             if diagramme._berechenbar(i, vorhanden)),
    }

    legende = [{"klasse": klasse,
                "text": ", ".join(STAND_TEXT[s] for s in staende),
                "zahl": sum(gesamt[s] for s in staende)}
               for klasse, staende in LEGENDE_GRUPPEN]

    antwort = vorlagen.TemplateResponse(request, "landkarte.html", {
        "baender": baender,
        "lagebalken": lage,
        "legende": legende,
        "kette": diagramme.einsatzkette(landkarte.ZEITPUNKTE,
                                        landkarte.INTERVALLE),
        "zeitpunkte": landkarte.ZEITPUNKTE,
        "intervalle": [dict(i, berechenbar=diagramme._berechenbar(i, vorhanden),
                            von_name=zeitpunkt_namen[i["von"]],
                            bis_name=zeitpunkt_namen[i["bis"]])
                       for i in landkarte.INTERVALLE],
        "gesamt": gesamt,
        "zahl": zahl,
        "betrieb": einstellungen(v).get("betrieb", ""),
        "titel": "Prozesslandkarte",
        "seite": "landkarte",
    })
    v.close()
    return antwort


@app.get("/listen")
def listen_seite(request: Request, meldung: str = "", art: str = "",
                 quelle: str = ""):
    """Die Listen der drei Quellen: hochladen, sehen was drin ist, loeschen."""
    v = datenbank.verbindung()
    gruppen = [dict(e, schluessel=s, dateien=listen.bestand(s))
               for s, e in listen.QUELLEN.items()]
    antwort = vorlagen.TemplateResponse(request, "listen.html", {
        "gruppen": gruppen,
        "meldung": meldung,
        "art": art,
        "quelle": quelle,
        "grenze_mb": listen.GRENZE_BYTES // 1024 // 1024,
        "betrieb": einstellungen(v).get("betrieb", ""),
        "titel": "Listen",
        "seite": "listen",
    })
    v.close()
    return antwort


def _woher(quelle, zurueck, art, meldung):
    """Zurück dorthin, wo hochgeladen wurde. Seit «Listen» nicht mehr in
    der Seitenleiste steht, geschieht das meist von einer Fachseite aus."""
    if zurueck.startswith("/"):
        trenner = "&" if "?" in zurueck else "?"
        return RedirectResponse(
            f"{zurueck}{trenner}art={art}&meldung={quote(meldung)}",
            status_code=303)
    return _zurueck(quelle, art, meldung)


def _zurueck(quelle, art, meldung):
    ziel = (f"/listen?quelle={quote(quelle)}&art={art}"
            f"&meldung={quote(meldung)}#q-{quote(quelle)}")
    return RedirectResponse(ziel, status_code=303)


@app.post("/listen/{quelle}")
async def liste_hochladen(quelle: str, datei: UploadFile = File(...),
                          zurueck: str = Form("")):
    try:
        # Stueckweise lesen und unterwegs abbrechen, statt erst alles
        # entgegenzunehmen und dann festzustellen, dass es zu gross war.
        rohdaten = b""
        while True:
            stueck = await datei.read(256 * 1024)
            if not stueck:
                break
            rohdaten += stueck
            if len(rohdaten) > listen.GRENZE_BYTES:
                raise listen.Abgelehnt(
                    f"Die Datei ist groesser als "
                    f"{listen.GRENZE_BYTES // 1024 // 1024} MB.")
        pfad = listen.speichern(quelle, datei.filename, rohdaten)
    except listen.Abgelehnt as e:
        return _woher(quelle, zurueck, "fehler", str(e))
    finally:
        await datei.close()

    befund = listen.pruefen(pfad)
    if befund["fehler"]:
        meldung = (f"«{befund['angezeigt']}» ist abgelegt, liess sich aber "
                   f"nicht lesen: {befund['fehler']}")
        return _woher(quelle, zurueck, "warnung", meldung)

    zeilen = sum(b["zeilen"] for b in befund["blaetter"])
    meldung = f"«{befund['angezeigt']}» eingelesen, {zeilen} Zeilen."
    art = "gut"
    if befund["direkt"]:
        meldung += (" Achtung: Spalten mit Personendaten gefunden ("
                    + ", ".join(befund["direkt"][:4]) + ").")
        art = "warnung"
    return _woher(quelle, zurueck, art, meldung)


@app.post("/listen/{quelle}/loeschen")
def liste_loeschen(quelle: str, datei: str = Form(...)):
    try:
        listen.loeschen(quelle, datei)
    except listen.Abgelehnt as e:
        return _zurueck(quelle, "fehler", str(e))
    return _zurueck(quelle, "gut", "Die Liste ist geloescht.")


@app.get("/gesundheit")
def gesundheit():
    v = datenbank.verbindung()
    n = v.execute("SELECT COUNT(*) FROM kriterium").fetchone()[0]
    v.close()
    return {"status": "ok", "kriterien": n}


# Das Schloss kommt zuletzt: erst stehen alle Wege, dann die Tuer davor.
anmeldung.einrichten(app, vorlagen)


# Laeuft die Anwendung nicht auf der Wurzel einer Adresse, sondern unter
# einem Pfad, legt sich eine Schicht davor, die den Pfad abschneidet und in
# den Antworten wieder einsetzt. Ohne IVR_BASIS geschieht nichts.
app = praefix.anlegen(app, os.environ.get("IVR_BASIS"),
                      os.environ.get("IVR_BASIS_FUNKTION"))
