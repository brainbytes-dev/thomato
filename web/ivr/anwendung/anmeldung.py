"""Die zweite Tuer vor dem Handbuch, und wer dahinter was darf.

Cloudflare Access laesst nur freigeschaltete Adressen bis zum Haus. Das ist
ein Einmalcode im Postfach — etwas, das man empfaengt. Hier steht die zweite
Tuer und fragt nach etwas, das man weiss. Erst beide zusammen sind zwei
Faktoren; ein Postfach allein ist einer.

Hinter der Tuer gibt es drei Stufen: Lesen sieht alles, Schreiben erfasst
und legt ab, Verwalten fuehrt dazu die Benutzer. Die Stufe steht bei jedem
Konto in anmeldung.json und wird bei jeder Anfrage nachgesehen, nicht im
Sitzungskeks mitgefuehrt: wer herabgestuft oder entfernt wird, merkt es mit
dem naechsten Klick.

Alles Noetige steckt in der Standardbibliothek: scrypt fuer das Passwort,
HMAC fuer den Sitzungskeks. Keine weitere Abhaengigkeit fuer ein Schloss.
"""

import hashlib
import hmac
import json
import os
import re
import secrets
import time
from pathlib import Path

from fastapi import Form, Request
from fastapi.responses import RedirectResponse
import pfade

# Die Datei liegt bei den uebrigen Daten der Anwendung und traegt den
# Sitzungsschluessel. Nur der Dienst darf sie lesen, deshalb 0600.
DATEI = pfade.daten("anmeldung.json")

KEKS = "ivr_anmeldung"
SITZUNG = 12 * 3600          # Ein Arbeitstag, danach neu anmelden.
OFFEN = ("/anmeldung", "/abmeldung", "/gesundheit")

# scrypt braucht 128 * N * r Byte, hier 16 MiB. Das ist der Sinn der Sache:
# Ausprobieren kostet Arbeitsspeicher, nicht nur Rechenzeit.
_N, _R, _P = 2 ** 14, 8, 1

# Die drei Stufen, aufsteigend. Wer eine hoehere hat, hat die tieferen mit.
RECHTE = [
    ("lesen", "Lesen"),
    ("schreiben", "Schreiben"),
    ("verwalten", "Verwalten"),
]
RANG = {recht: stufe for stufe, (recht, _) in enumerate(RECHTE)}
RECHT_NAME = dict(RECHTE)

# Die Grundausstattung ist leer, und das mit Absicht: Namen gehoeren nicht
# in den Quelltext. Wer sie dort einträgt, verteilt sie mit jeder Kopie
# weiter, und in einer Demo stehen dann fremde Personen unter «Benutzer».
#
# Das erste Konto wird ausdruecklich angelegt:
#
#     python anmeldung.py konto <kennung> "<Name>" verwalten
#
# Danach fuehrt die Verwaltung die Konten in den Einstellungen. Fehlende
# Werte eines bestehenden Kontos werden weiterhin aufgefuellt.
BELEGSCHAFT = {}

# Eine Kennung ist ein Wort in Kleinbuchstaben, wie man es tippt, ohne
# nachzudenken: vorname, oder vorname.nachname.
KENNUNG_MUSTER = re.compile(r"^[a-z][a-z0-9._-]{1,30}$")

# Fehlversuche je Kennung. Nach fuenf Fehlgriffen eine Minute Ruhe. Das
# steht im Arbeitsspeicher und ist nach einem Neustart weg — es soll
# Ausprobieren bremsen, nicht buchhalten.
_fehlgriffe = {}
SPERRE_AB = 5
SPERRE_DAUER = 60


def _laden():
    neu = not DATEI.exists()
    if neu:
        daten = {"schluessel": secrets.token_hex(32), "benutzer": {}}
    else:
        with DATEI.open(encoding="utf-8") as f:
            daten = json.load(f)
    for kennung, (name, recht) in BELEGSCHAFT.items():
        b = daten["benutzer"].setdefault(kennung, {})
        b.setdefault("name", name)
        b.setdefault("recht", recht)
    # Konten aus der Zeit vor den Stufen: die hatten alles, also Schreiben.
    for b in daten["benutzer"].values():
        b.setdefault("recht", "schreiben")
    if neu:
        _sichern(daten)
    return daten


