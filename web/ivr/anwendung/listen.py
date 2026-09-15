"""Hochgeladene Listen: entgegennehmen, ablegen, hineinschauen.

Drei Quellen liefern regelmaessig Excel- oder CSV-Listen, und bisher lagen
sie irgendwo im Dateisystem: EMRIS, SWISSRECA und die Befragungen. Hier
kommen sie herein, bekommen ein Datum und werden gelesen, damit nach dem
Hochladen etwas anderes dasteht als «hochgeladen».

Zwei Grundsaetze aus PRODUCT.md gelten hier besonders:

- Das Werkzeug fuehrt keine Befragung durch und ist kein Meldekanal. Es
  nimmt die fertige Liste entgegen, sonst nichts.
- Es verarbeitet keine Personendaten aus dem Gesundheitsbereich. Deshalb
  liest es nach dem Hochladen die Spaltennamen und sagt, wenn welche darauf
  hindeuten. Bei Microsoft Forms entscheidet eine einzige Einstellung
  («Namen erfassen»), ob in der Liste Namen stehen; das sieht man erst an
  ihren Spalten.
"""

import csv
import io
import re
import unicodedata
from datetime import datetime
from pathlib import Path
import pfade

ORDNER = pfade.daten("listen")

# 15 MB. Die groesste vorliegende Liste hat 149 KB; wer hier anstoesst, laedt
# etwas anderes hoch als eine Liste.
GRENZE_BYTES = 15 * 1024 * 1024

ERLAUBT = {".xlsx", ".xlsm", ".csv"}

QUELLEN = {
    "emris": {
        "name": "EMRIS",
        "lang": "Ereignismonitoring, Kriterium 8.1.2",
        "hinweis": "Der Export aus EMRIS, ein Blatt «Export_Feedback» je "
                   "Zeitraum. Das Meldewesen selbst bleibt in EMRIS; hier "
                   "liegt nur die Auswertungsgrundlage.",
    },
    "swissreca": {
        "name": "SWISSRECA",
        "lang": "Reanimationsregister, Kriterium 8.5",
        "hinweis": "Der Datenexport aus SWISSRECA als CSV. Der Jahresbericht "
                   "kommt getrennt als PDF und gehoert nicht hierher.",
    },
    "befragungen": {
        "name": "Befragungen",
        "lang": "Zufriedenheitsmonitoring, Kriterium 8.1.4",
        "hinweis": "Die Ergebnisliste aus Microsoft Forms, je Runde eine "
                   "Datei. Partnerorganisationen und Mitarbeitende werden "
                   "getrennt gemessen, also getrennt hochladen.",
    },
}

# Spalten, die eine Person direkt benennen. Bewusst eng gefasst: ein Alarm,
# der bei jeder Datei angeht, ist kein Alarm.
DIREKT = [
    r"\bvorname", r"\bnachname", r"familienname", r"benutzername", r"username",
    r"\buser\b", r"\blogin\b", r"\bmail", r"e-?mail", r"\bhandy\b",
    # «Telefonreanimation» ist im Reanimationsregister eine Wiederbelebung
    # unter telefonischer Anleitung des Notrufs, keine Rufnummer.
    r"telefon(?![- ]?reanimation)",
    r"\bmobil\b", r"\badresse\b", r"\bstrasse\b", r"wohnort", r"geburt",
    r"ahv[- ]?nummer", r"\bsvnr\b", r"personalnummer", r"mitarbeiternummer",
    r"unterschrift", r"^name$", r"\bname\b(?!.*(datei|blatt|feld|spalte))",
]

# Spalten, die allein harmlos sind und zusammen mit Ort und Zeit trotzdem
# auf eine Person zeigen koennen.
MITTELBAR = [
    r"altersgruppe", r"\balter\b", r"diagnose", r"einsatzort", r"\bplz\b",
    r"geschlecht", r"\bort\b",
]


