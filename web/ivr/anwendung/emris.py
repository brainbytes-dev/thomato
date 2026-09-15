"""EMRIS-Exporte lesen und daraus die Themen des Ereignismonitorings bauen.

EMRIS gibt je Zeitraum ein Blatt «Export_Feedback» aus: eine Zeile je
Meldung mit Datum, Fehlerkategorie, Berufsgruppe und Kritizitaet. Die
Kategorien sind in EMRIS vorgegeben («1.3 Behandlungen», «4.1 Kommunikation
zwischen Fachkraeften»), deshalb muss hier niemand Themen erfinden: Der
Export bringt sie mit. Michael am 15.09.2026: «ereignisse möchte ich auch
nach themen sortieren, diese haben vorgegebene themen im emris schon drin,
diese aktualisiere ich anhand der excel- oder csv-datei, die ich hochlade.»

Was hier passiert: Alle hochgeladenen Exporte werden zusammen gelesen,
doppelte Meldungen (Exporte ueberlappen sich) einmal gezaehlt, und daraus
entstehen zwei Dinge: die Themen je Jahr in der Tabelle thema, Quelle
«emris», und die Datei daten/emris.json fuer die Monatsreihe der
Bereichsseite. Der Meldetext bleibt in der Datei; in die Datenbank kommen
nur Zahlen.
"""

import csv
import io
import json
from collections import Counter
from datetime import date, datetime
from pathlib import Path

import datenbank
import listen
import pfade

QUELLE = "emris"
KRITERIUM = "8.1.2"
ORDNER = listen.ORDNER / QUELLE
ZIEL = pfade.daten("emris.json")

# Spaltennamen im Export, wie sie EMRIS schreibt. Gesucht wird
# unempfindlich gegen Gross- und Kleinschreibung und Umlaute.
SPALTEN = {
    "datum": ("datum",),
    "kategorie": ("fehlerkategorie", "kategorie"),
    "berufsgruppe": ("berufsgruppe",),
    "anonym": ("anonym",),
    "meldung": ("meldung",),
}


def _finden(kopf, namen):
    for i, s in enumerate(kopf):
        gefaltet = listen._falten(s)
        if any(gefaltet.startswith(n) for n in namen):
            return i
    return None


def _datum(wert):
    """Ein Datum aus dem Export als ISO-Text, oder None."""
    if wert is None or str(wert).strip() == "":
        return None
    if isinstance(wert, (datetime, date)):
        return wert.strftime("%Y-%m-%d")
    text = str(wert).strip()
    for muster in ("%Y-%m-%d", "%d.%m.%Y", "%Y-%m-%d %H:%M:%S", "%d.%m.%Y %H:%M"):
        try:
            return datetime.strptime(text[:len(muster) + 2], muster).strftime("%Y-%m-%d")
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text).strftime("%Y-%m-%d")
    except ValueError:
        return None


def _aus_zeilen(zeilen):
    """Kopfzeile finden, Spalten zuordnen, Meldungen herausziehen."""
    kopf_i = next((i for i, z in enumerate(zeilen)
                   if any("datum" in listen._falten(x) for x in z if x)
                   and any("kategorie" in listen._falten(x) for x in z if x)), None)
    if kopf_i is None:
        return []
    kopf = [str(x) if x is not None else "" for x in zeilen[kopf_i]]
    sp = {name: _finden(kopf, alt) for name, alt in SPALTEN.items()}
    if sp["datum"] is None or sp["kategorie"] is None:
        return []

    def wert(z, name):
        i = sp[name]
        if i is None or i >= len(z) or z[i] is None:
            return ""
        return " ".join(str(z[i]).split())

    meldungen = []
    for z in zeilen[kopf_i + 1:]:
        d = _datum(z[sp["datum"]] if sp["datum"] < len(z) else None)
        if not d:
            continue
        meldungen.append({
            "datum": d,
            "kategorie": wert(z, "kategorie") or "ohne Kategorie",
            "berufsgruppe": wert(z, "berufsgruppe") or "unbekannt",
            "anonym": wert(z, "anonym") or "unbekannt",
            "meldung": wert(z, "meldung"),
        })
    return meldungen