def _sichern(daten):
    DATEI.parent.mkdir(parents=True, exist_ok=True)
    vorlaeufig = DATEI.with_suffix(".json.neu")
    with vorlaeufig.open("w", encoding="utf-8") as f:
        json.dump(daten, f, ensure_ascii=False, indent=2)
    # Rechte und Eigentuemer gibt es so nur auf unixartigen Systemen;
    # unter Windows laeuft die Datei ueber die Rechte des Ordners.
    if hasattr(os, "chmod"):
        try:
            os.chmod(vorlaeufig, 0o600)
        except (OSError, NotImplementedError):
            pass
    # Das Werkzeug auf der Kommandozeile laeuft als root, der Dienst als
    # eigener Benutzer. Ohne diese Zeile schreibt ein Passwortwechsel die
    # Datei fuer den Dienst unlesbar.
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        eigner = DATEI.parent.stat()
        os.chown(vorlaeufig, eigner.st_uid, eigner.st_gid)
    os.replace(vorlaeufig, DATEI)


def _streuwert(passwort, salz):
    roh = hashlib.scrypt(passwort.encode("utf-8"), salt=salz,
                         n=_N, r=_R, p=_P, dklen=32)
    return roh.hex()


def hat_passwort(kennung):
    b = _laden()["benutzer"].get(kennung)
    return bool(b and b.get("streuwert"))


def passwort_setzen(kennung, passwort):
    """Setzt oder ersetzt ein Passwort. Ruft auch das Werkzeug auf der
    Kommandozeile auf, wenn jemand seines vergessen hat."""
    if len(passwort) < 10:
        raise ValueError("Das Passwort braucht mindestens zehn Zeichen.")
    daten = _laden()
    if kennung not in daten["benutzer"]:
        raise KeyError(kennung)
    salz = secrets.token_bytes(16)
    daten["benutzer"][kennung]["salz"] = salz.hex()
    daten["benutzer"][kennung]["streuwert"] = _streuwert(passwort, salz)
    daten["benutzer"][kennung]["gesetzt"] = time.strftime("%Y-%m-%d %H:%M")
    _sichern(daten)


def passwort_loeschen(kennung):
    """Nimmt das Passwort weg. Bei der naechsten Anmeldung darf die Person
    ein neues setzen — der Weg zurueck, wenn eines vergessen wurde."""
    daten = _laden()
    if kennung not in daten["benutzer"]:
        raise KeyError(kennung)
    daten["benutzer"][kennung].pop("salz", None)
    daten["benutzer"][kennung].pop("streuwert", None)
    daten["benutzer"][kennung].pop("gesetzt", None)
    _sichern(daten)


def passwort_stimmt(kennung, passwort):
    b = _laden()["benutzer"].get(kennung)
    if not b or not b.get("streuwert"):
        return False
    versuch = _streuwert(passwort, bytes.fromhex(b["salz"]))
    return hmac.compare_digest(versuch, b["streuwert"])


def passwort_aendern(kennung, aktuell, neu, wiederholung):
    """Die Person aendert ihr eigenes Passwort. Das alte muss stimmen,
    solange eines gesetzt ist; sonst koennte ein offen gelassener Browser
    das Konto uebernehmen."""
    if hat_passwort(kennung) and not passwort_stimmt(kennung, aktuell):
        raise ValueError("Das aktuelle Passwort stimmt nicht.")
    if neu != wiederholung:
        raise ValueError("Die beiden neuen Passwörter sind nicht gleich.")
    passwort_setzen(kennung, neu)


# --- Benutzer und Rechte ---------------------------------------------------

def recht_von(kennung):
    b = _laden()["benutzer"].get(kennung) or {}
    return b.get("recht", "lesen")


def darf(kennung, noetig):
    """Reicht die Stufe des Kontos fuer das Verlangte?"""
    if not kennung:
        return False
    return RANG.get(recht_von(kennung), -1) >= RANG[noetig]


def benutzer(kennung):
    b = _laden()["benutzer"].get(kennung)
    if not b:
        return None
    return {
        "kennung": kennung,
        "name": b.get("name", kennung),
        "recht": b.get("recht", "lesen"),
        "recht_name": RECHT_NAME.get(b.get("recht", "lesen"), "Lesen"),
        "gesetzt": b.get("gesetzt"),
        "hat_passwort": bool(b.get("streuwert")),
    }


def benutzer_liste():
    """Alle Konten, die Verwaltenden zuerst, dann nach Name."""
    alle = [benutzer(k) for k in _laden()["benutzer"]]
    return sorted(alle, key=lambda b: (-RANG[b["recht"]], b["name"].lower()))


