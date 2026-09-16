"""Die Anwendung unter einem Pfad statt auf der Wurzel einer Adresse.

Sie ist gebaut für eine eigene Adresse: jeder Verweis in den Vorlagen
beginnt mit einem Schrägstrich, «/handbuch» führt zum Handbuch. Läuft sie
unter «thomato.ch/qualitaetsmanagement-tool/demo», stimmt das nicht mehr; der Verweis
zeigt dann an der Anwendung vorbei.

Zwei Wege wären möglich gewesen. Der eine: in allen fünfzehn Vorlagen jeden
Verweis durch einen Aufruf ersetzen, der den Pfad voranstellt. Das sind
zweihundert Stellen, und jede einzelne kann man vergessen.

Der andere ist dieser: eine Schicht davor. Sie schneidet den Pfad von jeder
Anfrage ab, damit die Wege der Anwendung wieder passen, und setzt ihn in
jeder Antwort wieder ein, in der Umleitung und in den Verweisen der Seite.
Die Anwendung selbst merkt nichts davon und bleibt auf einer eigenen
Adresse unverändert richtig.

Angeschaltet wird sie mit der Umgebungsvariablen IVR_BASIS. Ohne sie
geschieht nichts.
"""

import re

# Verweise der Anwendung beginnen mit einem Schrägstrich. Nicht gemeint
# sind Adressen mit zwei Schrägstrichen: «//example.ch» ist eine fremde
# Seite ohne Angabe des Verfahrens, und «#punkt» ist eine Sprungmarke.
VERWEIS = re.compile(rb'(\s(?:href|action|src)=")/(?!/)')


class UnterPfad:
    """ASGI-Schicht, die die Anwendung unter einem Pfad ausliefert."""

    def __init__(self, anwendung, basis, *weitere):
        self.anwendung = anwendung
        self.basis = "/" + (basis or "").strip("/")
        self.roh = self.basis.encode()
        # Dieselbe Anwendung ist unter Umstaenden ueber mehr als einen Pfad
        # erreichbar: die Plattform kennt ihre Funktion auch unter deren
        # eigener Adresse. Abgeschnitten wird jeder davon, eingesetzt wird
        # immer der erste; er ist der, den die Besucher sehen.
        self.pfade = [self.basis] + ["/" + w.strip("/") for w in weitere
                                     if w and w.strip("/")]

    async def __call__(self, scope, empfangen, senden):
        if scope["type"] != "http" or self.basis == "/":
            await self.anwendung(scope, empfangen, senden)
            return

        pfad = scope.get("path", "/")
        innen = None
        for vorne in self.pfade:
            if pfad == vorne:
                innen = "/"
                break
            if pfad.startswith(vorne + "/"):
                innen = pfad[len(vorne):]
                break
        if innen is None:
            # Kein Pfad von uns davor. Dann gilt die Anfrage, wie sie ist;
            # die Antwort bekommt die Verweise trotzdem.
            innen = pfad

        scope = dict(scope, path=innen, root_path=self.basis)
        scope.pop("raw_path", None)
        await self.anwendung(scope, empfangen, self._antwort(senden))

    def _antwort(self, senden):
        """Fängt die Antwort ab: Umleitungen und HTML bekommen den Pfad."""
        zustand = {"html": False, "kopf": None, "stuecke": []}

        async def weiter(ereignis):
            art = ereignis["type"]
            if art == "http.response.start":
                kopfzeilen = []
                for name, wert in ereignis["headers"]:
                    kleiner = name.lower()
                    if kleiner == b"location" and wert.startswith(b"/") \
                            and not wert.startswith(b"//"):
                        wert = self.roh + wert
                    elif kleiner == b"content-type" and b"text/html" in wert:
                        zustand["html"] = True
                    kopfzeilen.append((name, wert))
                ereignis = dict(ereignis, headers=kopfzeilen)
                if not zustand["html"]:
                    await senden(ereignis)
                    return
                # Die Länge stimmt nach dem Umschreiben nicht mehr; sie
                # wird am Schluss neu gesetzt.
                zustand["kopf"] = dict(
                    ereignis,
                    headers=[(n, w) for n, w in kopfzeilen
                             if n.lower() != b"content-length"])
                return

            if art == "http.response.body" and zustand["html"]:
                zustand["stuecke"].append(ereignis.get("body", b""))
                if ereignis.get("more_body"):
                    return
                rumpf = VERWEIS.sub(rb"\1" + self.roh + b"/",
                                    b"".join(zustand["stuecke"]))
                kopf = zustand["kopf"]
                kopf["headers"].append(
                    (b"content-length", str(len(rumpf)).encode()))
                await senden(kopf)
                await senden({"type": "http.response.body", "body": rumpf,
                              "more_body": False})
                return

            await senden(ereignis)

        return weiter


def anlegen(anwendung, basis, *weitere):
    """Legt die Schicht um die Anwendung, wenn ein Pfad gesetzt ist."""
    basis = (basis or "").strip()
    if not basis or basis.strip("/") == "":
        return anwendung
    return UnterPfad(anwendung, basis, *weitere)
