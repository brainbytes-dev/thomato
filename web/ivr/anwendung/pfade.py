"""Wo die Daten liegen.

Bisher lagen sie fest neben der Anwendung: «daten» im selben Ordner, das
Dossier eine Ebene darueber. Das stimmt fuer eine Anlage auf einem Server,
den man selbst betreibt, und nur dafuer. Eine Demo auf einer fremden
Plattform darf oft nur in ein Verzeichnis schreiben, das ihr zugewiesen
wird, und eine zweite Anlage auf demselben Rechner braucht ihre eigenen
Ordner.

Zwei Umgebungsvariablen genuegen:

    IVR_DATEN     Datenbank, Konten, Listen, Anhaenge
    IVR_DOSSIER   der Dossierordner, ein Unterordner je Kriterium

Fehlen sie, gilt die bisherige Ablage. Eine bestehende Anlage merkt also
nichts davon.
"""

import os
from pathlib import Path

ANWENDUNG = Path(__file__).resolve().parent


def _aus_umgebung(name, vorgabe):
    wert = (os.environ.get(name) or "").strip()
    return Path(wert) if wert else vorgabe


DATEN = _aus_umgebung("IVR_DATEN", ANWENDUNG / "daten")
DOSSIER = _aus_umgebung("IVR_DOSSIER", ANWENDUNG.parent / "IVR Dokumente")
VORLAGEN = ANWENDUNG / "vorlagen"


def daten(*teile):
    """Ein Pfad unterhalb des Datenordners."""
    return DATEN.joinpath(*teile)