def erstes_konto(kennung, name, recht="verwalten", passwort=None):
    """Legt ein Konto an, ohne dass jemand angemeldet sein muss. Fuer die
    erste Einrichtung und fuer die Demo."""
    benutzer_anlegen(kennung, name, recht)
    if passwort:
        passwort_setzen(kennung, passwort)
    return kennung


# Eine oeffentliche Demo zeigt ihre Zugangsdaten in der Maske an; eine
# Anlage im Betrieb tut das nie. Der Tuerwaechter ist der Dienst, der
# davorsteht, falls einer davorsteht.
DEMO = bool(os.environ.get("IVR_DEMO"))
TUERWAECHTER = os.environ.get("IVR_TUERWAECHTER", "")


def _betrieb():
    """Der Name des Betriebs aus den Einstellungen, fuer die Anmeldemaske.
    Sie ist die einzige Seite ohne Grundgeruest und holt ihn selbst."""
    try:
        import datenbank
        v = datenbank.verbindung()
        z = v.execute("SELECT wert FROM einstellung WHERE schluessel = 'betrieb'"
                      ).fetchone()
        v.close()
        return z["wert"] if z else ""
    except Exception:  # noqa: BLE001 - die Maske muss auch ohne Datenbank kommen
        return ""


def _pruefen_recht(recht):
    if recht not in RANG:
        raise ValueError("Unbekannte Stufe.")


def _letzte_verwaltung(daten, kennung):
    """Waere dieses Konto das letzte mit Verwaltungsrecht? Dann darf es
    weder herabgestuft noch entfernt werden, sonst kommt niemand mehr an
    die Benutzer heran."""
    b = daten["benutzer"].get(kennung) or {}
    if b.get("recht") != "verwalten":
        return False
    return not any(k != kennung and x.get("recht") == "verwalten"
                   for k, x in daten["benutzer"].items())


def benutzer_anlegen(kennung, name, recht):
    kennung = (kennung or "").strip().lower()
    name = " ".join((name or "").split())
    if not KENNUNG_MUSTER.match(kennung):
        raise ValueError("Die Kennung besteht aus Kleinbuchstaben, Ziffern, "
                         "Punkt und Strich, zwei bis 31 Zeichen, und "
                         "beginnt mit einem Buchstaben.")
    if not name:
        raise ValueError("Der Name fehlt.")
    _pruefen_recht(recht)
    daten = _laden()
    if kennung in daten["benutzer"]:
        raise ValueError(f"Die Kennung «{kennung}» gibt es schon.")
    daten["benutzer"][kennung] = {"name": name, "recht": recht}
    _sichern(daten)
    return kennung


def benutzer_aendern(kennung, name, recht):
    name = " ".join((name or "").split())
    if not name:
        raise ValueError("Der Name fehlt.")
    _pruefen_recht(recht)
    daten = _laden()
    if kennung not in daten["benutzer"]:
        raise ValueError("Dieses Konto gibt es nicht.")
    if recht != "verwalten" and _letzte_verwaltung(daten, kennung):
        raise ValueError("Das letzte Konto mit Verwaltungsrecht lässt sich "
                         "nicht herabstufen.")
    daten["benutzer"][kennung]["name"] = name
    daten["benutzer"][kennung]["recht"] = recht
    _sichern(daten)


def benutzer_entfernen(kennung, durch):
    daten = _laden()
    if kennung not in daten["benutzer"]:
        raise ValueError("Dieses Konto gibt es nicht.")
    if kennung == durch:
        raise ValueError("Das eigene Konto lässt sich nicht entfernen.")
    if _letzte_verwaltung(daten, kennung):
        raise ValueError("Das letzte Konto mit Verwaltungsrecht lässt sich "
                         "nicht entfernen.")
    name = daten["benutzer"][kennung].get("name", kennung)
    del daten["benutzer"][kennung]
    _sichern(daten)
    return name


# --- Sitzung ---------------------------------------------------------------

def _zeichnen(kennung, ablauf):
    schluessel = bytes.fromhex(_laden()["schluessel"])
    nachricht = f"{kennung}|{ablauf}"
    unterschrift = hmac.new(schluessel, nachricht.encode("utf-8"),
                            hashlib.sha256).hexdigest()
    return f"{nachricht}|{unterschrift}"


