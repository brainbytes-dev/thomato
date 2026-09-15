"""Das Dossier durchgehen und die Dateiliste in die Datenbank schreiben.

Bis zum 15.09.2026 lief das auf Michaels Rechner: dort lag das Dossier, ein
Skript erzeugte eine JSON-Datei, und die wurde in die Anwendung geladen.
Michael am 15.09.2026: «nichts soll auf dem rechner laufen, alles auf dem
proxmox, die dossiers müssen auch auf den proxmox verschoben werden.»

Das Dossier liegt jetzt unter /opt/ivr/IVR Dokumente, und das Einlesen
geschieht hier, auf Knopfdruck aus den Einstellungen. Damit gibt es nur
noch einen Bestand und keine zweite Kopie, die auseinanderlaeuft.

Zwei Dinge aus dem Bauplan, die hier bleiben muessen:

1. Das Dateidatum taugt nicht als Alterskriterium. Nach dem Kopieren aus
   SharePoint tragen alle Dateien denselben Zeitstempel. Gelesen wird
   deshalb das Datum aus dem Dokument selbst, sonst aus dem Dateinamen.
2. Der Status steckt im Unterordner: Fertig, In Bearbeitung, Alt. Das ist
   die Arbeitsstruktur, die im Dossier schon vorhanden ist.
"""

import json
import re
from datetime import datetime
from pathlib import Path

import datenbank
import handbuch
import pfade

WURZEL = handbuch.DOSSIER
LISTE = pfade.daten("nachweise.json")

# Schreibvarianten, die im Dossier tatsaechlich vorkommen.
STATUS = {
    "fertig": "fertig",
    "in bearbeitung": "in Bearbeitung",
    "in bearbetung": "in Bearbeitung",
    "alt": "alt",
}

UEBERSPRINGEN = {".ds_store", "thumbs.db", "desktop.ini"}


def nummer_aus_ordner(name):
    """«7.03.10 Hygiene» wird zu «7.3.10». Fuehrende Nullen muessen weg,
    sonst findet die Zuordnung das Kriterium nicht."""
    treffer = re.match(r"^(\d+(?:\.\d+)*)", (name or "").strip())
    if not treffer:
        return None
    teile = [str(int(t)) for t in treffer.group(1).split(".")]
    if len(teile) < 2:
        return None  # «8. Ergebnisqualität» ist eine Überschrift
    return ".".join(teile)


def status_aus_pfad(teile):
    """Der erste Unterordner unter dem Kriterium sagt den Status."""
    for t in teile:
        s = STATUS.get(str(t).strip().lower())
        if s:
            return s
    return "ohne Zuordnung"


def datum_aus_name(name):
    """Viele Dateien tragen ihr Datum im Namen. Zweite Quelle, wenn die
    Metadaten schweigen."""
    for muster, bau in (
        (r"(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})", lambda m: f"{m[1]}-{m[2]}-{m[3]}"),
        (r"(\d{2})[-_.](\d{2})[-_.](20\d{2})", lambda m: f"{m[3]}-{m[2]}-{m[1]}"),
        (r"(20\d{2})", lambda m: f"{m[1]}-01-01"),
    ):
        treffer = re.search(muster, name)
        if treffer:
            g = (None,) + treffer.groups()
            try:
                wert = bau(g)
                datetime.strptime(wert, "%Y-%m-%d")
                return wert
            except ValueError:
                continue
    return None


def einlesen(wurzel=None, bekannt=None):
    """Geht das Dossier durch und gibt die Dateiliste zurueck.

    «bekannt» sind die Kriteriumsnummern, die es gibt; ohne Angabe werden
    sie aus der Datenbank geholt. Ein Ordner mit einer Nummer, die dort
    fehlt, wird gemeldet statt still verschluckt.
    """
    wurzel = Path(wurzel or WURZEL)
    if bekannt is None:
        v = datenbank.verbindung()
        bekannt = {r["nummer"] for r in v.execute("SELECT nummer FROM kriterium")}
        v.close()

    dokumente = []
    unbekannt = set()

    for ordner in sorted(p for p in wurzel.iterdir() if p.is_dir()):
        nummer = nummer_aus_ordner(ordner.name)
        if nummer and nummer not in bekannt:
            unbekannt.add(f"{ordner.name} → {nummer}")
            nummer = None

        for datei in sorted(ordner.rglob("*")):
            if not datei.is_file() or datei.name.lower() in UEBERSPRINGEN:
                continue
            rel = datei.relative_to(ordner)
            datum, herkunft = handbuch.dokumentdatum(datei)
            if not datum:
                aus_name = datum_aus_name(datei.name)
                if aus_name:
                    datum, herkunft = aus_name, "aus dem Dateinamen"
            dokumente.append({
                "datum": datum,
                "datum_herkunft": herkunft,
                "kriterium": nummer,
                "titel": datei.stem,
                "datei": datei.name,
                "pfad": str(datei.relative_to(wurzel)).replace("\\", "/"),
                "ordner": ordner.name,
                "status": status_aus_pfad(rel.parts[:-1]),
                "endung": datei.suffix.lower().lstrip("."),
                "groesse": datei.stat().st_size,
            })

    return dokumente, sorted(unbekannt)


def neu_einlesen(wurzel=None, ziel=None):
    """Dossier durchgehen, Liste schreiben, in die Datenbank laden.

    Gibt zurueck, was daraus wurde: gelesene Dateien, zugeordnete, belegte
    Kriterien und die Ordner, deren Nummer kein Kriterium hat.
    """
    ziel = Path(ziel or LISTE)
    dokumente, unbekannt = einlesen(wurzel)
    ziel.parent.mkdir(parents=True, exist_ok=True)
    with open(ziel, "w", encoding="utf-8") as f:
        json.dump(dokumente, f, indent=1, ensure_ascii=False)
    gelesen, zugeordnet, belegte = datenbank.nachweise_laden(ziel)
    return {"gelesen": gelesen, "zugeordnet": zugeordnet,
            "belegte": belegte, "unbekannt": unbekannt,
            "liste": str(ziel)}


if __name__ == "__main__":
    ergebnis = neu_einlesen()
    print(f"{ergebnis['gelesen']} Dateien gelesen, "
          f"{ergebnis['zugeordnet']} zugeordnet, "
          f"{ergebnis['belegte']} Kriterien belegt")
    if ergebnis["unbekannt"]:
        print("\nOrdner mit einer Nummer, die kein Kriterium hat:")
        for u in ergebnis["unbekannt"]:
            print("  ", u)
