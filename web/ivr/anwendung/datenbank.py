"""Datenbank der IVR-Anwendung.

Das Kriterienregister ist unveraenderlich und kommt aus register.json. Alles
andere entsteht im Betrieb. Die Massnahme ist das Bindeglied: Analyse,
Ereignis, Beschwerde und Umfrage sind nur Ausloeser. Was das IVR bei der
Erneuerung sehen will, ist die Massnahme und ihre Wirkungskontrolle, darum
hat sie die Felder nachgemessen_am und nachmessung_ergebnis.
"""

import json
import re
import sqlite3
from pathlib import Path
import pfade

DB = pfade.daten("ivr.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS kriterium (
    nummer            TEXT PRIMARY KEY,
    titel             TEXT NOT NULL,
    kapitel           TEXT NOT NULL,
    seite             INTEGER,
    beschreibung      TEXT,
    anerkennung_muss  INTEGER DEFAULT 0,
    anerkennung_soll  INTEGER DEFAULT 0,
    erneuerung_muss   INTEGER DEFAULT 0,
    erneuerung_soll   INTEGER DEFAULT 0,
    handbuch          TEXT,
    nachweise         TEXT,
    sortierung        INTEGER,
    status_2024       TEXT
);

CREATE TABLE IF NOT EXISTS dokument (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    titel         TEXT NOT NULL,
    pfad          TEXT UNIQUE,
    version       TEXT,
    freigabe      TEXT,
    intervall     INTEGER DEFAULT 48,
    verantwortlich TEXT,
    status        TEXT DEFAULT 'aktuell',
    endung        TEXT,
    groesse       INTEGER,
    ordner        TEXT
);

CREATE TABLE IF NOT EXISTS beleg (
    kriterium  TEXT NOT NULL REFERENCES kriterium(nummer),
    dokument   INTEGER NOT NULL REFERENCES dokument(id) ON DELETE CASCADE,
    PRIMARY KEY (kriterium, dokument)
);

