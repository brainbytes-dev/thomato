"""Das Betriebshandbuch: Dienstanweisungen ablegen, bestaetigen, pruefen.

Die zwanzig Betriebsablaeufe nach Kriterium 7.3 sind die Gliederung, die
das IVR verlangt. Hier bekommen sie ihren Inhalt: je Ablauf die Dokumente,
die im Betrieb gelten, mit Version, letzter Bestaetigung und naechster
Pruefung. Das ist der Teil des Werkzeugs, der taeglich gebraucht wird.

Drei Dinge, die hier anders sind als im Dossier:

- Die Dateien liegen in der Anwendung selbst (daten/handbuch), nicht in
  der Kopie des SharePoint. Sie werden mit der Datenbank gesichert.
- Aktualitaet ist eine Aussage einer Person, nicht des Dateisystems: ein
  Dokument gilt als aktuell, weil jemand es geprueft und bestaetigt hat,
  und es wird faellig, wenn die eingestellte Frist verstreicht.
- Der Text der Dokumente wird beim Hochladen ausgelesen, damit die Suche
  im Handbuch die Dienstanweisungen selbst findet und nicht nur ihre Titel.
"""

import calendar
import html
import re
import zipfile
from datetime import date, datetime
from pathlib import Path

import datenbank
from listen import Abgelehnt, sicherer_name
import pfade

ORDNER = pfade.daten("handbuch")

# 30 MB. Ein Hygienehandbuch mit Bildern als PDF liegt bei einigen MB; wer
# hier anstoesst, laedt eher ein Video hoch als eine Dienstanweisung.
GRENZE_BYTES = 30 * 1024 * 1024

ERLAUBT = {".pdf", ".docx", ".doc", ".xlsx", ".xlsm", ".pptx", ".odt",
           ".ods", ".txt", ".md", ".png", ".jpg", ".jpeg"}

# Wie oft ein Dokument geprueft wird, in Monaten. Vorbelegt sind zwei
# Jahre: so faellt vor jedem Dossier mindestens eine Pruefung an, und die
# Anerkennung laeuft vier Jahre.
INTERVALLE = [
    (0, "keine Erinnerung"),
    (6, "alle 6 Monate"),
    (12, "jährlich"),
    (24, "alle 2 Jahre"),
    (36, "alle 3 Jahre"),
    (48, "alle 4 Jahre"),
]
VORGABE_INTERVALL = 24

# Ab wann «bald faellig» gilt. Zwei Monate reichen, um ein Dokument zu
# ueberarbeiten und freizugeben; ein Monat waere knapp neben dem Dienst.
BALD_TAGE = 60

# Mehr Text als das liest niemand, und die Suche wird nicht besser davon.
TEXT_DECKEL = 400_000

SCHEMA = """
CREATE TABLE IF NOT EXISTS handbuch_dokument (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    kriterium         TEXT NOT NULL REFERENCES kriterium(nummer),
    titel             TEXT NOT NULL,
    datei             TEXT NOT NULL,
    endung            TEXT,
    groesse           INTEGER,
    version           TEXT,
    text              TEXT,
    hochgeladen_am    TEXT NOT NULL,
    hochgeladen_von   TEXT,
    bestaetigt_am     TEXT,
    bestaetigt_von    TEXT,
    intervall         INTEGER,
    naechste_pruefung TEXT,
    -- Wenn gesetzt, liegt die Datei im Dossier und nicht hier. Der Pfad
    -- ist relativ zu «IVR Dokumente» und ueberlebt das Neueinlesen.
    dossier_pfad      TEXT
);
"""

NACHTRAEGE = [("handbuch_dokument", "dossier_pfad TEXT")]

# Das Pruefdatum der Dossierdateien. Es haengt am Pfad, nicht an der
# Zeilenkennung von «dokument»: beim Neueinlesen des Dossiers werden dort
# alle Zeilen geloescht und die Kennungen neu vergeben. Der Pfad ueberlebt
# das, denn er ist die Datei.
#
# «frist» bleibt leer, solange die allgemeine Frist gilt, also das Dossier
# selbst. Gefuellt wird sie fuer Dateien, die frueher ablaufen: eine
# Bewilligung, ein Vertrag, ein Zertifikat.
PRUEFUNG_SCHEMA = """
CREATE TABLE IF NOT EXISTS pruefung (
    pfad         TEXT PRIMARY KEY,
    geprueft_am  TEXT,
    geprueft_von TEXT,
    frist        TEXT,
    notiz        TEXT,
    -- Wo die Datei lag, bevor das Prüfen sie nach «Fertig» schob. Leer,
    -- wenn sie schon dort lag. Nur so laesst sich die Pruefung
    -- zuruecknehmen, ohne aus «Alt» dauerhaft «Fertig» zu machen.
    vorher       TEXT
);
"""

PRUEFUNG_NACHTRAEGE = [("pruefung", "vorher TEXT")]


def einrichten():
    """Legt die Tabelle an, falls sie fehlt. Laeuft beim Start der Anwendung,
    damit eine bestehende Datenbank ohne Neueinlesen weiterlaeuft."""
    v = datenbank.verbindung()
    v.executescript(SCHEMA + PRUEFUNG_SCHEMA)
    for tabelle, spalte in NACHTRAEGE + PRUEFUNG_NACHTRAEGE:
        try:
            v.execute(f"ALTER TABLE {tabelle} ADD COLUMN {spalte}")
        except Exception:  # noqa: BLE001 - Spalte ist schon da
            pass
    v.commit()
    v.close()


