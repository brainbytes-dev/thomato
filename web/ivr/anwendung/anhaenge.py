"""Anhaenge zu Beschwerdefaellen: der Brief, das Protokoll, die Antwort.

Bisher stand bei jedem Fall nur, wie viele Dateien in der Ablage liegen.
Jetzt koennen sie am Fall selbst haengen, damit beim Pruefbesuch nicht
zwischen Anwendung und SharePoint hin- und hergeschaltet werden muss.

Die Anhaenge haengen an der Fallnummer, nicht an der Zeilenkennung: die
Nummer bleibt, wenn die Faelle aus der Ablage neu eingelesen werden, die
Kennung nicht.

Zu bedenken, und deshalb hier festgehalten: Beschwerden enthalten fast
immer Personendaten, oft aus dem Gesundheitsbereich. Die Anwendung hat
bisher keine gefuehrt. Wer hier etwas anhaengt, legt es auf diesen Server
und in dessen Sicherung; die Regel «Namen und Geburtsdaten bleiben in der
Ablage» gilt fuer die Felder des Falls weiter, fuer die Anhaenge nicht.
"""

from datetime import date, datetime
from pathlib import Path

import datenbank
from handbuch import ERLAUBT, GRENZE_BYTES
from listen import Abgelehnt, sicherer_name
import pfade

ORDNER = pfade.daten("beschwerden")

SCHEMA = """
CREATE TABLE IF NOT EXISTS beschwerde_anhang (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    fall_nr         INTEGER NOT NULL,
    titel           TEXT NOT NULL,
    datei           TEXT NOT NULL,
    endung          TEXT,
    groesse         INTEGER,
    hochgeladen_am  TEXT NOT NULL,
    hochgeladen_von TEXT
);
CREATE INDEX IF NOT EXISTS beschwerde_anhang_fall ON beschwerde_anhang(fall_nr);
"""


def einrichten():
    v = datenbank.verbindung()
    v.executescript(SCHEMA)
    v.close()


def _ordner(fall_nr):
    return ORDNER / str(int(fall_nr))


def speichern(v, fall_nr, dateiname, rohdaten, titel, wer):
    if not v.execute("SELECT 1 FROM beschwerde WHERE nr = ?",
                     (fall_nr,)).fetchone():
        raise Abgelehnt("Diesen Fall gibt es nicht.")
    name = sicherer_name(dateiname)
    endung = Path(name).suffix.lower()
    if endung not in ERLAUBT:
        raise Abgelehnt(
            f"«{endung or 'ohne Endung'}» wird nicht angenommen. Erlaubt sind "
            "PDF, Word, Excel, PowerPoint, OpenDocument, Text und Bilder.")
    if not rohdaten:
        raise Abgelehnt("Die Datei ist leer.")
    if len(rohdaten) > GRENZE_BYTES:
        raise Abgelehnt(
            f"Die Datei ist {len(rohdaten) / 1024 / 1024:.1f} MB gross, "
            f"erlaubt sind {GRENZE_BYTES // 1024 // 1024} MB.")

    ziel = _ordner(fall_nr)
    ziel.mkdir(parents=True, exist_ok=True)
    pfad = ziel / f"{datetime.now():%Y-%m-%d_%H-%M-%S}__{name}"
    pfad.write_bytes(rohdaten)

    original = str(dateiname or "").replace("\\", "/").split("/")[-1]
    titel = (titel or "").strip() or Path(original).stem.strip() or Path(name).stem
    zeiger = v.execute(
        """INSERT INTO beschwerde_anhang
               (fall_nr, titel, datei, endung, groesse, hochgeladen_am,
                hochgeladen_von)
           VALUES (?,?,?,?,?,?,?)""",
        (fall_nr, titel, pfad.name, endung.lstrip("."), len(rohdaten),
         date.today().isoformat(), wer))
    v.commit()
    return zeiger.lastrowid


def holen(v, kennung):
    a = v.execute("SELECT * FROM beschwerde_anhang WHERE id = ?",
                  (kennung,)).fetchone()
    if not a:
        raise Abgelehnt("Diesen Anhang gibt es nicht.")
    return a


def pfad_von(a):
    pfad = (_ordner(a["fall_nr"]) / a["datei"]).resolve()
    if ORDNER.resolve() not in pfad.parents:
        raise Abgelehnt("Diese Datei gibt es hier nicht.")
    return pfad


def loeschen(v, kennung):
    a = holen(v, kennung)
    pfad = pfad_von(a)
    v.execute("DELETE FROM beschwerde_anhang WHERE id = ?", (kennung,))
    v.commit()
    if pfad.is_file():
        pfad.unlink()
    return a


def je_fall(v):
    """Alle Anhaenge, nach Fallnummer gebuendelt, je Fall der juengste zuerst."""
    ergebnis = {}
    for a in v.execute("SELECT * FROM beschwerde_anhang "
                       "ORDER BY hochgeladen_am DESC, id DESC"):
        ergebnis.setdefault(a["fall_nr"], []).append(a)
    return ergebnis