CREATE TABLE IF NOT EXISTS massnahme (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    kriterium            TEXT REFERENCES kriterium(nummer),
    ausloeser            TEXT,
    beschreibung         TEXT NOT NULL,
    verantwortlich       TEXT,
    frist                TEXT,
    stand                TEXT DEFAULT 'offen',
    gemessen_am          TEXT,
    messwert             TEXT,
    nachgemessen_am      TEXT,
    nachmessung_ergebnis TEXT,
    erstellt             TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analyse (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    kriterium  TEXT REFERENCES kriterium(nummer),
    gegenstand TEXT NOT NULL,
    zeitraum   TEXT,
    quelle     TEXT,
    ergebnis   TEXT,
    erstellt   TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS umfrage (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    zielgruppe TEXT NOT NULL,
    zeitraum   TEXT,
    ruecklauf  TEXT,
    ergebnis   TEXT,
    erstellt   TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS beschwerde (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    eingang    TEXT,
    weg        TEXT,
    kategorie  TEXT,
    stand      TEXT DEFAULT 'eingegangen',
    antwort    TEXT,
    erstellt   TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS einstellung (
    schluessel TEXT PRIMARY KEY,
    wert       TEXT
);

-- Eigene Termine neben den drei festen Fristen: Besuchstermin, Abgabe des
-- Qualitaetsberichts, Sitzung mit dem IVR. Die festen Fristen bleiben in
-- der Tabelle einstellung, weil die Uhr und die Kreislaufrechnung daran
-- haengen; hier steht, was der Betrieb dazu eintraegt.
CREATE TABLE IF NOT EXISTS termin (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    beschriftung TEXT NOT NULL,
    datum        TEXT NOT NULL,
    erstellt     TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Auflagen aus einem Anerkennungsverfahren: Bedingungen mit Frist, an
-- denen die Anerkennung haengt. Sie gehoeren dem Kriterium und stehen
-- neben der Anmerkung der Pruefer.
CREATE TABLE IF NOT EXISTS auflage (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    kriterium   TEXT NOT NULL,
    text        TEXT NOT NULL,
    verfahren   TEXT,
    frist       TEXT,
    erfuellt_am TEXT,
    erfuellt_von TEXT,
    erfasst_am  TEXT NOT NULL,
    erfasst_von TEXT
);
CREATE INDEX IF NOT EXISTS auflage_kriterium ON auflage(kriterium);

-- Eigene Kommentare zu einem Kriterium: was seit dem Expertenbericht
-- geschehen ist, was noch fehlt, was beim naechsten Besuch zu zeigen ist.
-- Sie stehen neben der Anmerkung der Pruefer, nicht an ihrer Stelle.
CREATE TABLE IF NOT EXISTS kommentar (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    kriterium  TEXT NOT NULL,
    text       TEXT NOT NULL,
    verfasser  TEXT,
    erstellt   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS kommentar_kriterium ON kommentar(kriterium);

-- Themen der Rueckmeldungen je Monitoringbereich: «Notarztaufgebot, 27»,
-- je Eintrag mit Zeitraum. Quelle leer heisst von Hand erfasst, sonst aus
-- einem Export gerechnet. Der Anteil rechnet gegen die Summe im Filter.
CREATE TABLE IF NOT EXISTS thema (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    kriterium  TEXT NOT NULL,
    name       TEXT NOT NULL,
    anzahl     INTEGER NOT NULL DEFAULT 0,
    von        TEXT,
    bis        TEXT,
    quelle     TEXT,
    erstellt   TEXT DEFAULT CURRENT_TIMESTAMP
);
"""


def einrichten():
    """Legt fehlende Tabellen an, ohne das Register neu einzulesen. Laeuft
    beim Start der Anwendung; alles im Schema ist IF NOT EXISTS."""
    v = verbindung()
    v.executescript(SCHEMA)
    nachziehen(v)
    zusatzkriterien_setzen(v)
    belege_nachziehen(v)
    v.close()


def einstellung_setzen(v, schluessel, wert):
    v.execute(
        "INSERT INTO einstellung (schluessel, wert) VALUES (?,?) "
        "ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert",
        (schluessel, wert))
    v.commit()

# Die Uhr. Aus dem Bauplan: Anerkennung laeuft bis 25.04.2028, Antrag sechs
# Monate vorher, vollstaendiges Dossier vier Monate vorher.
VORGABEN = {
    "ablauf": "2028-04-25",
    "antrag": "2027-10-25",
    "dossier": "2027-12-25",
    # Leer, damit eine neue Anlage nicht den Namen einer fremden traegt.
    # Gesetzt wird er in den Einstellungen.
    "betrieb": "",
    # Unter diesem Namen steht der Betrieb in den Einsatzdaten der
    # Leitstelle. Fuer die Auswertung der Hilfsfrist: sie vergleicht die
    # eigenen Zeiten mit denen der uebrigen Dienste.
    "eigener_dienst": "",
    # Zur Erneuerung sind drei der fünf Bereiche nach 8.1 zu belegen. Welche
    # drei, muss der Betrieb selbst entscheiden; ohne diese Wahl ist «0 von 3»
    # ein Nenner, den niemand bestimmt hat. Vorbelegt nach kreislaeufe.md:
    # bei diesen dreien liegt die erste Messung aus der Auflagenerfüllung 2025
    # bereits vor, es fehlt nur die zweite.
    "tragende": "8.1.1,8.1.2,8.1.4",
    # Der Vorgehenszyklus, in dem die Kreisläufe gezeigt werden: pdca mit
    # drei Schritten oder dmaic (Six Sigma) mit fünf. Umschaltbar in den
    # Einstellungen; die Daten sind dieselben.
    "zyklus": "pdca",
}


# Im PDF stehen die Mindestzahlen («min. 2 von 5») als Text im Titel, weil der
# Auszug Tabellenspalten aneinanderhaengt: aus «Periodische Überprüfung» wird
# «Periodische Überprüfungmin. 1min. 1». Offener Punkt aus dem Bauplan.
# Drei Titel sind dabei ausserdem mitten im Wort abgeschnitten; die stehen
# hier mit ihrem Wortlaut aus der Richtlinie.
TITEL_KORREKTUR = {
    "8.1": "Prozessmonitoring (Datenerhebung, -bewertung und -analyse)",
    "8.4": "Erhebung, Bewertung und Analyse der Messdaten zu Indikatordiagnosen",
    "6.3.2": "Verfügt über die Mittel, Statusmeldungen und Positionsangaben "
             "an die SNZ 144 zu übermitteln",
    # Bei sieben Betriebsablaeufen nach 7.3 bricht der Titel am Zeilenende
    # der PDF ab und der Rest steht in der Beschreibung. Hier der Wortlaut
    # aus beiden Teilen; seit das Handbuch je Ablauf eine Seite hat, steht
    # der Titel dort als Ueberschrift und darf nicht mitten im Satz enden.
    "7.3": "Umsetzung von folgenden, im Handbuch aufgeführten, Betriebsabläufen",
    "7.3.6": "Einführung und Begleitung von Auszubildenden (inkl. Bezeichnung "
             "Ausbildungsverantwortlicher) für Ausbildungsbetriebe",
    "7.3.7": "Notarztindikationenliste inkl. Alarmierung bzw. gemäss Punkt 6.10",
    "7.3.8": "Unterhalt und Kontrolle von Fahrzeugen, Geräten und "
             "Verbrauchsmaterialien",
    "7.3.9": "Besondere und ausserordentliche Lagen inkl. Alarmierung",
    "7.3.11": "Beschreibung der Zusammenarbeit mit Partnerorganisationen / "
              "Schnittstellen",
    "7.3.19": "Richtlinien & Massnahmen für die Arbeitssicherheit und den "
              "Gesundheitsschutz",
}

# Der Rest des Titels, der in der Beschreibung steht und dort weg muss,
# sobald er im Titel ist. Nur diese Wortlaute, nichts Erratenes.
BESCHREIBUNG_REST = {
    "7.3": "Betriebsabläufen",
    "7.3.6": "Bezeichnung Ausbildungsverantwortlicher) für Ausbildungsbetriebe",
    "7.3.7": "Punkt 6.10",
    "7.3.8": "Verbrauchsmaterialien",
    "7.3.9": "Alarmierung",
    "7.3.11": "Partnerorganisationen / Schnittstellen.",
    "7.3.19": "den Gesundheitsschutz",
}


def titel_bereinigen(nummer, titel):
    """Loest die Mindestzahlen vom Titel. Gibt Titel und Mindestzahlen je
    Verfahren zurueck, damit die Anwendung «min. 3 von 5» anzeigen kann,
    statt es im Titel kleben zu lassen."""
    zahlen = re.findall(r"min\.\s*(\d+)", titel or "")
    sauber = re.sub(r"\s*min\.\s*\d+", "", titel or "").strip(" -")
    sauber = TITEL_KORREKTUR.get(nummer, sauber)
    anerkennung = int(zahlen[0]) if len(zahlen) > 0 else None
    erneuerung = int(zahlen[1]) if len(zahlen) > 1 else anerkennung
    return sauber, anerkennung, erneuerung


def beschreibung_bereinigen(nummer, text):
    """Nimmt der Beschreibung den Titelrest weg, der dort nicht hingehoert."""
    text = text_bereinigen(text) or ""
    rest = BESCHREIBUNG_REST.get(nummer)
    if rest and text.startswith(rest):
        text = text[len(rest):].strip()
    return text


def titel_nachziehen(v):
    """Wendet die Korrekturen auf eine bestehende Datenbank an, ohne das
    Register neu einzulesen. Gibt die Zahl der geaenderten Zeilen zurueck."""
    geaendert = 0
    for nummer, titel in TITEL_KORREKTUR.items():
        zeile = v.execute("SELECT titel, beschreibung FROM kriterium "
                          "WHERE nummer = ?", (nummer,)).fetchone()
        if not zeile:
            continue
        beschreibung = beschreibung_bereinigen(nummer, zeile["beschreibung"])
        if zeile["titel"] != titel or (zeile["beschreibung"] or "") != beschreibung:
            v.execute("UPDATE kriterium SET titel = ?, beschreibung = ? "
                      "WHERE nummer = ?", (titel, beschreibung, nummer))
            geaendert += 1
    v.commit()
    return geaendert


FUSSZEILE = re.compile(
    r"\s*Richtlinien zur Anerkennung von Rettungsdiensten\s*\d{2}/\d{4}\d*\s*$")


def text_bereinigen(text):
    """Raeumt auf, was beim Auslesen der PDF im Text haengen blieb.

    Zwei Muster, beide mechanisch und darum gefahrlos. Erstens die
    Seitenfusszeile samt Fassung und Seitenzahl, die an zehn Beschreibungen
    klebt und dort als «Rettungsdiensten08/202519» endet. Zweitens die Haken
    der Muss-Soll-Tabellen im Handbuchtext: sie kommen als Wingdings-Glyphe
    aus dem privaten Bereich (U+F052, 33 Stueck) und erscheinen sonst als
    leeres Kaestchen.

    Leerzeichen bleiben unangetastet. Im Handbuchtext sagt ihre Anzahl, ob
    ein Haken in der Muss- oder in der Soll-Spalte steht; wer sie
    zusammenzieht, loescht diese Unterscheidung.

    Was ohne Trennzeichen zusammengelaufen ist, etwa die Beispielliste in
    8.1.4, bleibt stehen: dort waere jede Aufteilung geraten.
    """
    if not text:
        return text
    text = text.replace("\uF020", " ").replace("\uF052", "\u2713")
    return FUSSZEILE.sub("", text).strip()


def verbindung():
    DB.parent.mkdir(parents=True, exist_ok=True)
    v = sqlite3.connect(DB)
    v.row_factory = sqlite3.Row
    v.execute("PRAGMA foreign_keys = ON")
    return v


def sortierschluessel(nummer):
    """6.11.2 muss nach 6.9 kommen, nicht davor. Darum je Stufe als Zahl."""
    teile = [int(t) if t.isdigit() else 0 for t in nummer.split(".")]
    while len(teile) < 3:
        teile.append(0)
    return teile[0] * 10000 + teile[1] * 100 + teile[2]


# Spalten, die spaeter dazukamen. SQLite kennt kein ADD COLUMN IF NOT EXISTS,
# darum der Versuch mit Abfangen. So bleiben erfasste Massnahmen erhalten.
NACHTRAEGE = [
    ("kriterium", "status_2024 TEXT"),
    ("dokument", "endung TEXT"),
    ("dokument", "groesse INTEGER"),
    ("dokument", "ordner TEXT"),
    ("kriterium", "min_anerkennung INTEGER"),
    ("kriterium", "min_erneuerung INTEGER"),
    ("kriterium", "empfehlung_2024 TEXT"),
    ("dokument", "datum TEXT"),
    ("dokument", "datum_herkunft TEXT"),
    # 1 fuer Dateien, die ueber das Werkzeug hochgeladen wurden. Sie
    # ueberleben das Neueinlesen des Dossiers, sonst waeren sie beim
    # naechsten Einlesen aus der Datenbank verschwunden, obwohl sie im
    # Dossier liegen.
    ("dokument", "eigen INTEGER DEFAULT 0"),
    ("beschwerde", "nr INTEGER"),
    ("beschwerde", "datum TEXT"),
    ("beschwerde", "protokoll INTEGER DEFAULT 0"),
    ("beschwerde", "dateien INTEGER"),
    ("beschwerde", "notiz TEXT"),
    # Die fachliche Bewertung eines Falls. Sie entscheidet, welche Massnahme
    # folgt: ein Fehler im Ablauf verlangt eine andere Antwort als eine
    # enttaeuschte Erwartung bei korrekter Behandlung.
    ("beschwerde", "mitarbeitende TEXT"),
    ("beschwerde", "medizinisch TEXT"),
    ("beschwerde", "transport TEXT"),
    ("beschwerde", "aus_nichttransport INTEGER DEFAULT 0"),
    ("beschwerde", "angehoerige_aufgebracht INTEGER DEFAULT 0"),
    ("beschwerde", "bewertung TEXT"),
    ("beschwerde", "massnahme_noetig INTEGER DEFAULT 0"),
    # Ein Bereich kann mehrere Stränge führen, die getrennt zu messen sind.
    # Bei 8.1.4 sind das die Befragung des Partnerspitals und die der
    # Mitarbeitenden: verschiedene Zielgruppen, verschiedene Skalen,
    # verschiedene Kreisläufe.
    ("massnahme", "strang TEXT"),
    # Eine Fortführung: der Ausgangswert der neuen Runde ist die Nachmessung
    # der alten. So bleibt die Kette über Jahre nachvollziehbar, und das ist
    # genau das, was beim Prüfbesuch die Entwicklung belegt.
    ("massnahme", "vorgaenger INTEGER"),
    # Die zwei Phasen, die DMAIC gegenueber Messung-Massnahme-Nachmessung
    # zusaetzlich verlangt: Define (Problem und Ziel) und Analyze (die
    # Ursache). Leer bei allem, was vor dem 15.09.2026 erfasst wurde.
    ("massnahme", "definition TEXT"),
    ("massnahme", "analyse TEXT"),
    # Woher ein Thema stammt: leer heisst von Hand, «emris» heisst aus dem
    # Export gerechnet und beim naechsten Export ersetzt.
    ("thema", "quelle TEXT"),
    # Ein Mangel aus dem Expertenbericht, den der Betrieb behoben hat. Der
    # Bericht bleibt unveraendert; behoben ist die Antwort darauf.
    ("kriterium", "behoben_am TEXT"),
    ("kriterium", "behoben_von TEXT"),
]


# Fuenf Punkte, die das Auslesen der PDF nicht als Kriterien erkannt hat,
# zu denen das Dossier aber Ordner fuehrt.
#
# 5.2.1 bis 5.2.4 sind die Antragsunterlagen nach Kapitel 5.2 des
# IVR-Handbuchs: «Folgende Unterlagen müssen mit dem Anerkennungsgesuch an
# die Geschäftsstelle IVR eingereicht werden.» Sie stehen dort nicht in der
# Kriterientabelle mit Muss- und Sollspalten, verlangt sind sie trotzdem,
# und zwar bei der Erneuerung so gut wie bei der Erstanerkennung.
#
# 7.4.1 steht in der Kriterientabelle der Richtlinie, als Soll bei beiden
# Verfahren; beim Auslesen ist es durchgefallen, weil die Zeile im PDF zu
# den Aufzaehlungspunkten von 7.4 gehoert.
ZUSATZKRITERIEN = [
    {
        "nummer": "5.2.1", "kapitel": "Antrag",
        "titel": "Bewilligung der zuständigen Behörde",
        "muss": True,
        "beschreibung":
            "Eines dieser Dokumente ist einzureichen: Kopie der Bewilligung "
            "der zuständigen Behörde, Kopie der Leistungsvereinbarung, "
            "Vertrag mit der zuständigen Behörde oder deren Bestätigung.",
        "nachweise": ["Bewilligung der zuständigen Behörde",
                      "Leistungsvereinbarung", "Vertrag mit der Behörde",
                      "Bestätigung der Behörde"],
    },
    {
        "nummer": "5.2.2", "kapitel": "Antrag",
        "titel": "Organigramm des Rettungsdienstes",
        "muss": True,
        "beschreibung":
            "Im Organigramm sind alle Funktionen aufgeführt: die ärztliche "
            "und die fachliche Leitung, die organisatorischen Einheiten und "
            "ihre Unterstellung sowie Funktion und Amt einzelner "
            "Mitarbeitender, etwa QM, Material und Fortbildung.",
        "nachweise": ["Organigramm"],
    },
    {
        "nummer": "5.2.3", "kapitel": "Antrag",
        "titel": "Vorstellung des Rettungsdienstes",
        "muss": True,
        "beschreibung":
            "Die Experten sollen sich ein umfassendes Bild vom Betrieb "
            "machen können: historische Entwicklung, Informationsbroschüre, "
            "Werbeunterlagen, der Inhalt des Internetauftritts oder ein "
            "eigens für das Dossier geschriebener Text.",
        "nachweise": ["Betriebsvorstellung", "Informationsbroschüre",
                      "Internetauftritt"],
    },
    {
        "nummer": "5.2.4", "kapitel": "Antrag",
        "titel": "Jahresberichte der vergangenen zwei Jahre mit Einsatzstatistik",
        "muss": True,
        "beschreibung":
            "Je Bericht: Jahresrückblick, Bericht der Betriebsleitung und "
            "der ärztlichen Leitung, Bericht des Ausbildungsverantwortlichen, "
            "Angaben zu Mitarbeitenden und Einsatzgebiet, Qualitätssicherung "
            "und Entwicklung, dazu die Statistik mit Einsatzzahlen nach "
            "Dringlichkeit gemäss Kriterium 7.2.",
        "nachweise": ["Jahresbericht", "Einsatzstatistik"],
    },
    {
        "nummer": "7.4.1", "kapitel": "Prozess",
        "titel": "Therapeutische Intervallberechnung",
        "muss": False,
        "beschreibung":
            "Zusätzlich zur Zeiterfassung nach 7.4 werden der Zeitpunkt des "
            "ersten Patientenkontakts und der Zeitpunkt der Patientenübergabe "
            "erfasst. Daraus werden Hilfsfrist Rettungsdienst, "
            "Gesamthilfsfrist, Interventionszeit und Zeit vor Ort berechnet.",
        "nachweise": ["Einsatzprotokoll mit den Zeitstempeln",
                      "Auswertung der Intervalle"],
    },
]


def zusatzkriterien_setzen(v):
    """Traegt die fehlenden Punkte ein, ohne bestehende zu ueberschreiben.

    Laeuft beim Start und beim Neueinlesen. Titel und Text werden
    nachgefuehrt, der Stand von 2024 und behobene Maengel nicht: die
    gehoeren dem Betrieb und nicht der Richtlinie.
    """
    for k in ZUSATZKRITERIEN:
        muss = int(bool(k["muss"]))
        v.execute(
            """INSERT INTO kriterium (nummer, titel, kapitel, beschreibung,
                   anerkennung_muss, anerkennung_soll, erneuerung_muss,
                   erneuerung_soll, nachweise, sortierung, status_2024)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT(nummer) DO UPDATE SET
                   titel = excluded.titel, kapitel = excluded.kapitel,
                   beschreibung = excluded.beschreibung,
                   nachweise = excluded.nachweise""",
            (k["nummer"], k["titel"], k["kapitel"], k["beschreibung"],
             muss, 1 - muss, muss, 1 - muss,
             json.dumps(k["nachweise"], ensure_ascii=False),
             sortierschluessel(k["nummer"]), "erfüllt"))
    v.commit()


def belege_nachziehen(v):
    """Haengt Dossierdateien an Kriterien, die es beim Einlesen noch nicht
    gab. Der erste Teil des Pfades ist der Ordner, seine Nummer das
    Kriterium: «5.02.01 Bewilligung …» gehoert zu 5.2.1."""
    bekannt = {r["nummer"] for r in v.execute("SELECT nummer FROM kriterium")}
    schon = {r["dokument"] for r in v.execute("SELECT dokument FROM beleg")}
    neu = 0
    for d in v.execute("SELECT id, pfad FROM dokument"):
        if d["id"] in schon or not d["pfad"]:
            continue
        nummer = _nummer_aus_ordner(str(d["pfad"]).replace("\\", "/").split("/")[0])
        if nummer and nummer in bekannt:
            v.execute("INSERT OR IGNORE INTO beleg (kriterium, dokument) "
                      "VALUES (?,?)", (nummer, d["id"]))
            neu += 1
    v.commit()
    return neu


def _nummer_aus_ordner(name):
    """«7.03.10 Hygiene» wird zu «7.3.10». Fuehrende Nullen muessen weg,
    sonst findet die Zuordnung das Kriterium nicht. Dieselbe Regel wie in
    dossier-einlesen.py."""
    treffer = re.match(r"^(\d+(?:\.\d+)*)", (name or "").strip())
    if not treffer:
        return None
    teile = [str(int(t)) for t in treffer.group(1).split(".")]
    if len(teile) < 2:
        return None
    return ".".join(teile)


def nachziehen(v):
    for tabelle, spalte in NACHTRAEGE:
        try:
            v.execute(f"ALTER TABLE {tabelle} ADD COLUMN {spalte}")
        except sqlite3.OperationalError:
            pass  # Spalte ist schon da
    pfade_eindeutig(v)
    v.commit()


def pfade_eindeutig(v):
    """Sorgt dafuer, dass es je Datei nur eine Zeile gibt.

    «pfad TEXT UNIQUE» steht im Schema, aber die Tabelle ist aelter als
    die Zeile, und CREATE TABLE IF NOT EXISTS aendert eine bestehende
    Tabelle nicht. Ein nachtraeglicher Index holt das nach. Doppelte
    muessen vorher weg, sonst entsteht er nicht; behalten wird die
    hochgeladene Zeile, sonst die aeltere.
    """
    for z in v.execute("""SELECT pfad FROM dokument WHERE pfad IS NOT NULL
                          GROUP BY pfad HAVING COUNT(*) > 1""").fetchall():
        behalten = v.execute(
            "SELECT id FROM dokument WHERE pfad = ? "
            "ORDER BY eigen DESC, id ASC LIMIT 1", (z["pfad"],)).fetchone()["id"]
        v.execute("""DELETE FROM beleg WHERE dokument IN
                     (SELECT id FROM dokument WHERE pfad = ? AND id <> ?)""",
                  (z["pfad"], behalten))
        v.execute("DELETE FROM dokument WHERE pfad = ? AND id <> ?",
                  (z["pfad"], behalten))
    v.execute("CREATE UNIQUE INDEX IF NOT EXISTS dokument_pfad "
              "ON dokument(pfad)")


def anlegen(register_pfad):
    v = verbindung()
    v.executescript(SCHEMA)
    nachziehen(v)

    with open(register_pfad, encoding="utf-8") as f:
        register = json.load(f)

    for k in register["kriterien"]:
        titel, min_a, min_e = titel_bereinigen(k["nummer"], k["titel"])
        v.execute(
            """INSERT INTO kriterium (nummer, titel, kapitel, seite,
                   beschreibung, anerkennung_muss, anerkennung_soll,
                   erneuerung_muss, erneuerung_soll, handbuch, nachweise,
                   sortierung)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT(nummer) DO UPDATE SET
                   titel=excluded.titel, handbuch=excluded.handbuch,
                   beschreibung=excluded.beschreibung,
                   nachweise=excluded.nachweise""",
            (
                k["nummer"], titel,
                k["kapitel"], k.get("seite"),
                beschreibung_bereinigen(k["nummer"], k.get("beschreibung")),
                int(bool(k.get("anerkennung_muss"))),
                int(bool(k.get("anerkennung_soll"))),
                int(bool(k.get("erneuerung_muss"))),
                int(bool(k.get("erneuerung_soll"))),
                text_bereinigen(k.get("handbuch")),
                json.dumps(k.get("moegliche_nachweise") or [], ensure_ascii=False),
                sortierschluessel(k["nummer"]),
            ),
        )
        v.execute(
            "UPDATE kriterium SET min_anerkennung = ?, min_erneuerung = ? "
            "WHERE nummer = ?", (min_a, min_e, k["nummer"]))

    zusatzkriterien_setzen(v)

    for schluessel, wert in VORGABEN.items():
        v.execute(
            "INSERT INTO einstellung (schluessel, wert) VALUES (?,?) "
            "ON CONFLICT(schluessel) DO NOTHING",
            (schluessel, wert),
        )

    v.commit()
    anzahl = v.execute("SELECT COUNT(*) FROM kriterium").fetchone()[0]
    v.close()
    return anzahl


# Expertenbericht vom 03.04.2024, Marengo und Bildstein. 46 Kriterien
# erfüllt, die Lücke liegt fast vollstaendig in Kapitel 8. Was hier nicht
# steht, war erfüllt.
STATUS_2024 = {
    "6.9": "Auflage",
    "6.10": "nicht erfüllt",
    "8.1": "nicht erfüllt",
    "8.1.1": "nicht erfüllt",
    "8.1.2": "nicht erfüllt",
    "8.1.3": "nicht beurteilbar",
    "8.1.4": "nicht erfüllt",
    "8.1.5": "nicht beurteilbar",
    "7.9": "nicht anwendbar",
}


def expertenbericht_setzen(v):
    v.execute("UPDATE kriterium SET status_2024 = 'erfüllt'")
    for nummer, status in STATUS_2024.items():
        v.execute("UPDATE kriterium SET status_2024 = ? WHERE nummer = ?",
                  (status, nummer))
    v.commit()


def nachweise_laden(pfad):
    """Uebernimmt die Dateiliste aus dossier-einlesen.py.

    Bewusst ohne Aussage zur Aktualitaet: das Dateidatum ist nach dem
    Kopieren aus SharePoint wertlos. Was zaehlt, ist der Ablageordner,
    also Fertig, In Bearbeitung oder Alt.
    """
    v = verbindung()
    nachziehen(v)
    with open(pfad, encoding="utf-8") as f:
        dokumente = json.load(f)

    bekannt = {r["nummer"] for r in v.execute("SELECT nummer FROM kriterium")}
    # Was ueber das Werkzeug hochgeladen wurde, bleibt. Die Dateiliste
    # entsteht beim Durchgehen des Ordners; eine Datei, die seither
    # dazukam, stuende darin nicht und waere sonst weg.
    v.execute("""DELETE FROM beleg WHERE dokument IN
                 (SELECT id FROM dokument WHERE eigen IS NULL OR eigen = 0)""")
    v.execute("DELETE FROM dokument WHERE eigen IS NULL OR eigen = 0")

    zugeordnet = 0
    for d in dokumente:
        zeiger = v.execute(
            """INSERT OR IGNORE INTO dokument (titel, pfad, status, endung,
                   groesse, ordner, datum, datum_herkunft)
               VALUES (?,?,?,?,?,?,?,?)""",
            (d["titel"], d["pfad"], d["status"], d.get("endung"),
             d.get("groesse"), d.get("ordner"), d.get("datum"),
             d.get("datum_herkunft")))
        # Eine hochgeladene Datei steht jetzt auch in der Liste: dann gilt
        # die Zeile, die schon da ist.
        kennung = zeiger.lastrowid if zeiger.rowcount else None
        if kennung is None:
            vorhanden = v.execute("SELECT id FROM dokument WHERE pfad = ?",
                                  (d["pfad"],)).fetchone()
            kennung = vorhanden["id"] if vorhanden else None
        if kennung is not None and d.get("kriterium") in bekannt:
            v.execute("INSERT OR IGNORE INTO beleg (kriterium, dokument) "
                      "VALUES (?,?)", (d["kriterium"], kennung))
            zugeordnet += 1

    expertenbericht_setzen(v)
    v.commit()
    zugeordnet += belege_nachziehen(v)
    belegte = v.execute("SELECT COUNT(DISTINCT kriterium) FROM beleg").fetchone()[0]
    v.close()
    return len(dokumente), zugeordnet, belegte


def expertenbericht_laden(pfad):
    """Uebernimmt Status und Empfehlungen aus dem ausgelesenen Bericht.

    Der Bericht ist die Quelle, nicht eine von Hand gepflegte Tabelle. Die
    Empfehlungen stehen nirgends sonst und sagen genauer als jedes «nicht
    erfuellt», was zu tun ist.
    """
    v = verbindung()
    nachziehen(v)
    with open(pfad, encoding="utf-8") as f:
        bericht = json.load(f)

    bekannt = {r["nummer"] for r in v.execute("SELECT nummer FROM kriterium")}
    gesetzt = empfehlungen = 0
    for nummer, b in bericht["kriterien"].items():
        if nummer not in bekannt:
            continue  # Gliederungspunkte des Berichts wie 3.1
        if b.get("status"):
            v.execute("UPDATE kriterium SET status_2024 = ? WHERE nummer = ?",
                      (b["status"], nummer))
            gesetzt += 1
        if b.get("empfehlung"):
            v.execute("UPDATE kriterium SET empfehlung_2024 = ? WHERE nummer = ?",
                      (b["empfehlung"], nummer))
            empfehlungen += 1

    # 7.9 betrifft die Helikopterbesatzung. Der Bericht führt es als erfüllt,
    # der Betrieb hat keinen Helikopter; für die Arbeitsliste ist es nicht
    # anwendbar.
    v.execute("UPDATE kriterium SET status_2024 = 'nicht anwendbar' "
              "WHERE nummer = '7.9'")
    v.commit()
    v.close()
    return gesetzt, empfehlungen


def beschwerden_laden(pfad):
    """Uebernimmt die Faelle aus der Ablage, bewusst ohne Personendaten.

    In den Ordnernamen der Ablage stehen Namen und Geburtsdaten von
    Patientinnen und Patienten. Die bleiben dort. Die Anwendung fuehrt eine
    Fallnummer, das Datum, die Kategorie und den Bearbeitungsstand; das ist
    alles, was das IVR sehen will, und es ist alles, was ein Werkzeug auf
    einem Server ohne Berechtigungskonzept fuehren darf.
    """
    v = verbindung()
    nachziehen(v)
    with open(pfad, encoding="utf-8") as f:
        daten = json.load(f)

    v.execute("DELETE FROM beschwerde")
    for fall in daten["faelle"]:
        notiz = []
        if fall.get("nur_mail"):
            notiz.append("nur E-Mail abgelegt")
        if fall.get("dateien") == 0:
            notiz.append("leerer Ordner")
        v.execute(
            """INSERT INTO beschwerde (nr, datum, eingang, kategorie, stand,
                   protokoll, dateien, notiz)
               VALUES (?,?,?,?,?,?,?,?)""",
            (fall["nr"], fall.get("datum"), daten.get("kategorie", ""),
             None, "eingegangen" if not fall.get("protokoll") else "in Bearbeitung",
             int(bool(fall.get("protokoll"))), fall.get("dateien"),
             ", ".join(notiz) or None))
    v.commit()
    anzahl = v.execute("SELECT COUNT(*) FROM beschwerde").fetchone()[0]
    v.close()
    return anzahl


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "beschwerden":
        pfad = sys.argv[2] if len(sys.argv) > 2 else "daten/beschwerden.json"
        print(f"{beschwerden_laden(pfad)} Fälle übernommen, ohne Personendaten")
    elif len(sys.argv) > 1 and sys.argv[1] == "bericht":
        pfad = sys.argv[2] if len(sys.argv) > 2 else "daten/expertenbericht.json"
        g, e = expertenbericht_laden(pfad)
        print(f"{g} Statuswerte, {e} Empfehlungen übernommen")
    elif len(sys.argv) > 1 and sys.argv[1] == "nachweise":
        pfad = sys.argv[2] if len(sys.argv) > 2 else "daten/nachweise.json"
        gesamt, zu, belegte = nachweise_laden(pfad)
        print(f"{gesamt} Dateien, {zu} zugeordnet, {belegte} Kriterien belegt")
    else:
        quelle = sys.argv[1] if len(sys.argv) > 1 else "daten/register.json"
        print(f"{anlegen(quelle)} Kriterien in {DB}")