def wer(request):
    """Wer sitzt gerade davor? Kennung oder None. Ein Keks fuer ein Konto,
    das es nicht mehr gibt, zaehlt nicht."""
    keks = request.cookies.get(KEKS)
    if not keks:
        return None
    try:
        kennung, ablauf, unterschrift = keks.split("|")
    except ValueError:
        return None
    if not hmac.compare_digest(_zeichnen(kennung, ablauf), keks):
        return None
    if int(ablauf) < time.time():
        return None
    if kennung not in _laden()["benutzer"]:
        return None
    return kennung


def name_von(kennung):
    b = _laden()["benutzer"].get(kennung) or {}
    return b.get("name", kennung)


def _ueber_https(request):
    """Hinter dem Tunnel kommt https an, im Haus http. Das Merkmal secure
    darf nur im ersten Fall gesetzt werden, sonst schickt der Browser den
    Keks bei einem Aufruf ueber die IP im Haus nie mit."""
    weitergereicht = request.headers.get("x-forwarded-proto", "")
    return "https" in (weitergereicht or request.url.scheme)


def _gesperrt(kennung):
    eintrag = _fehlgriffe.get(kennung)
    if not eintrag:
        return 0
    zahl, letzter = eintrag
    if zahl < SPERRE_AB:
        return 0
    rest = int(letzter + SPERRE_DAUER - time.time())
    return rest if rest > 0 else 0


def _fehlgriff(kennung):
    zahl, _ = _fehlgriffe.get(kennung, (0, 0))
    _fehlgriffe[kennung] = (zahl + 1, time.time())


# Was das Dossier verbindlich macht, macht die Verwaltung. Michael am
# 15.09.2026: «nur der verwalter kann prüfen und überprüfungsdatum setzen
# und ins handbuch aufnehmen.» Eine Datei ablegen darf, wer schreibt; sie
# zum geprueften, geltenden Stand erklaeren nicht.
NUR_VERWALTUNG = (
    "/geprueft",      # eine Dossierdatei ist angeschaut und gilt
    "/prueffrist",    # bis wann sie geprueft sein muss
    "/uebernehmen",   # aus dem Dossier ins Handbuch
    "/bestaetigen",   # ein Handbuchdokument ist geprueft
    "/erinnerung",    # sein Pruefdatum
)


def _noetig_fuer(pfad):
    """Welche Stufe eine schreibende Anfrage an diesen Pfad braucht."""
    if pfad.startswith("/einstellungen/benutzer"):
        return "verwalten"
    if pfad.startswith("/einstellungen/konto"):
        return "lesen"       # das eigene Passwort darf jede Person aendern
    if pfad.endswith(NUR_VERWALTUNG):
        return "verwalten"
    if pfad == "/handbuch/pruefdatum":
        return "verwalten"
    # Ein Dokument aus dem Handbuch nehmen ist die Kehrseite davon, es
    # aufzunehmen. Anhaenge und Listen loescht weiterhin, wer schreibt.
    if pfad.startswith("/handbuch/dokument/") and pfad.endswith("/loeschen"):
        return "verwalten"
    if pfad.startswith("/dossier/") and pfad.endswith("/einlesen"):
        return "verwalten"
    return "schreiben"


