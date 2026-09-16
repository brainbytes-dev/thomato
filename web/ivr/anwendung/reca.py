"""SWISSRECA-Exporte lesen und daraus die Reanimationskennzahlen rechnen.

Das Reanimationsregister gibt je Fall eine Zeile mit gut hundert Spalten
aus: Umstaende des Kollapses, was Ersthelfer und Notrufzentrale getan
haben, was der Rettungsdienst vorfand, und wie es ausging. Bis zum
16.09.2026 wurde der Export nur abgelegt. Michael: «es braucht auch eine
auswertung.»

Gerechnet wird, was die Rettungskette zeigt und was das Register selbst
als Ergebnis fuehrt: beobachtet, Laienreanimation, Telefonreanimation, AED,
First Responder, erster Rhythmus, ROSC, Spitalaufnahme, Ueberleben. Dazu
die Zeiten, die im Export stehen, als Median. Alles aus den Dateien, jede
Zahl mit ihrer Grundgesamtheit, weil bei dreissig Faellen ein einzelner
mehrere Prozentpunkte ausmacht.

Personendaten bleiben in der Datei. Gelesen werden nur die Spalten, die
hier stehen; Name des Erfassenden, Adresse, Geburtsjahr und Geschlecht
gehoeren nicht dazu, und in die JSON kommen nur Zaehlungen.
"""

import csv
import io
import json
import re
from collections import Counter
from datetime import date, datetime
from pathlib import Path
from statistics import median

import listen
import pfade

QUELLE = "swissreca"
KRITERIUM = "8.5"
ORDNER = listen.ORDNER / QUELLE
ZIEL = pfade.daten("reca.json")

# Spaltennamen, wie SWISSRECA sie schreibt, gefaltet (Kleinschreibung, ohne
# Umlaute) und als Anfang gesucht. Mehrere Anfaenge, wo das Register den
# Namen schon einmal geaendert hat oder ein Export ihn kuerzt.
SPALTEN = {
    "kennung": ("idrecord",),
    # Wann der Fall im Register zuletzt bearbeitet wurde. Der juengste
    # dieser Zeitpunkte ist der Stand des Exports: Monate danach sind
    # keine Monate ohne Faelle, sondern Monate ohne Daten.
    "erfasst": ("datetime",),
    "datum": ("einsatz datum", "einsatzdatum"),
    "einsatzort": ("einsatzort",),
    "ursache": ("ursache",),
    "beobachtet": ("kollaps beobachtet",),
    "kollaps": ("kollaps zeitpunkt",),
    "notruf": ("notrufeingang",),
    "telefonrea": ("snz 144 telefon-reanimation", "snz 144 telefonreanimation",
                   "telefon-reanimation", "telefonreanimation"),
    "start_telefonrea": ("start telefonreanimation",),
    "ersthelfer_vor_ort": ("ersthelfer vor ort",),
    "laienrea": ("ersthelfer reanimation",),
    "start_laienrea": ("start ersthelfer reanimation",),
    "aed_ersthelfer": ("einsatz aed ersthelfer",),
    "defi_ersthelfer": ("1. defibrillation ersthelfer",),
    "first_responder": ("first responder vor ort",),
    "vor_ort": ("zeitpunkt rettungsdienst vor ort",),
    "reanimiert": ("reanimation durchgefuhrt", "reanimation durchgefuehrt"),
    "rhythmus": ("herzrhythmus rettungsdienst",),
    "defi_rd": ("1. defibrillation rettungsdienst",),
    "rosc": ("jemals rosc",),
    "spital": ("spitalaufnahme",),
    "ueberlebt": ("uberlebt ereignis", "ueberlebt ereignis"),
    "entlassung": ("spitalentlassung",),
    "cpc": ("cpc outcome bei spitalentlassung",),
    "klinikdaten": ("daten klinik",),
}

SCHOCKBAR = ("kammerflimmern", "kammertachykardie", "ventrikul")
NICHT_SCHOCKBAR = ("asystolie", "pulslose", "pea")


def _finden(kopf, namen):
    for i, s in enumerate(kopf):
        gefaltet = listen._falten(s)
        if any(gefaltet.startswith(n) for n in namen):
            return i
    return None