def _falten(text):
    """Kleinschreibung ohne Umlaute, damit «Straße» und «Strasse» gleich sind."""
    t = unicodedata.normalize("NFKD", str(text or "")).lower()
    t = t.replace("ß", "ss")
    return "".join(z for z in t if not unicodedata.combining(z))


def _treffer(kopf, muster):
    gefunden = []
    for spalte in kopf:
        gefaltet = _falten(spalte)
        if any(re.search(m, gefaltet) for m in muster):
            gefunden.append(str(spalte))
    return gefunden


def sicherer_name(name):
    """Aus dem Namen des Browsers einen Dateinamen machen, dem man trauen kann.

    Der Pfadanteil faellt weg, nicht nur «..»: es zaehlt allein der letzte
    Abschnitt, und der wird auf harmlose Zeichen reduziert.
    """
    roh = str(name or "").replace("\\", "/").split("/")[-1]
    roh = unicodedata.normalize("NFKC", roh)
    endung = Path(roh).suffix.lower()
    stamm = Path(roh).stem
    stamm = re.sub(r"[^\w ()+-]", "_", stamm, flags=re.UNICODE).strip(" ._")
    stamm = re.sub(r"[_ ]{2,}", " ", stamm)[:80] or "liste"
    return stamm + endung


class Abgelehnt(Exception):
    """Die Datei kommt nicht herein, und der Text sagt warum."""


def speichern(quelle, dateiname, rohdaten):
    if quelle not in QUELLEN:
        raise Abgelehnt("Unbekannte Quelle.")

    name = sicherer_name(dateiname)
    endung = Path(name).suffix.lower()
    if endung == ".xls":
        raise Abgelehnt(
            "«.xls» ist das alte Excel-Format und laesst sich nicht lesen. "
            "In Excel einmal als «.xlsx» speichern und erneut hochladen.")
    if endung not in ERLAUBT:
        raise Abgelehnt(
            f"«{endung or 'ohne Endung'}» wird nicht angenommen. Erlaubt sind "
            "Excel (.xlsx, .xlsm) und CSV.")
    if not rohdaten:
        raise Abgelehnt("Die Datei ist leer.")
    if len(rohdaten) > GRENZE_BYTES:
        raise Abgelehnt(
            f"Die Datei ist {len(rohdaten) / 1024 / 1024:.1f} MB gross, "
            f"erlaubt sind {GRENZE_BYTES // 1024 // 1024} MB.")

    ziel = ORDNER / quelle
    ziel.mkdir(parents=True, exist_ok=True)
    pfad = ziel / f"{datetime.now():%Y-%m-%d_%H-%M-%S}__{name}"
    pfad.write_bytes(rohdaten)
    return pfad


def loeschen(quelle, dateiname):
    if quelle not in QUELLEN:
        raise Abgelehnt("Unbekannte Quelle.")
    # Nur ein Name, kein Pfad: sonst zeigt ein «../» aus dem Ordner heraus.
    name = str(dateiname or "").replace("\\", "/").split("/")[-1]
    pfad = (ORDNER / quelle / name).resolve()
    erlaubt = (ORDNER / quelle).resolve()
    if erlaubt not in pfad.parents or not pfad.is_file():
        raise Abgelehnt("Diese Datei gibt es hier nicht.")
    pfad.unlink()


def _text_entziffern(rohdaten):
    for kodierung in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return rohdaten.decode(kodierung), kodierung
        except UnicodeDecodeError:
            continue
    return rohdaten.decode("latin-1", "replace"), "unbekannt"


def _lesen_csv(pfad):
    text, kodierung = _text_entziffern(pfad.read_bytes())
    try:
        trenner = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|").delimiter
    except csv.Error:
        trenner = ";"
    zeilen = list(csv.reader(io.StringIO(text), delimiter=trenner))
    kopf = [z for z in (zeilen[0] if zeilen else []) if str(z).strip()]
    daten = [z for z in zeilen[1:] if any(str(f).strip() for f in z)]
    return {
        "art": "CSV",
        "technik": f"Kodierung {kodierung}, Trennzeichen «{trenner}»",
        "blaetter": [{
            "name": "",
            "zeilen": len(daten),
            "spalten": len(kopf),
            "kopf": kopf,
            "angestossen": False,
        }],
    }