def monate_dazu(tag, monate):
    """Ein Datum um ganze Monate weiter, am Monatsende abgefangen: der
    31. Januar plus ein Monat ist der 28. oder 29. Februar, kein Fehler."""
    m = tag.month - 1 + monate
    jahr = tag.year + m // 12
    monat = m % 12 + 1
    letzter = calendar.monthrange(jahr, monat)[1]
    return date(jahr, monat, min(tag.day, letzter))


def _datum(wert):
    if not wert:
        return None
    try:
        return datetime.strptime(str(wert)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def erste_pruefung(intervall, spaetestens=None, heute=None):
    """Wann ein neu abgelegtes Dokument zum ersten Mal geprueft wird.

    Das Intervall gibt den Takt. Vor dem Einreichen des Dossiers muss aber
    jedes Dokument einmal geprueft sein, und «alle 2 Jahre» ab heute liegt
    im September 2026 schon dahinter. Liegt der Takt nach der Frist, zieht
    die Frist ihn vor; danach zaehlt das Intervall ab jeder Bestaetigung
    wieder normal weiter.
    """
    heute = heute or date.today()
    if not intervall:
        return None
    takt = monate_dazu(heute, intervall)
    grenze = _datum(spaetestens)
    if grenze and heute < grenze < takt:
        return grenze
    return takt


def _ordner(nummer):
    """Ein Ordner je Betriebsablauf, der Name ist die Kriteriennummer. Die
    Nummer kommt aus der Datenbank, nicht aus der Adresse, und traegt nur
    Ziffern und Punkte."""
    if not re.fullmatch(r"\d+(\.\d+)*", nummer or ""):
        raise Abgelehnt("Unbekannter Betriebsablauf.")
    return ORDNER / nummer


def text_auslesen(pfad):
    """Der Text eines Dokuments fuer die Suche, oder None mit dem Grund.

    PDF ueber pypdf, die Office-Formate ueber ihre XML-Teile: die Absaetze
    werden zu Zeilen, alles andere an Auszeichnung faellt weg. Ein Fehler
    beim Lesen ist kein Fehler beim Hochladen; das Dokument liegt dann da,
    nur die Suche findet es nicht am Inhalt.
    """
    endung = pfad.suffix.lower()
    try:
        if endung == ".pdf":
            from pypdf import PdfReader
            teile = []
            for seite in PdfReader(str(pfad)).pages:
                teile.append(seite.extract_text() or "")
                if sum(len(t) for t in teile) > TEXT_DECKEL:
                    break
            text = "\n".join(teile)
        elif endung in (".docx", ".pptx", ".xlsx", ".xlsm", ".odt", ".ods"):
            with zipfile.ZipFile(pfad) as z:
                namen = [n for n in z.namelist() if (
                    n in ("word/document.xml", "content.xml",
                          "xl/sharedStrings.xml")
                    or (n.startswith("ppt/slides/slide") and n.endswith(".xml")))]
                roh = "\n".join(z.read(n).decode("utf-8", "ignore")
                                for n in sorted(namen))
            # Was kein Text ist, faellt vorher weg: Feldbefehle wie
            # «PAGEREF _Toc… \h» aus dem Inhaltsverzeichnis, nachverfolgte
            # Loeschungen, Zeichnungen samt ihren Positionszahlen.
            roh = re.sub(r"<w:instrText[^>]*>.*?</w:instrText>", " ", roh,
                         flags=re.S)
            roh = re.sub(r"<w:delText[^>]*>.*?</w:delText>", " ", roh, flags=re.S)
            roh = re.sub(r"<(w:drawing|w:pict|w:object)\b.*?</\1>", " ", roh,
                         flags=re.S)
            # Absatzenden werden Zeilen, damit Woerter aus benachbarten
            # Absaetzen nicht zusammenkleben. Laeufe innerhalb eines
            # Absatzes werden ohne Zwischenraum verbunden: Word teilt ein
            # Wort bei jedem Wechsel der Formatierung.
            roh = re.sub(r"</(w:p|a:p|text:p|text:h|si)>", "\n", roh)
            roh = re.sub(r"<(w:tab|w:br|text:tab|text:line-break|text:s)[^>]*/?>",
                         " ", roh)
            text = html.unescape(re.sub(r"<[^>]+>", "", roh))
        elif endung in (".txt", ".md"):
            text = pfad.read_bytes().decode("utf-8", "ignore")
        else:
            return None, "Dateityp ohne lesbaren Text"
    except Exception as fehler:  # noqa: BLE001 - der Grund gehoert in die Datenbank
        return None, f"nicht lesbar: {type(fehler).__name__}"

    text = re.sub(r"[ \t\r\f\v ]+", " ", text)
    text = re.sub(r"\s*\n\s*", "\n", text).strip()
    if not text:
        return None, "kein Text im Dokument"
    return text[:TEXT_DECKEL], None


# Wo die Nachweise des Dossiers liegen. Die Ordnernamen spiegeln die
# fruehere OneDrive-Ablage; die Skripte leiten ihre Pfade daraus ab.
DOSSIER = pfade.DOSSIER


def dossier_pfad(relativ):
    """Der Pfad einer Dossierdatei, und zwar nur innerhalb des Dossiers."""
    pfad = (DOSSIER / str(relativ or "")).resolve()
    if DOSSIER.resolve() not in pfad.parents:
        raise Abgelehnt("Diese Datei gibt es hier nicht.")
    return pfad


def pruefstand(geprueft_am, frist, heute=None):
    """Was mit einer Dossierdatei ist: geprueft, oder bis wann zu pruefen.

    Aktualitaet ist auch hier die Aussage einer Person und nicht des
    Dateisystems. Eine Datei gilt, weil jemand sie angeschaut hat.
    """
    heute = heute or date.today()
    tag = _datum(geprueft_am)
    if tag:
        return {"stufe": "geprueft", "farbe": "gruen", "tage": None,
                "text": f"geprüft am {tag:%d.%m.%Y}"}
    ziel = _datum(frist)
    if not ziel:
        return {"stufe": "offen", "farbe": "", "tage": None,
                "text": "noch nicht geprüft"}
    tage = (ziel - heute).days
    if tage < 0:
        return {"stufe": "ueberfaellig", "farbe": "rot", "tage": tage,
                "text": f"ungeprüft, Frist war am {ziel:%d.%m.%Y}"}
    if tage <= BALD_TAGE:
        return {"stufe": "bald", "farbe": "gelb", "tage": tage,
                "text": f"noch ungeprüft, zu prüfen bis {ziel:%d.%m.%Y}"}
    return {"stufe": "offen", "farbe": "", "tage": tage,
            "text": f"noch ungeprüft, zu prüfen bis {ziel:%d.%m.%Y}"}


def pruefvermerke(v, pfade):
    """Die Pruefvermerke zu diesen Pfaden. Eine Abfrage, nicht eine je
    Datei: ein Kriterium hat bis zu fuenfundzwanzig."""
    pfade = [p for p in pfade if p]
    if not pfade:
        return {}
    marken = ",".join("?" * len(pfade))
    return {z["pfad"]: z for z in v.execute(
        f"SELECT * FROM pruefung WHERE pfad IN ({marken})", pfade)}


def _freier_name(ordner, name):
    """Ein Name, den es in diesem Ordner noch nicht gibt. Eine gleichnamige
    Datei wird nie ueberschrieben: im Dossier liegt womoeglich die Fassung,
    die bisher galt."""
    ziel = ordner / name
    zaehler = 2
    while ziel.exists():
        ziel = ordner / f"{Path(name).stem} ({zaehler}){Path(name).suffix}"
        zaehler += 1
    return ziel


def _umziehen(v, pfad, ziel_ordner, status):
    """Schiebt eine Dossierdatei in einen Statusordner und schreibt ueberall
    den neuen Pfad nach.

    Der Pfad ist der Schluessel: die Zeile in «dokument» haengt daran, der
    Pruefvermerk haengt daran, und ein Handbuchdokument verweist darauf.
    Wird er nur an einer Stelle geaendert, verliert das Werkzeug die Datei.
    Gibt den neuen Pfad zurueck oder None, wenn nichts zu tun war.
    """
    quelle = dossier_pfad(pfad)
    if not quelle.is_file():
        return None
    ziel_ordner.mkdir(parents=True, exist_ok=True)
    if quelle.parent == ziel_ordner:
        return None
    ziel = _freier_name(ziel_ordner, quelle.name)
    quelle.rename(ziel)
    # Beide Seiten aufgeloest, sonst scheitert relative_to an einem
    # Verweis im Pfad.
    neu = str(ziel.relative_to(DOSSIER.resolve())).replace("\\", "/")
    oberster = neu.split("/")[0]
    v.execute("UPDATE dokument SET pfad = ?, status = ?, ordner = ? "
              "WHERE pfad = ?", (neu, status, oberster, pfad))
    v.execute("UPDATE handbuch_dokument SET dossier_pfad = ?, datei = ? "
              "WHERE dossier_pfad = ?", (neu, ziel.name, pfad))
    return neu


def nach_fertig(v, pfad):
    """Die Datei gilt, also gehoert sie in «Fertig». Gibt den neuen Pfad
    zurueck, oder None, wenn sie schon dort lag."""
    teile = str(pfad or "").split("/")
    if len(teile) < 2:
        return None
    # Auch «Fertig/Unterordner» zaehlt als drin: der Statusordner steht im
    # Dossier nicht immer unmittelbar ueber der Datei.
    if any(t.strip().lower() == "fertig" for t in teile[1:-1]):
        return None
    kriteriumsordner = dossier_pfad(teile[0])
    return _umziehen(v, pfad, kriteriumsordner / STATUSORDNER["fertig"],
                     "fertig")


def pruefen(v, pfade, wer, heute=None):
    """Diese Dateien sind angeschaut, gelten als aktuell und kommen nach
    «Fertig».

    Michael am 15.09.2026: «wenn die datei geprüft wurde soll sie in fertig
    verschoben werden.» Der Ordner sagt im Dossier den Stand, und beim
    Pruefbesuch zaehlt nur, was in «Fertig» liegt.
    """
    tag = (heute or date.today()).isoformat()
    geprueft = verschoben = 0
    for pfad in pfade:
        neu = nach_fertig(v, pfad)
        if neu:
            verschoben += 1
            # Der Vermerk zieht mit: er haengt am Pfad, und den gibt es
            # nicht mehr.
            v.execute("DELETE FROM pruefung WHERE pfad = ?", (neu,))
            v.execute("UPDATE pruefung SET pfad = ? WHERE pfad = ?",
                      (neu, pfad))
        ziel = neu or pfad
        v.execute(
            """INSERT INTO pruefung (pfad, geprueft_am, geprueft_von, vorher)
               VALUES (?,?,?,?)
               ON CONFLICT(pfad) DO UPDATE SET
                   geprueft_am = excluded.geprueft_am,
                   geprueft_von = excluded.geprueft_von,
                   vorher = COALESCE(excluded.vorher, pruefung.vorher)""",
            (ziel, tag, wer, pfad if neu else None))
        geprueft += 1
    v.commit()
    return geprueft, verschoben


def pruefung_zuruecknehmen(v, pfade):
    """Doch nicht geprueft. Ein Fehlgriff muss sich zuruecknehmen lassen,
    sonst steht am Dossier eine Bestaetigung, die niemand gegeben hat, und
    die Datei liegt in «Fertig», wo sie nicht hingehoert."""
    zurueck = verschoben = 0
    for pfad in pfade:
        z = v.execute("SELECT * FROM pruefung WHERE pfad = ?",
                      (pfad,)).fetchone()
        if not z or not z["geprueft_am"]:
            continue
        zurueck += 1
        vorher = z["vorher"]
        neu = None
        if vorher:
            zurueck_ordner = dossier_pfad(vorher).parent
            status = status_aus_ordner(zurueck_ordner.name)
            neu = _umziehen(v, pfad, zurueck_ordner, status)
        if neu:
            verschoben += 1
            v.execute("DELETE FROM pruefung WHERE pfad = ?", (neu,))
            v.execute("UPDATE pruefung SET pfad = ? WHERE pfad = ?",
                      (neu, pfad))
        v.execute("""UPDATE pruefung SET geprueft_am = NULL,
                         geprueft_von = NULL, vorher = NULL
                     WHERE pfad = ?""", (neu or pfad,))
    v.commit()
    return zurueck, verschoben


def status_aus_ordner(name):
    """Der Stand, den ein Ordnername bedeutet. Dieselbe Tabelle wie beim
    Einlesen des Dossiers, nur andersherum gelesen."""
    for stand, ordner in STATUSORDNER.items():
        if ordner.lower() == (name or "").strip().lower():
            return stand
    return "ohne Zuordnung"


def frist_setzen(v, pfad, frist):
    """Eine eigene Frist fuer eine Datei, die vor dem Dossier ablaeuft."""
    ziel = _datum(frist)
    v.execute(
        """INSERT INTO pruefung (pfad, frist) VALUES (?,?)
           ON CONFLICT(pfad) DO UPDATE SET frist = excluded.frist""",
        (pfad, ziel.isoformat() if ziel else None))
    v.commit()
    return ziel


def pruefplan(v, frist, heute=None):
    """Der Stand der Dossierpruefung im Ganzen: wie viele Dateien geprueft
    sind und wie viel Zeit bis zum Einreichen bleibt."""
    heute = heute or date.today()
    z = v.execute(
        """SELECT COUNT(*) AS gesamt,
                  SUM(CASE WHEN p.geprueft_am IS NOT NULL
                            AND p.geprueft_am <> '' THEN 1 ELSE 0 END)
                      AS geprueft
           FROM dokument d LEFT JOIN pruefung p ON p.pfad = d.pfad""").fetchone()
    gesamt, geprueft = z["gesamt"] or 0, z["geprueft"] or 0
    ziel = _datum(frist)
    return {
        "gesamt": gesamt, "geprueft": geprueft, "offen": gesamt - geprueft,
        "frist": ziel.isoformat() if ziel else None,
        "tage": (ziel - heute).days if ziel else None,
        "anteil": round(geprueft * 100 / gesamt) if gesamt else 0,
    }


# So heissen die Statusordner im Dossier. Eine neue Datei ist noch nicht
# freigegeben, sie kommt in «In Bearbeitung»; freigeben heisst, sie nach
# «Fertig» zu legen, und das entscheidet der Betrieb, nicht das Werkzeug.
STATUSORDNER = {"fertig": "Fertig", "in Bearbeitung": "In Bearbeitung",
                "alt": "Alt"}


def _ordnername(nummer, titel):
    """«7.3.8» und sein Titel werden zu «7.03.08 Unterhalt und Kontrolle …»,
    so wie die Ordner im Dossier schon heissen: je Stufe zwei Stellen, die
    erste ausgenommen."""
    teile = nummer.split(".")
    gepolstert = ".".join([teile[0]] + [t.rjust(2, "0") for t in teile[1:]])
    sauber = re.sub(r'[\\/:*?"<>|]+', " ", titel or "").strip()
    sauber = re.sub(r"\s+", " ", sauber)[:90].strip()
    # Ein Punkt oder ein Leerzeichen am Ende: unter Windows legt das einen
    # Ordner an, der anders heisst als der Name, mit dem man ihn sucht.
    return f"{gepolstert} {sauber}".strip().rstrip(" .")


def dossier_ordner(v, nummer):
    """Der Ordner im Dossier, in dem die Dateien dieses Kriteriums liegen.

    Erst wird gefragt, wo die bestehenden liegen; das ist die sicherste
    Auskunft, denn die Ordnernamen stammen aus dem SharePoint und folgen
    keiner Regel, die sich ableiten liesse. Danach wird gesucht, und erst
    wenn es keinen gibt, einer angelegt.
    """
    zeile = v.execute(
        """SELECT d.pfad FROM dokument d JOIN beleg b ON b.dokument = d.id
           WHERE b.kriterium = ? AND d.pfad IS NOT NULL LIMIT 1""",
        (nummer,)).fetchone()
    if zeile:
        erster = str(zeile["pfad"]).replace("\\", "/").split("/")[0]
        if (DOSSIER / erster).is_dir():
            return DOSSIER / erster

    for eintrag in sorted(DOSSIER.iterdir()):
        if eintrag.is_dir() and _nummer_aus_ordner(eintrag.name) == nummer:
            return eintrag

    k = v.execute("SELECT titel FROM kriterium WHERE nummer = ?",
                  (nummer,)).fetchone()
    if not k:
        raise Abgelehnt("Unbekanntes Kriterium.")
    neu = DOSSIER / _ordnername(nummer, k["titel"])
    neu.mkdir(parents=True, exist_ok=True)
    return neu


def _nummer_aus_ordner(name):
    """«7.03.10 Hygiene» wird zu «7.3.10». Dieselbe Regel wie beim
    Einlesen des Dossiers."""
    treffer = re.match(r"^(\d+(?:\.\d+)*)", (name or "").strip())
    if not treffer:
        return None
    teile = [str(int(t)) for t in treffer.group(1).split(".")]
    return ".".join(teile) if len(teile) >= 2 else None


def dokumentdatum(pfad):
    """Das Datum aus dem Dokument selbst, wie beim Einlesen des Dossiers.

    Beim Hochladen waere das Dateidatum zwar richtig, aber es sagt, wann
    die Datei hierher kam, und nicht, wann der Inhalt zuletzt geaendert
    wurde. Steht es im Dokument, gilt das Dokument.
    """
    endung = pfad.suffix.lower()
    try:
        if endung in (".docx", ".xlsx", ".pptx", ".dotx", ".xlsm"):
            with zipfile.ZipFile(pfad) as z:
                roh = z.read("docProps/core.xml").decode("utf-8", "ignore")
            for feld in ("dcterms:modified", "dcterms:created"):
                treffer = re.search(f"<{feld}[^>]*>([^<]+)<", roh)
                if treffer:
                    return (treffer.group(1).strip().replace("Z", "")[:10],
                            "geändert" if "modified" in feld else "erstellt")
        elif endung == ".pdf":
            from pypdf import PdfReader
            info = PdfReader(pfad).metadata or {}
            for feld in ("/ModDate", "/CreationDate"):
                roh = str(info.get(feld) or "")
                treffer = re.search(r"(\d{4})(\d{2})(\d{2})", roh)
                if treffer:
                    return ("-".join(treffer.groups()),
                            "geändert" if "Mod" in feld else "erstellt")
    except Exception:  # noqa: BLE001 - kaputte Datei, dann eben ohne
        pass
    return None, None


def ins_dossier(v, nummer, dateiname, rohdaten, titel, wer):
    """Legt eine hochgeladene Datei im Dossier ab und traegt sie ein.

    Michael am 15.09.2026: «hochgeladene dokumente kommen in das dossier».
    Sie landet in «In Bearbeitung», denn freigegeben ist sie nicht, nur
    weil sie da ist. Gibt (Kennung, relativer Pfad) zurueck.
    """
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
    if not v.execute("SELECT 1 FROM kriterium WHERE nummer = ?",
                     (nummer,)).fetchone():
        raise Abgelehnt("Unbekanntes Kriterium.")

    ordner = dossier_ordner(v, nummer)
    ziel = ordner / STATUSORDNER["in Bearbeitung"]
    ziel.mkdir(parents=True, exist_ok=True)

    # Eine gleichnamige Datei wird nicht ueberschrieben: im Dossier liegt
    # womoeglich die Fassung, die noch gilt.
    pfad = ziel / name
    zaehler = 2
    while pfad.exists():
        pfad = ziel / f"{Path(name).stem} ({zaehler}){Path(name).suffix}"
        zaehler += 1
    pfad.write_bytes(rohdaten)

    relativ = str(pfad.relative_to(DOSSIER)).replace("\\", "/")
    original = str(dateiname or "").replace("\\", "/").split("/")[-1]
    titel = (titel or "").strip() or Path(original).stem.strip() or pfad.stem
    datum, herkunft = dokumentdatum(pfad)
    if not datum:
        datum, herkunft = date.today().isoformat(), "hochgeladen"

    zeiger = v.execute(
        """INSERT INTO dokument (titel, pfad, status, endung, groesse,
               ordner, datum, datum_herkunft, eigen)
           VALUES (?,?,?,?,?,?,?,?,1)""",
        (titel, relativ, "in Bearbeitung", endung.lstrip("."), len(rohdaten),
         ordner.name, datum, herkunft))
    v.execute("INSERT OR IGNORE INTO beleg (kriterium, dokument) VALUES (?,?)",
              (nummer, zeiger.lastrowid))
    v.commit()
    return zeiger.lastrowid, relativ


def dossier_loeschen(v, nummer, dokument_id):
    """Nimmt eine selbst hochgeladene Datei wieder aus dem Dossier. Was aus
    dem SharePoint stammt, wird hier nicht geloescht: das Dossier ist die
    Kopie eines Bestandes, den das Werkzeug nicht fuehrt."""
    d = v.execute(
        """SELECT d.* FROM dokument d JOIN beleg b ON b.dokument = d.id
           WHERE d.id = ? AND b.kriterium = ?""",
        (dokument_id, nummer)).fetchone()
    if not d:
        raise Abgelehnt("Diese Datei gehört nicht zu diesem Kriterium.")
    if not d["eigen"]:
        raise Abgelehnt("Diese Datei stammt aus dem Dossier und wird hier "
                        "nicht gelöscht.")
    if v.execute("SELECT 1 FROM handbuch_dokument WHERE dossier_pfad = ?",
                 (d["pfad"],)).fetchone():
        raise Abgelehnt("Diese Datei ist im Handbuch aufgenommen. Erst dort "
                        "entfernen.")
    pfad = dossier_pfad(d["pfad"])
    if pfad.is_file():
        pfad.unlink()
    v.execute("DELETE FROM beleg WHERE dokument = ?", (dokument_id,))
    v.execute("DELETE FROM dokument WHERE id = ?", (dokument_id,))
    v.execute("DELETE FROM pruefung WHERE pfad = ?", (d["pfad"],))
    v.commit()
    return d["titel"]


def nachweise(v, nummer, frist=None):
    """Die Dossierdateien eines Kriteriums, die freigegebenen zuerst.

    Dazu zwei Vermerke: ob dieselbe Datei schon im Handbuch liegt, dann
    braucht es den Knopf zum Uebernehmen nicht mehr, und wann sie zuletzt
    geprueft wurde.
    """
    schon = {z["dossier_pfad"] for z in v.execute(
        "SELECT dossier_pfad FROM handbuch_dokument WHERE kriterium = ? "
        "AND dossier_pfad IS NOT NULL", (nummer,))}
    zeilen = v.execute(
        """SELECT d.* FROM dokument d JOIN beleg b ON b.dokument = d.id
           WHERE b.kriterium = ?
           ORDER BY CASE d.status WHEN 'fertig' THEN 1
                                  WHEN 'in Bearbeitung' THEN 2
                                  WHEN 'alt' THEN 4 ELSE 3 END,
                    d.datum DESC, d.titel""", (nummer,)).fetchall()
    vermerke = pruefvermerke(v, [d["pfad"] for d in zeilen])
    heute = date.today()
    ergebnis = []
    for d in zeilen:
        p = vermerke.get(d["pfad"])
        eigene = p["frist"] if p and p["frist"] else None
        gilt = eigene or frist
        ergebnis.append(dict(
            d,
            dateiname=Path(d["pfad"]).name,
            im_handbuch=d["pfad"] in schon,
            geprueft_am=p["geprueft_am"] if p else None,
            geprueft_von=p["geprueft_von"] if p else None,
            frist=gilt, eigene_frist=eigene,
            pruefstand=pruefstand(p["geprueft_am"] if p else None, gilt, heute)))
    return ergebnis


def verknuepfen(v, nummer, dokument_id, intervall, wer, spaetestens=None):
    """Eine Datei aus dem Dossier ins Handbuch aufnehmen, ohne Kopie.

    Das Handbuch fuehrt sie dann mit Pruefintervall und Bestaetigung; die
    Datei selbst bleibt im Dossier und wird nur gelesen.
    """
    d = v.execute(
        """SELECT d.* FROM dokument d JOIN beleg b ON b.dokument = d.id
           WHERE d.id = ? AND b.kriterium = ?""", (dokument_id, nummer)).fetchone()
    if not d:
        raise Abgelehnt("Diese Datei gehört nicht zu diesem Betriebsablauf.")
    quelle = dossier_pfad(d["pfad"])
    if not quelle.is_file():
        raise Abgelehnt("Die Datei liegt nicht mehr im Dossier.")
    if v.execute("SELECT 1 FROM handbuch_dokument WHERE kriterium = ? "
                 "AND dossier_pfad = ?", (nummer, d["pfad"])).fetchone():
        raise Abgelehnt("Diese Datei ist schon im Handbuch.")

    heute = date.today()
    intervall = int(intervall or 0) or None
    text, _grund = text_auslesen(quelle)
    zeiger = v.execute(
        """INSERT INTO handbuch_dokument
               (kriterium, titel, datei, endung, groesse, version, text,
                hochgeladen_am, hochgeladen_von, intervall, naechste_pruefung,
                dossier_pfad)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        (nummer, d["titel"], quelle.name,
         (d["endung"] or quelle.suffix.lstrip(".")).lower(),
         d["groesse"] or quelle.stat().st_size, None, text,
         heute.isoformat(), wer, intervall,
         erste_pruefung(intervall, spaetestens, heute).isoformat()
         if intervall else None,
         d["pfad"]))
    v.commit()
    return zeiger.lastrowid, d


def holen(v, kennung):
    d = v.execute("SELECT * FROM handbuch_dokument WHERE id = ?",
                  (kennung,)).fetchone()
    if not d:
        raise Abgelehnt("Dieses Dokument gibt es nicht.")
    return d


def pfad_von(d):
    """Der Pfad zur Datei. Entweder die eigene Ablage des Handbuchs oder,
    bei einer verknuepften Datei, das Dossier."""
    if d["dossier_pfad"]:
        return dossier_pfad(d["dossier_pfad"])
    pfad = (_ordner(d["kriterium"]) / d["datei"]).resolve()
    if ORDNER.resolve() not in pfad.parents:
        raise Abgelehnt("Diese Datei gibt es hier nicht.")
    return pfad


def loeschen(v, kennung):
    """Nimmt das Dokument aus dem Handbuch. Eine eigene Datei wird dabei
    geloescht, eine verknuepfte bleibt: sie gehoert dem Dossier."""
    d = holen(v, kennung)
    verknuepft = bool(d["dossier_pfad"])
    pfad = None if verknuepft else pfad_von(d)
    v.execute("DELETE FROM handbuch_dokument WHERE id = ?", (kennung,))
    v.commit()
    if pfad and pfad.is_file():
        pfad.unlink()
    return d


def vorziehen(v, spaetestens, heute=None):
    """Zieht jede Pruefung, die nach dem Einreichen laege oder ganz fehlt,
    auf die Frist vor. Gibt zurueck, wie viele Dokumente das betraf."""
    heute = heute or date.today()
    grenze = _datum(spaetestens)
    if not grenze or grenze <= heute:
        return 0
    ziel = grenze.isoformat()
    zeiger = v.execute(
        """UPDATE handbuch_dokument
           SET naechste_pruefung = ?,
               intervall = COALESCE(intervall, ?)
           WHERE naechste_pruefung IS NULL OR naechste_pruefung > ?""",
        (ziel, VORGABE_INTERVALL, ziel))
    v.commit()
    return zeiger.rowcount


def bestaetigen(v, kennung, wer, heute=None):
    """Jemand hat das Dokument angeschaut und sagt: das gilt so. Von heute
    an laeuft das Intervall neu; ohne Intervall erlischt die Erinnerung,
    denn sie ist erledigt."""
    d = holen(v, kennung)
    heute = heute or date.today()
    naechste = (monate_dazu(heute, d["intervall"]).isoformat()
                if d["intervall"] else None)
    v.execute(
        """UPDATE handbuch_dokument
           SET bestaetigt_am = ?, bestaetigt_von = ?, naechste_pruefung = ?
           WHERE id = ?""",
        (heute.isoformat(), wer, naechste, kennung))
    v.commit()
    return naechste


def erinnerung(v, kennung, intervall, naechste):
    """Stellt die Erinnerung ein. Ein Datum gilt vor dem Intervall: wer
    «bis 1. März» sagt, meint diesen Tag und nicht «in 24 Monaten». Das
    Intervall bleibt fuer die naechste Bestaetigung gespeichert."""
    d = holen(v, kennung)
    intervall = int(intervall or 0) or None
    tag = _datum(naechste)
    if tag:
        ziel = tag.isoformat()
    elif intervall:
        von = _datum(d["bestaetigt_am"]) or _datum(d["hochgeladen_am"]) or date.today()
        ziel = monate_dazu(von, intervall).isoformat()
    else:
        ziel = None
    v.execute(
        "UPDATE handbuch_dokument SET intervall = ?, naechste_pruefung = ? "
        "WHERE id = ?", (intervall, ziel, kennung))
    v.commit()
    return ziel


def stand(d, heute=None):
    """Was das Dokument gerade ist: faellig, bald faellig, aktuell oder
    ungeprueft. Die Stufe traegt die Farbe, der Text steht daneben."""
    heute = heute or date.today()
    naechste = _datum(d["naechste_pruefung"])
    if naechste:
        tage = (naechste - heute).days
        if tage < 0:
            return {"stufe": "faellig", "farbe": "rot", "tage": tage,
                    "text": f"Prüfung fällig seit {naechste:%d.%m.%Y}"}
        if tage <= BALD_TAGE:
            return {"stufe": "bald", "farbe": "gelb", "tage": tage,
                    "text": f"Prüfung fällig am {naechste:%d.%m.%Y}"}
        return {"stufe": "aktuell", "farbe": "gruen", "tage": tage,
                "text": f"nächste Prüfung {naechste:%d.%m.%Y}"}
    if d["bestaetigt_am"]:
        return {"stufe": "aktuell", "farbe": "gruen", "tage": None,
                "text": "ohne Erinnerung"}
    return {"stufe": "ungeprueft", "farbe": "", "tage": None,
            "text": "noch nicht bestätigt"}


def _mit_stand(zeilen, heute=None):
    heute = heute or date.today()
    return [dict(z, stand=stand(z, heute)) for z in zeilen]


def dokumente(v, nummer):
    """Die Dokumente eines Betriebsablaufs, das Dringlichste zuoberst."""
    zeilen = v.execute(
        """SELECT * FROM handbuch_dokument WHERE kriterium = ?
           ORDER BY naechste_pruefung IS NULL, naechste_pruefung, titel""",
        (nummer,)).fetchall()
    return _mit_stand(zeilen)


def uebersicht(v, nummern):
    """Je Betriebsablauf: wie viele Dokumente, und der dringlichste Stand.

    Ein Ablauf erbt den schlechtesten Stand seiner Dokumente, so wie ein
    Teilprozess auf der Landkarte den seiner Kriterien: Wer drei aktuelle
    Dienstanweisungen hat und eine faellige, hat eine faellige.
    """
    heute = date.today()
    ergebnis = {n: {"anzahl": 0, "stand": None} for n in nummern}
    rang = {"faellig": 0, "bald": 1, "ungeprueft": 2, "aktuell": 3}
    for d in v.execute("SELECT * FROM handbuch_dokument"):
        eintrag = ergebnis.get(d["kriterium"])
        if eintrag is None:
            continue
        eintrag["anzahl"] += 1
        s = stand(d, heute)
        if eintrag["stand"] is None or rang[s["stufe"]] < rang[eintrag["stand"]["stufe"]]:
            eintrag["stand"] = s
    return ergebnis


def dossier_zahlen(v):
    """Wie viele Dossierdateien je Kriterium, wie viele davon freigegeben
    und wie viele geprueft sind. Eine Abfrage fuer alle."""
    return {z["kriterium"]: {"gesamt": z["gesamt"], "fertig": z["fertig"],
                             "geprueft": z["geprueft"] or 0}
            for z in v.execute(
                """SELECT b.kriterium,
                          COUNT(*) AS gesamt,
                          SUM(CASE WHEN d.status = 'fertig' THEN 1 ELSE 0 END)
                              AS fertig,
                          SUM(CASE WHEN p.geprueft_am IS NOT NULL
                                    AND p.geprueft_am <> '' THEN 1 ELSE 0 END)
                              AS geprueft
                   FROM beleg b
                   JOIN dokument d ON d.id = b.dokument
                   LEFT JOIN pruefung p ON p.pfad = d.pfad
                   GROUP BY b.kriterium""")}


def faellige(v, heute=None):
    """Alle Dokumente, deren Pruefung ansteht oder verstrichen ist, das
    Aelteste zuerst. Das ist die Erinnerung: sie steht auf der Handbuchseite,
    in der Seitenleiste und auf der Uebersicht."""
    heute = heute or date.today()
    grenze = date.fromordinal(heute.toordinal() + BALD_TAGE).isoformat()
    zeilen = v.execute(
        """SELECT h.*, k.titel AS ablauf FROM handbuch_dokument h
           JOIN kriterium k ON k.nummer = h.kriterium
           WHERE h.naechste_pruefung IS NOT NULL AND h.naechste_pruefung <= ?
           ORDER BY h.naechste_pruefung, h.titel""",
        (grenze,)).fetchall()
    return _mit_stand(zeilen, heute)


def anzahl_faellig():
    """Fuer die Seitenleiste: die Zahl neben «Handbuch». Eigene Verbindung,
    weil die Seitenleiste auf jeder Seite steht und keine hat."""
    v = datenbank.verbindung()
    try:
        v.execute("SELECT 1 FROM handbuch_dokument LIMIT 1")
    except Exception:  # noqa: BLE001 - Tabelle fehlt noch, dann gibt es nichts
        v.close()
        return 0
    n = len(faellige(v))
    v.close()
    return n


def suchen(v, q):
    """Dokumente, in deren Titel, Version oder Text die Suche vorkommt, mit
    einem Ausschnitt um die Fundstelle."""
    zeilen = v.execute(
        """SELECT h.*, k.titel AS ablauf FROM handbuch_dokument h
           JOIN kriterium k ON k.nummer = h.kriterium
           WHERE h.titel LIKE ? OR h.version LIKE ? OR h.text LIKE ?
           ORDER BY k.sortierung, h.titel""",
        (f"%{q}%", f"%{q}%", f"%{q}%")).fetchall()
    treffer = []
    for z in zeilen:
        d = dict(z, stand=stand(z))
        d["ausschnitt"] = ausschnitt(z["text"] or "", q)
        treffer.append(d)
    return treffer


def ausschnitt(text, q, breite=90):
    """Die Stelle im Text, an der das Suchwort steht, mit etwas Umgebung.
    An Wortgrenzen geschnitten, damit kein «…ygiene» entsteht."""
    if not text or not q:
        return ""
    stelle = text.lower().find(q.lower())
    if stelle < 0:
        return ""
    von = max(0, stelle - breite)
    bis = min(len(text), stelle + len(q) + breite)
    stueck = text[von:bis].replace("\n", " ")
    if von > 0:
        stueck = "…" + stueck.split(" ", 1)[-1]
    if bis < len(text):
        stueck = stueck.rsplit(" ", 1)[0] + "…"
    return stueck