def _zeit(wert):
    """Ein Zeitpunkt aus dem Export, oder None. SWISSRECA schreibt
    «18.09.2025 00:00:00»; Excel liefert schon ein datetime."""
    if wert is None:
        return None
    if isinstance(wert, datetime):
        return wert
    if isinstance(wert, date):
        return datetime(wert.year, wert.month, wert.day)
    text = str(wert).strip()
    if not text:
        return None
    for muster in ("%d.%m.%Y %H:%M:%S", "%d.%m.%Y %H:%M", "%d.%m.%Y",
                   "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, muster)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _ja_nein(text):
    """«Ja» wird True, alles mit «Nein» False, Leeres und «Unbekannt» None.
    SWISSRECA haengt an ein Nein oft den Grund: «Nein, abgelehnt»."""
    t = listen._falten(text)
    if not t or t.startswith("unbekannt") or t.startswith("nicht bekannt"):
        return None
    if t.startswith("ja"):
        return True
    if t.startswith("nein"):
        return False
    return None


def _durchgefuehrt(text):
    """Fuer «Ersthelfer Reanimation»: «Nur Herzdruckmassage» und
    «Herzdruckmassage + Beatmung» sind ein Ja, «Nicht durchgefuehrt» ein
    Nein."""
    t = listen._falten(text)
    if not t or t.startswith("unbekannt") or t.startswith("nicht bekannt"):
        return None
    if t.startswith("nicht durchgef"):
        return False
    if "herzdruck" in t or "beatmung" in t or t.startswith("ja"):
        return True
    return None


def _eingesetzt(text):
    t = listen._falten(text)
    if not t or "bekannt" in t:
        return None
    if t.startswith("nicht eingesetzt"):
        return False
    if t.startswith("eingesetzt") or t.startswith("ja"):
        return True
    return None


def _minuten(von, bis):
    """Minuten zwischen zwei Zeitpunkten, nur wenn beide da sind und die
    Spanne plausibel ist. Eine negative Spanne oder eine ueber drei Stunden
    ist ein Tippfehler im Register, keine Messung."""
    a, b = _zeit(von), _zeit(bis)
    if not a or not b:
        return None
    m = (b - a).total_seconds() / 60
    return round(m, 1) if 0 <= m <= 180 else None


def _aus_zeilen(zeilen):
    """Kopfzeile finden, Spalten zuordnen, je Zeile einen Fall bauen."""
    kopf_i = next((i for i, z in enumerate(zeilen)
                   if any("kollaps" in listen._falten(x) for x in z if x)
                   and any("rosc" in listen._falten(x) for x in z if x)), None)
    if kopf_i is None:
        return []
    kopf = [str(x) if x is not None else "" for x in zeilen[kopf_i]]
    sp = {name: _finden(kopf, alt) for name, alt in SPALTEN.items()}
    if sp["datum"] is None:
        return []

    def roh(z, name):
        i = sp[name]
        if i is None or i >= len(z) or z[i] is None:
            return ""
        return " ".join(str(z[i]).split())

    def text(z, name):
        return roh(z, name) or "unbekannt"

    faelle = []
    for z in zeilen[kopf_i + 1:]:
        wann = _zeit(roh(z, "datum"))
        if not wann:
            continue
        rea = listen._falten(roh(z, "reanimiert"))
        beob = listen._falten(roh(z, "beobachtet"))
        rhythmus = listen._falten(roh(z, "rhythmus"))
        entlassung = listen._falten(roh(z, "entlassung"))
        spital = listen._falten(roh(z, "spital"))
        cpc = re.search(r"\d", roh(z, "cpc"))
        erfasst = _zeit(roh(z, "erfasst"))
        faelle.append({
            "kennung": roh(z, "kennung"),
            "datum": wann.strftime("%Y-%m-%d"),
            "erfasst": erfasst.strftime("%Y-%m-%d") if erfasst else None,
            "einsatzort": text(z, "einsatzort"),
            "ursache": text(z, "ursache"),
            # Beobachtet durch Ersthelfer zaehlt fuer die Utstein-Gruppe;
            # durch den Rettungsdienst beobachtet ist ein eigener Fall.
            "beobachtet": ("ersthelfer" if "ersthelfer" in beob
                           else "rettungsdienst" if "rettungsdienst" in beob
                           else "nein" if beob.startswith("nicht")
                           else None),
            # Reanimiert heisst: der Rettungsdienst hat begonnen oder
            # weitergefuehrt. «Nur BLS unter fuenf Minuten» zaehlt dazu,
            # «Nein, weil offensichtlich tot» nicht.
            "reanimiert": rea.startswith("ja") or rea.startswith("nur bls"),
            "nicht_begonnen_weil": (roh(z, "reanimiert")
                                    if rea.startswith("nein") else None),
            "telefonrea": _ja_nein(roh(z, "telefonrea")),
            "ersthelfer_vor_ort": _ja_nein(roh(z, "ersthelfer_vor_ort")),
            "laienrea": _durchgefuehrt(roh(z, "laienrea")),
            "aed_ersthelfer": _eingesetzt(roh(z, "aed_ersthelfer")),
            "first_responder": _ja_nein(roh(z, "first_responder")),
            "rhythmus": ("schockbar" if any(s in rhythmus for s in SCHOCKBAR)
                         else "nicht schockbar"
                         if any(s in rhythmus for s in NICHT_SCHOCKBAR)
                         else None),
            "rosc": _ja_nein(roh(z, "rosc")),
            "spital_mit_rosc": ("mit rosc" in spital if spital else None),
            "ueberlebt": _ja_nein(roh(z, "ueberlebt")),
            "entlassung_lebend": (False if "verstorben" in entlassung
                                  else None if not entlassung
                                  or "unbekannt" in entlassung
                                  else True),
            "cpc": int(cpc.group()) if cpc else None,
            "klinikdaten": bool(roh(z, "klinikdaten")),
            "min_notruf_vor_ort": _minuten(roh(z, "notruf"), roh(z, "vor_ort")),
            "min_kollaps_laienrea": _minuten(roh(z, "kollaps"),
                                             roh(z, "start_laienrea")),
            "min_kollaps_defi": (_minuten(roh(z, "kollaps"), roh(z, "defi_ersthelfer"))
                                 or _minuten(roh(z, "kollaps"), roh(z, "defi_rd"))),
        })
    return faelle


def lesen(pfad):
    pfad = Path(pfad)
    if pfad.suffix.lower() == ".csv":
        text, _ = listen._text_entziffern(pfad.read_bytes())
        try:
            trenner = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|").delimiter
        except csv.Error:
            trenner = ","
        return _aus_zeilen(list(csv.reader(io.StringIO(text), delimiter=trenner)))
    import openpyxl
    wb = openpyxl.load_workbook(pfad, read_only=True, data_only=True)
    try:
        gefunden = []
        for blatt in wb.worksheets:
            blatt.reset_dimensions()
            gefunden.extend(_aus_zeilen(list(blatt.iter_rows(values_only=True))))
        return gefunden
    finally:
        wb.close()


def alle():
    """Alle Faelle aus allen Exporten, jeder einmal. Exporte ueberlappen
    sich; die Kennung des Registers entscheidet, ersatzweise Datum und
    Zeitpunkt vor Ort."""
    gesehen = set()
    faelle = []
    if not ORDNER.is_dir():
        return faelle
    for pfad in sorted(p for p in ORDNER.iterdir() if p.is_file()):
        try:
            zeilen = lesen(pfad)
        except Exception:  # noqa: BLE001 - eine kaputte Datei stoppt nicht alle
            continue
        for f in zeilen:
            schluessel = f["kennung"] or (f["datum"], f["min_notruf_vor_ort"],
                                          f["einsatzort"])
            if schluessel in gesehen:
                continue
            gesehen.add(schluessel)
            faelle.append(f)
    faelle.sort(key=lambda f: f["datum"])
    return faelle


def _monate(von, bis):
    j, m = int(von[:4]), int(von[5:7])
    ende = (int(bis[:4]), int(bis[5:7]))
    while (j, m) <= ende:
        yield f"{j:04d}-{m:02d}"
        m += 1
        if m > 12:
            j, m = j + 1, 1


def _anteil(faelle, feld):
    """Wie viele Ja unter denen mit Angabe. Die Zahl ohne Angabe steht
    daneben, weil sie bei diesem Register oft die groessere ist."""
    mit = [f for f in faelle if f[feld] is not None]
    ja = sum(1 for f in mit if f[feld])
    return {"ja": ja, "n": len(mit), "ohne_angabe": len(faelle) - len(mit),
            "quote": round(100 * ja / len(mit), 1) if mit else None}


def _median_minuten(faelle, feld):
    werte = [f[feld] for f in faelle if f[feld] is not None]
    return {"n": len(werte), "median": round(median(werte), 1) if werte else None}


def auswerten(faelle):
    heute = date.today()
    reanimiert = [f for f in faelle if f["reanimiert"]]
    je_monat = Counter(f["datum"][:7] for f in faelle)
    erster = faelle[0]["datum"] if faelle else heute.strftime("%Y-%m-%d")
    # Die Monatsreihe endet beim Stand des Exports, nicht heute. Ein Export
    # vom Maerz weiss nichts ueber den Sommer, und eine Null dort waere
    # eine Behauptung.
    stand = max((f["erfasst"] for f in faelle if f["erfasst"]),
                default=faelle[-1]["datum"] if faelle else heute.strftime("%Y-%m-%d"))
    monate = [{"monat": mo, "anzahl": je_monat.get(mo, 0)}
              for mo in _monate(erster[:7] + "-01", stand)]
    utstein = [f for f in reanimiert
               if f["beobachtet"] == "ersthelfer" and f["rhythmus"] == "schockbar"]
    cpc_gut = [f for f in reanimiert if f["cpc"] is not None]
    beobachtet = [dict(f, x=(None if f["beobachtet"] is None
                             else f["beobachtet"] != "nein"))
                  for f in reanimiert]
    return {
        "quelle": f"SWISSRECA-Exporte unter daten/listen/swissreca, gerechnet "
                  f"am {heute:%d.%m.%Y}",
        "gesamt": len(faelle),
        "je_jahr": dict(sorted(Counter(f["datum"][:4] for f in faelle).items())),
        "von": faelle[0]["datum"] if faelle else None,
        "bis": faelle[-1]["datum"] if faelle else None,
        "stand": stand,
        "reanimiert": len(reanimiert),
        "nicht_begonnen": dict(Counter(
            f["nicht_begonnen_weil"] for f in faelle
            if f["nicht_begonnen_weil"]).most_common()),
        # Die Rettungskette, bezogen auf die Faelle mit Reanimationsversuch.
        "kette": [
            {"name": "Kollaps beobachtet", **_anteil(beobachtet, "x")},
            {"name": "Laienreanimation vor Eintreffen",
             **_anteil(reanimiert, "laienrea")},
            {"name": "Telefonreanimation durch die 144",
             **_anteil(reanimiert, "telefonrea")},
            {"name": "AED durch Ersthelfer eingesetzt",
             **_anteil(reanimiert, "aed_ersthelfer")},
            {"name": "First Responder vor Ort",
             **_anteil(reanimiert, "first_responder")},
        ],
        "rhythmus": {
            "schockbar": sum(1 for f in reanimiert if f["rhythmus"] == "schockbar"),
            "nicht_schockbar": sum(1 for f in reanimiert
                                   if f["rhythmus"] == "nicht schockbar"),
            "ohne_angabe": sum(1 for f in reanimiert if f["rhythmus"] is None),
        },
        # Der Ausgang, in der Reihenfolge, in der er eintritt.
        "ergebnis": [
            {"name": "ROSC erreicht", **_anteil(reanimiert, "rosc")},
            {"name": "Spitalaufnahme mit ROSC",
             **_anteil(reanimiert, "spital_mit_rosc")},
            {"name": "Ereignis überlebt", **_anteil(reanimiert, "ueberlebt")},
            {"name": "Lebend entlassen", **_anteil(reanimiert, "entlassung_lebend")},
            {"name": "Gutes neurologisches Ergebnis (CPC 1 bis 2)",
             "ja": sum(1 for f in cpc_gut if f["cpc"] <= 2), "n": len(cpc_gut),
             "ohne_angabe": len(reanimiert) - len(cpc_gut),
             "quote": (round(100 * sum(1 for f in cpc_gut if f["cpc"] <= 2)
                             / len(cpc_gut), 1) if cpc_gut else None)},
        ],
        # Utstein-Vergleichsgruppe: durch Ersthelfer beobachtet und
        # schockbarer erster Rhythmus. Damit vergleichen sich Register
        # untereinander; bei kleinen Betrieben ist sie oft einstellig.
        "utstein": {"n": len(utstein),
                    "rosc": sum(1 for f in utstein if f["rosc"]),
                    "ueberlebt": sum(1 for f in utstein if f["ueberlebt"])},
        "zeiten": {
            "notruf_vor_ort": _median_minuten(reanimiert, "min_notruf_vor_ort"),
            "kollaps_laienrea": _median_minuten(faelle, "min_kollaps_laienrea"),
            "kollaps_defi": _median_minuten(faelle, "min_kollaps_defi"),
        },
        "einsatzort": dict(Counter(f["einsatzort"] for f in faelle).most_common()),
        "ursache": dict(Counter(f["ursache"] for f in faelle).most_common()),
        # Was die Klinik nicht zurueckmeldet, kann das Register nicht
        # wissen. Diese Zahl erklaert die grossen «ohne Angabe» beim Ausgang.
        "klinikdaten_fehlen": sum(1 for f in reanimiert if not f["klinikdaten"]),
        "monate": monate,
    }


def aktualisieren():
    """Liest alle Exporte und schreibt reca.json. Ohne Faelle verschwindet
    die Datei, damit die Bereichsseite nicht eine leere Auswertung zeigt."""
    faelle = alle()
    if not faelle:
        if ZIEL.exists():
            ZIEL.unlink()
        return {"faelle": 0, "reanimiert": 0, "jahre": [], "von": None, "bis": None}
    daten = auswerten(faelle)
    ZIEL.write_text(json.dumps(daten, ensure_ascii=False, indent=1), encoding="utf-8")
    return {"faelle": daten["gesamt"], "reanimiert": daten["reanimiert"],
            "jahre": list(daten["je_jahr"]), "von": daten["von"], "bis": daten["bis"]}