def lesen(pfad):
    pfad = Path(pfad)
    if pfad.suffix.lower() == ".csv":
        text, _ = listen._text_entziffern(pfad.read_bytes())
        try:
            trenner = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|").delimiter
        except csv.Error:
            trenner = ";"
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
    """Alle Meldungen aus allen hochgeladenen Exporten, jede einmal. Zwei
    Exporte koennen sich ueberschneiden; gleiches Datum, gleicher Text und
    gleiche Kategorie ist dieselbe Meldung."""
    gesehen = set()
    meldungen = []
    if not ORDNER.is_dir():
        return meldungen
    for pfad in sorted(p for p in ORDNER.iterdir() if p.is_file()):
        try:
            zeilen = lesen(pfad)
        except Exception:  # noqa: BLE001 - eine kaputte Datei stoppt nicht alle
            continue
        for m in zeilen:
            schluessel = (m["datum"], m["meldung"], m["kategorie"])
            if schluessel in gesehen:
                continue
            gesehen.add(schluessel)
            meldungen.append(m)
    meldungen.sort(key=lambda m: m["datum"])
    return meldungen


def _monate(von, bis):
    j, m = int(von[:4]), int(von[5:7])
    ende = (int(bis[:4]), int(bis[5:7]))
    while (j, m) <= ende:
        yield f"{j:04d}-{m:02d}"
        m += 1
        if m > 12:
            j, m = j + 1, 1


def auswerten(meldungen):
    """Dieselben Kennzahlen wie die von Hand gebaute emris.json vom
    11.09.2026, jetzt aus den Dateien gerechnet."""
    heute = date.today()
    je_jahr = Counter(m["datum"][:4] for m in meldungen)
    je_halbjahr = Counter(f"{m['datum'][:4]}-H{1 if int(m['datum'][5:7]) <= 6 else 2}"
                          for m in meldungen)
    je_monat = Counter(m["datum"][:7] for m in meldungen)
    erster = meldungen[0]["datum"] if meldungen else heute.strftime("%Y-%m-%d")
    monate = [{"monat": mo, "anzahl": je_monat.get(mo, 0)}
              for mo in _monate(erster[:7] + "-01", heute.strftime("%Y-%m-%d"))]
    laufendes_jahr = heute.strftime("%Y")
    return {
        "quelle": f"EMRIS-Exporte unter daten/listen/emris, gerechnet am "
                  f"{heute:%d.%m.%Y}",
        "gesamt": len(meldungen),
        "je_jahr": dict(sorted(je_jahr.items())),
        "je_halbjahr": dict(sorted(je_halbjahr.items())),
        "letzte_meldung": meldungen[-1]["datum"] if meldungen else None,
        f"leere_monate_{laufendes_jahr}": sum(
            1 for mo in monate if mo["monat"].startswith(laufendes_jahr)
            and mo["anzahl"] == 0),
        "berufsgruppen": dict(Counter(m["berufsgruppe"] for m in meldungen).most_common()),
        "kategorien": dict(Counter(m["kategorie"] for m in meldungen).most_common()),
        "anonym": dict(Counter(m["anonym"] for m in meldungen)),
        "monate": monate,
    }


def aktualisieren():
    """Liest alle Exporte, schreibt emris.json und die Themen je Jahr.

    Themen aus dem Export tragen die Quelle «emris». Sie werden fuer die
    Jahre, die der Export abdeckt, ersetzt; von Hand erfasste Themen ohne
    Quelle bleiben stehen.
    """
    meldungen = alle()
    daten = auswerten(meldungen)
    ZIEL.write_text(json.dumps(daten, ensure_ascii=False, indent=1), encoding="utf-8")

    je_jahr_kat = Counter((m["datum"][:4], m["kategorie"]) for m in meldungen)
    jahre = sorted({j for j, _ in je_jahr_kat})
    v = datenbank.verbindung()
    for jahr in jahre:
        v.execute("DELETE FROM thema WHERE kriterium = ? AND quelle = ? AND von = ?",
                  (KRITERIUM, QUELLE, f"{jahr}-01-01"))
    for (jahr, kategorie), anzahl in sorted(je_jahr_kat.items()):
        v.execute(
            """INSERT INTO thema (kriterium, name, anzahl, von, bis, quelle)
               VALUES (?,?,?,?,?,?)""",
            (KRITERIUM, kategorie, anzahl, f"{jahr}-01-01", f"{jahr}-12-31", QUELLE))
    v.commit()
    v.close()
    return {"meldungen": len(meldungen), "jahre": jahre,
            "kategorien": len(daten["kategorien"]),
            "letzte": daten["letzte_meldung"]}