def einrichten(app, vorlagen):
    """Haengt Tuer und Formular an die bestehende Anwendung."""

    def _seite(request, **mehr):
        daten = {"fehler": "", "kennung": "", "weiter": "/", "neu": False,
                 "betrieb": _betrieb(), "demo": DEMO,
                 "tuerwaechter": TUERWAECHTER}
        daten.update(mehr)
        return vorlagen.TemplateResponse(request, "anmeldung.html", daten)

    @app.middleware("http")
    async def tuer(request: Request, call_next):
        pfad = request.url.path
        if pfad.startswith(OFFEN):
            return await call_next(request)
        kennung = wer(request)
        if not kennung:
            ziel = pfad
            if request.url.query:
                ziel += "?" + request.url.query
            from urllib.parse import quote
            return RedirectResponse(f"/anmeldung?weiter={quote(ziel, safe='')}",
                                    status_code=303)
        # Lesen darf jede angemeldete Person. Was etwas veraendert, kommt
        # als POST, und dafuer braucht es die passende Stufe.
        if request.method == "POST":
            noetig = _noetig_fuer(pfad)
            if not darf(kennung, noetig):
                # Die Namen duerfen nicht mit den Helfern der Seitenleiste
                # zusammenfallen (recht_name ist dort eine Funktion).
                return vorlagen.TemplateResponse(
                    request, "verweigert.html", {
                        "meine_stufe": RECHT_NAME[recht_von(kennung)],
                        "noetige_stufe": RECHT_NAME[noetig],
                        "zurueck": request.headers.get("referer") or "/",
                        "titel": "Kein Zugriff",
                        "seite": "",
                    }, status_code=403)
        return await call_next(request)

    @app.get("/anmeldung")
    def anmeldeseite(request: Request, weiter: str = "/"):
        if wer(request):
            return RedirectResponse(weiter or "/", status_code=303)
        return _seite(request, weiter=weiter or "/")

    @app.post("/anmeldung")
    def anmelden(request: Request,
                 kennung: str = Form(""),
                 passwort: str = Form(""),
                 wiederholung: str = Form(""),
                 festlegen: str = Form(""),
                 weiter: str = Form("/")):
        kennung = kennung.strip().lower()
        weiter = weiter if weiter.startswith("/") else "/"

        if kennung not in _laden()["benutzer"]:
            _fehlgriff(kennung or "?")
            return _seite(request, weiter=weiter, kennung=kennung,
                          fehler="Benutzer oder Passwort stimmt nicht.")

        rest = _gesperrt(kennung)
        if rest:
            return _seite(request, weiter=weiter, kennung=kennung,
                          fehler=f"Zu viele Versuche. Noch {rest} Sekunden warten.")

        # Erste Anmeldung, zwei Schritte. Im ersten wissen wir noch nicht,
        # dass dieses Konto kein Passwort hat — der Browser schon gar
        # nicht. Was dort getippt wurde, ist deshalb kein Versuch, eines zu
        # setzen: wir bieten das Festlegen erst an. Das Merkmal festlegen
        # unterscheidet die zweite Runde von der ersten.
        if not hat_passwort(kennung):
            if not festlegen:
                return _seite(request, weiter=weiter, kennung=kennung, neu=True)
            if passwort != wiederholung:
                return _seite(request, weiter=weiter, kennung=kennung, neu=True,
                              fehler="Die beiden Passwörter sind nicht gleich.")
            try:
                passwort_setzen(kennung, passwort)
            except ValueError as e:
                return _seite(request, weiter=weiter, kennung=kennung,
                              neu=True, fehler=str(e))
        elif not passwort_stimmt(kennung, passwort):
            _fehlgriff(kennung)
            return _seite(request, weiter=weiter, kennung=kennung,
                          fehler="Benutzer oder Passwort stimmt nicht.")

        _fehlgriffe.pop(kennung, None)
        ablauf = int(time.time()) + SITZUNG
        antwort = RedirectResponse(weiter, status_code=303)
        antwort.set_cookie(KEKS, _zeichnen(kennung, ablauf),
                           max_age=SITZUNG, httponly=True, samesite="lax",
                           secure=_ueber_https(request), path="/")
        return antwort

    @app.get("/abmeldung")
    @app.post("/abmeldung")
    def abmelden():
        antwort = RedirectResponse("/anmeldung", status_code=303)
        antwort.delete_cookie(KEKS, path="/")
        return antwort

    # Damit jede Seite weiss, wer davorsitzt und was die Person darf, ohne
    # dass jede Ansicht es durchreichen muss.
    vorlagen.env.globals["angemeldet_als"] = lambda request: (
        name_von(wer(request)) if wer(request) else "")
    vorlagen.env.globals["recht_name"] = lambda request: (
        RECHT_NAME[recht_von(wer(request))] if wer(request) else "")
    vorlagen.env.globals["darf_schreiben"] = lambda request: darf(
        wer(request), "schreiben")
    vorlagen.env.globals["darf_verwalten"] = lambda request: darf(
        wer(request), "verwalten")


if __name__ == "__main__":
    # Die Einrichtung von der Kommandozeile. Ohne Passwort legt die Person
    # es bei der ersten Anmeldung selbst fest.
    import sys

    if len(sys.argv) >= 4 and sys.argv[1] == "konto":
        kennung, name = sys.argv[2], sys.argv[3]
        recht = sys.argv[4] if len(sys.argv) > 4 else "verwalten"
        passwort = sys.argv[5] if len(sys.argv) > 5 else None
        erstes_konto(kennung, name, recht, passwort)
        print(f"Konto «{kennung}» angelegt, Stufe {recht}.")
        if not passwort:
            print("Das Passwort legt die Person bei der ersten Anmeldung fest.")
    else:
        print(__doc__ or "")
        print('Aufruf: python anmeldung.py konto <kennung> "<Name>" '
              "[lesen|schreiben|verwalten] [passwort]")
