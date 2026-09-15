# IVR-Anerkennung

Ein Werkzeug für das Anerkennungsverfahren eines Rettungsdienstes nach den
Richtlinien des Interverbands für Rettungswesen. Es führt das Dossier, das
Betriebshandbuch und die Qualitätskreisläufe an einem Ort und beantwortet
jederzeit die Frage, die vor dem Besuch der Expertinnen und Experten zählt:
**Was fehlt noch, und bis wann?**

Gebaut für den Ambulanz- und Rettungsdienst Grenchen, aber nicht auf ihn
zugeschnitten. Die Kriterien, die Fristen, die tragenden Monitoringbereiche
und der Vorgehenszyklus sind Einstellungen, keine Annahmen im Code.

## Was es kann

**Übersicht.** Alle Kriterien nach Struktur, Prozess und Ergebnis, mit dem
Stand aus dem letzten Expertenbericht, den Nachweisen im Dossier und der
Restzeit bis zu den drei Fristen: Antrag, vollständiges Dossier, Ablauf der
Anerkennung. Dazu der berechnete letzte sinnvolle Starttag für einen
Qualitätskreislauf, denn Messung, Massnahme und Nachmessung brauchen Zeit.

**Prozesslandkarte.** Führungs-, Kern- und Unterstützungsprozesse als Karte,
jeder Teilprozess mit den Kriterien, die er deckt. Lücken werden sichtbar,
statt unbemerkt zu bleiben.

**Betriebshandbuch.** Je Kriterium die Dokumente, die im Betrieb gelten, mit
Version, letzter Bestätigung und nächster Prüfung. Volltextsuche über
Kriterien, Richtlinientext und den Inhalt der abgelegten Dateien. Dateien
aus dem Dossier lassen sich ins Handbuch aufnehmen, ohne sie zu kopieren.

**Prüfdatum.** Jede Datei des Dossiers trägt, wann sie zuletzt jemand
angeschaut und als aktuell befunden hat. Geprüft heisst freigegeben: die
Datei wandert dabei in den Ordner «Fertig», denn beim Prüfbesuch zählt nur,
was dort liegt. Bis zum Einreichen soll das für jede Datei zutreffen, und
die Übersicht sagt, wie weit das ist.

**Qualitätskreisläufe nach 8.1.** Fünf Monitoringbereiche, davon drei
tragend zur Erneuerung. Je Bereich beliebig viele Kreisläufe, wahlweise als
PDCA mit drei Schritten oder als DMAIC nach Six Sigma mit fünf. Ein
Kreislauf ist erst geschlossen, wenn die Nachmessung die Wirksamkeit belegt,
und genau das prüft das IVR.

**Beschwerdemanagement.** Fälle mit Weg, Kategorie, fachlicher Beurteilung
und Bewertung, mit Anhängen, ausgewertet nach Jahr und Kategorie.

**Auflagen und Mängel.** Was der Expertenbericht bemängelt hat, was daraus
wurde, und die Auflagen aus dem Verfahren mit ihren Fristen. Sichtbar auf
der Übersicht, in der Landkarte und im Handbuch.

**Rechte.** Drei Stufen. Lesen sieht alles. Schreiben erfasst und legt
Dateien ab. Verwalten prüft, setzt Prüfdaten, nimmt Dokumente ins Handbuch
und führt die Benutzerkonten.

## Technik

Python 3.11, FastAPI, Uvicorn, Jinja2, SQLite. Kein Frontend-Baukasten, kein
Bauschritt: die Vorlagen werden ausgeliefert, wie sie dastehen. Die
Diagramme sind selbst gezeichnetes SVG, keine Bibliothek.

```
anwendung/
  app.py          die Wege und die Seiten
  datenbank.py    Schema, Kriterien, Einlesen der Nachweisliste
  handbuch.py     Dokumente, Prüfdaten, Dossierablage
  dossier.py      den Dossierordner durchgehen
  landkarte.py    die Prozesslandkarte
  diagramme.py    Ringe, Balken, Zeitstrahl, Kuchen als SVG
  anmeldung.py    Konten, Sitzung, Rechte
  listen.py       Listen und Dateiannahme
  emris.py        Ereignismeldungen aus dem Export
  anhaenge.py     Anhänge an Beschwerdefällen
  vorlagen/       Jinja2-Vorlagen
demo/
  demo-daten.py   baut eine Demodatenbank mit erfundenen Daten
  kriterien.json  Nummer, Titel und Kapitel der Kriterien
```