# Mehr Zeilen liest niemand mehr zum Nachschauen, und eine Datei, die hier
# anstoesst, ist keine Liste mehr, sondern ein Datenbestand.
ZEILEN_DECKEL = 100_000


def _lesen_xlsx(pfad):
    """Blaetter, Kopfzeile und Zeilenzahl — gezaehlt, nicht erfragt.

    `max_row` ist im Lesemodus unzuverlaessig: Dateien ohne gespeicherte
    Abmessung melden 1, und openpyxl sagt dazu «Worksheet is unsized».
    Genau so eine Datei liegt bei den Befragungen. Also wird durchgezaehlt;
    bei den vorliegenden Listen sind das einige hundert Zeilen.

    Die Kopfzeile ist die erste Zeile mit Inhalt, nicht zwingend Zeile eins:
    manche Ausgaben stellen eine Leerzeile oder einen Titel voran.
    """
    import openpyxl

    wb = openpyxl.load_workbook(pfad, read_only=True, data_only=True)
    try:
        blaetter = []
        for blatt in wb.worksheets:
            blatt.reset_dimensions()
            kopf = []
            zeilen = 0
            angestossen = False
            for reihe in blatt.iter_rows(values_only=True):
                gefuellt = [z for z in reihe if z is not None and str(z).strip()]
                if not gefuellt:
                    continue
                if not kopf:
                    kopf = [str(z) for z in reihe
                            if z is not None and str(z).strip()]
                    continue
                zeilen += 1
                if zeilen >= ZEILEN_DECKEL:
                    angestossen = True
                    break
            blaetter.append({
                "name": blatt.title,
                "zeilen": zeilen,
                "spalten": len(kopf),
                "kopf": kopf,
                "angestossen": angestossen,
            })
    finally:
        wb.close()
    return {
        "art": "Excel",
        "technik": f"{len(blaetter)} Blatt" if len(blaetter) == 1
                   else f"{len(blaetter)} Blätter",
        "blaetter": blaetter,
    }


def pruefen(pfad):
    """Liest die Datei so weit, dass nach dem Hochladen etwas dasteht.

    Gibt Art, Umfang, Spaltennamen und die Personendatenpruefung zurueck.
    Ein Lesefehler ist kein Absturz: die Datei bleibt liegen, und der Grund
    steht dabei.
    """
    pfad = Path(pfad)
    ergebnis = {
        "datei": pfad.name,
        "angezeigt": pfad.name.split("__", 1)[-1],
        "hochgeladen": datetime.fromtimestamp(pfad.stat().st_mtime),
        "bytes": pfad.stat().st_size,
        "fehler": None,
        "blaetter": [],
        "art": pfad.suffix.lstrip(".").upper(),
        "technik": "",
        "direkt": [],
        "mittelbar": [],
    }
    try:
        gelesen = (_lesen_csv(pfad) if pfad.suffix.lower() == ".csv"
                   else _lesen_xlsx(pfad))
        ergebnis.update(gelesen)
    except Exception as e:  # noqa: BLE001 - der Grund gehoert auf den Schirm
        ergebnis["fehler"] = f"{type(e).__name__}: {e}"
        return ergebnis

    alle_spalten = [s for b in ergebnis["blaetter"] for s in b["kopf"]]
    ergebnis["direkt"] = _treffer(alle_spalten, DIREKT)
    ergebnis["mittelbar"] = _treffer(alle_spalten, MITTELBAR)
    return ergebnis


def bestand(quelle):
    """Alle Dateien einer Quelle, die juengste zuerst."""
    ordner = ORDNER / quelle
    if not ordner.is_dir():
        return []
    dateien = [p for p in ordner.iterdir() if p.is_file()]
    dateien.sort(key=lambda p: p.name, reverse=True)
    return [pruefen(p) for p in dateien]
