"""Die Demo der IVR-Anwendung, ausgeliefert unter /ivr-anerkennung/demo.

Die Anwendung selbst liegt in «web/ivr» und ist eine gewoehnliche
Python-Anwendung; hier steht nur, was noetig ist, damit sie auf einer
Plattform mit kurzlebigen Prozessen laeuft.

Zwei Dinge sind dort anders als auf einem eigenen Server:

1. Beschreibbar ist nur ein Ordner, und alles darin ist weg, sobald die
   Instanz endet. Fuer eine Demo ist das kein Mangel, sondern das
   Zuruecksetzen: die Demodaten werden beim ersten Aufruf gebaut, wer etwas
   aendert, sieht es, und die naechste Instanz beginnt wieder von vorn. Es
   braucht keinen Zeitgeber.
2. Die Anwendung liegt nicht auf der Wurzel der Adresse, sondern unter
   einem Pfad. Dafuer sorgt die Schicht in anwendung/praefix.py.
"""

import os
import sys
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent
ANWENDUNG = WEB / "ivr" / "anwendung"
DEMO = WEB / "ivr" / "demo"

# Der einzige beschreibbare Ordner auf solchen Plattformen.
ABLAGE = Path(os.environ.get("IVR_ABLAGE") or "/tmp/ivr")
os.environ.setdefault("IVR_DATEN", str(ABLAGE / "daten"))
os.environ.setdefault("IVR_DOSSIER", str(ABLAGE / "dossier"))
# Die Anmeldemaske nennt die Zugangsdaten; das ist hier erwuenscht.
os.environ.setdefault("IVR_DEMO", "1")
# Die Adresse, unter der die Besucher die Demo sehen, und daneben die
# Adresse der Funktion selbst: die Plattform ruft sie unter beiden auf.
os.environ.setdefault("IVR_BASIS", "/ivr-anerkennung/demo")
os.environ.setdefault("IVR_BASIS_FUNKTION", "/api/demo")

sys.path.insert(0, str(ANWENDUNG))
sys.path.insert(0, str(DEMO))

import pfade  # noqa: E402


def _aufbauen():
    """Baut die Demodaten, falls sie in dieser Instanz noch fehlen."""
    if (pfade.DATEN / "ivr.db").exists():
        return
    import importlib.util
    quelle = DEMO / "demo-daten.py"
    kennung = importlib.util.spec_from_file_location("demo_daten", quelle)
    modul = importlib.util.module_from_spec(kennung)
    kennung.loader.exec_module(modul)
    modul.aufbauen()
    modul.konten_anlegen()


_aufbauen()

from app import app  # noqa: E402,F401