Die Daten liegen neben der Anwendung und nicht darin:

```
daten/            SQLite-Datenbank, Konten, Listen, Anhänge
IVR Dokumente/    das Dossier, ein Ordner je Kriterium
```

Beides steht in `.gitignore`. Was ein Betrieb erfasst, gehört ihm und nicht
in ein Repository.

## Starten

```
python -m venv venv
venv/bin/pip install -r requirements-server.txt
cd anwendung
python ../demo/demo-daten.py
../venv/bin/uvicorn app:app --port 8000
```

Danach `http://localhost:8000`, Anmeldung `demo` mit `demo-ansehen`.

Für den Einsatz in einem Betrieb wird statt der Demodaten der eigene
Dossierordner eingelesen, in den Einstellungen mit «Dossier neu einlesen»
oder auf der Kommandozeile mit `python dossier-einlesen.py`. Die Kriterien
kommen aus einer Registerdatei `daten/register.json`, die aus der
Richtlinie des IVR erzeugt wird; sie gehört dem IVR und liegt deshalb nicht
im Repository.

## Betrieb

Läuft als systemd-Dienst, im Einsatz hinter einem Cloudflare-Tunnel. Eine
Vorlage für die Unit liegt in `betrieb/`. Zwei Umgebungsvariablen legen
fest, wo die Daten liegen, falls nicht neben der Anwendung:

| Variable | Bedeutung |
|---|---|
| `IVR_DATEN` | Datenbank, Konten, Listen, Anhänge |
| `IVR_DOSSIER` | der Dossierordner, ein Unterordner je Kriterium |
| `IVR_TUERWAECHTER` | Name des Zugangsschutzes davor, für die Anmeldemaske |
| `IVR_DEMO` | zeigt in der Anmeldemaske die Zugangsdaten der Demo |
| `IVR_BASIS` | Pfad, unter dem die Anwendung liegt, statt auf der Wurzel |

Das erste Konto wird einmalig angelegt:

```
python anmeldung.py konto michi "Vorname Name" verwalten
```

Danach führt die Verwaltung die Konten in den Einstellungen. Die
Betriebsdokumentation einer konkreten Anlage gehört zu dieser Anlage und
nicht hierher.

## Demo

Eine Fassung mit erfundenen Daten, ohne jeden Bezug zu einem echten Betrieb.
Der Betrieb heisst «Rettungsdienst Musterstadt», Fälle und Messwerte sind
ausgedacht, die Erläuterungen aus der Richtlinie fehlen bewusst.

Sie läuft unter `thomato.ch/ivr-anerkennung/demo`, im selben Projekt wie
die Website. Der Einstieg dafür ist `web/api/demo.py`: er setzt die
Datenpfade auf den einzigen beschreibbaren Ordner, baut die Demodaten beim
ersten Aufruf und lädt die Anwendung. Dass die Instanz irgendwann endet,
ist dabei das Zurücksetzen und braucht keinen Zeitgeber.

Weil die Demo nicht auf der Wurzel einer Adresse liegt, sondern unter einem
Pfad, legt sich `anwendung/praefix.py` davor: sie schneidet den Pfad von
jeder Anfrage ab und setzt ihn in den Verweisen und Umleitungen wieder ein.
Angeschaltet wird das mit `IVR_BASIS`. Auf einer eigenen Adresse bleibt die
Variable leer und es geschieht nichts.

Lokal ausprobieren:

```
cd web
IVR_ABLAGE=/tmp/ivr-demo python -m uvicorn api.demo:app --port 8012
```

Danach `http://127.0.0.1:8012/ivr-anerkennung/demo`.

## Stand

In Betrieb seit September 2026. Entstanden neben dem Dienst, für ein
Verfahren, das 2028 zur Erneuerung ansteht.
