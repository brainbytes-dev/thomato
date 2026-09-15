"""Diagramme als serverseitiges SVG.

Kein JavaScript, keine Bibliothek, keine Abhaengigkeit. Das Werkzeug muss im
Dezember 2027 noch laufen und waehrend eines Pruefbesuchs auf einen Bildschirm
geworfen werden koennen; alles, was aus dem Netz nachgeladen wird, ist ein
Risiko.

Die Farben kommen als CSS-Variablen aus dem Grundgeruest, damit heller und
dunkler Modus dieselbe Zeichnung tragen. Beide Saetze sind mit dem
Paletten-Pruefer geprueft: Helligkeitsband, Farbsaettigung, Unterscheidbarkeit
bei Farbenblindheit und Kontrast gegen den Grund, je Modus.

Regeln, die hier eingebaut sind und nicht gebrochen werden:
- Balken beginnen bei null. Immer.
- Eine Achse. Nie zwei Wertachsen in einer Zeichnung.
- Zu jeder Zeichnung gehoert eine Tabelle mit denselben Zahlen.
- Beschriftet wird gezielt, nicht jeder Punkt.
"""

from html import escape

# Zeichenflaeche. Die Werte sind Einheiten im viewBox, nicht Pixel; das SVG
# skaliert auf die verfuegbare Breite.
BREITE = 720
HOEHE = 250
RAND_L, RAND_R, RAND_O, RAND_U = 46, 16, 16, 34


def _achsentext(x, y, text, anker="middle", klasse="achse"):
    return (f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="{anker}" '
            f'class="{klasse}">{escape(str(text))}</text>')


def linie_quote(reihen, beschriftungen, richtwert=None, y_von=50, y_bis=100,
                titel="", einheit="%"):
    """Zeitreihe fuer Quoten. Eine bis drei Reihen auf einer Achse.

    Die Wertachse beginnt bewusst nicht bei null: Quoten zwischen 80 und 100
    waeren sonst ein Band am oberen Rand. Die Achse ist dafuer voll
    beschriftet, und der Richtwert ist eingezeichnet, damit der Massstab
    sichtbar bleibt.
    """
    if not reihen or not reihen[0]["werte"]:
        return '<p class="leise">Keine Daten.</p>'

    n = len(reihen[0]["werte"])
    innen_b = BREITE - RAND_L - RAND_R
    innen_h = HOEHE - RAND_O - RAND_U
    schritt = innen_b / max(1, n - 1)

    def px(i):
        return RAND_L + i * schritt

    def py(w):
        anteil = (w - y_von) / (y_bis - y_von)
        return RAND_O + innen_h * (1 - max(0.0, min(1.0, anteil)))

    teile = []

    # Waagrechtes Raster, zurueckhaltend.
    marken = [y_von, y_bis]
    if richtwert is not None:
        marken.append(richtwert)
    else:
        marken.append((y_von + y_bis) / 2)
    for w in sorted(set(marken)):
        y = py(w)
        ist_richtwert = richtwert is not None and w == richtwert
        teile.append(
            f'<line x1="{RAND_L}" y1="{y:.1f}" x2="{BREITE - RAND_R}" y2="{y:.1f}" '
            f'class="{"richtlinie" if ist_richtwert else "raster"}"/>')
        teile.append(_achsentext(RAND_L - 8, y + 4, f"{w:g}", "end"))
    if richtwert is not None:
        # Links, weil rechts die Direktbeschriftungen der Reihen stehen.
        teile.append(_achsentext(RAND_L + 6, py(richtwert) - 7,
                                 f"Richtwert {richtwert:g}{einheit}", "start",
                                 "richtwert-text"))

    # Beschriftung der Zeitachse. Bei zwoelf Monaten nur jeden zweiten, sonst
    # kollidieren die Texte.
    jeder = 2 if n > 8 else 1
    for i, b in enumerate(beschriftungen):
        if i % jeder == 0 or i == n - 1:
            teile.append(_achsentext(px(i), HOEHE - RAND_U + 18, b))

    for nr, reihe in enumerate(reihen, start=1):
        punkte = " ".join(f"{px(i):.1f},{py(w):.1f}"
                          for i, w in enumerate(reihe["werte"]))
        teile.append(f'<polyline points="{punkte}" class="reihe r{nr}"/>')
        for i, w in enumerate(reihe["werte"]):
            teile.append(
                f'<circle cx="{px(i):.1f}" cy="{py(w):.1f}" r="4" '
                f'class="punkt r{nr}"><title>{escape(beschriftungen[i])}: '
                f'{w:g}{einheit}</title></circle>')
        # Direktbeschriftung nur am letzten Punkt.
        letzter = reihe["werte"][-1]
        teile.append(
            f'<text x="{px(n - 1) - 10:.1f}" y="{py(letzter) - 12:.1f}" '
            f'text-anchor="end" class="direkt r{nr}">{letzter:g}{einheit}</text>')

    beschreibung = titel or "Zeitreihe"
    return (f'<svg viewBox="0 0 {BREITE} {HOEHE}" class="diagramm" role="img" '
            f'aria-label="{escape(beschreibung)}">' + "".join(teile) + "</svg>")


def _beschriftung_zeilen(name, max_zeichen):
    """Ein Name auf hoechstens zwei Zeilen, an Wortgrenzen getrennt. Was
    dann noch nicht passt, endet mit drei Punkten; der volle Name steht im
    Tooltip des Balkens. Michael am 15.09.2026: «texte sind abgeschnitten»,
    vorher wurde nach 26 Zeichen hart gekuerzt."""
    name = str(name)
    if len(name) <= max_zeichen:
        return [name]
    zeilen, aktuell = [], ""
    for wort in name.split():
        if aktuell and len(aktuell) + 1 + len(wort) > max_zeichen:
            zeilen.append(aktuell)
            aktuell = wort
        else:
            aktuell = (aktuell + " " + wort).strip()
    if aktuell:
        zeilen.append(aktuell)
    if len(zeilen) > 2:
        zeilen = zeilen[:2]
        zeilen[1] = zeilen[1][:max_zeichen - 1].rstrip() + "…"
    return zeilen


def balken_quote(posten, richtwert=None, einheit="%", titel="",
                 richtwert_text=None, beschriftung_breite=205):
    """Waagrechte Balken fuer den Vergleich weniger Groessen.

    Beginnt bei null, ohne Ausnahme: bei Balken ist die Laenge die Aussage.
    Lange Namen brechen auf zwei Zeilen um; wer laengere Namen hat, gibt
    der Beschriftung mehr Breite mit.
    """
    if not posten:
        return '<p class="leise">Keine Daten.</p>'

    zeilenhoehe = 38
    kopf = 26 if richtwert is not None else 4
    hoehe = RAND_O + kopf + len(posten) * zeilenhoehe + 12
    # Bei 13,5px Schrift passen rund 7,8px je Zeichen.
    beschriftung_b = beschriftung_breite
    max_zeichen = max(12, int(beschriftung_b / 7.8))
    innen_b = BREITE - beschriftung_b - RAND_R - 96

    teile = []
    if richtwert is not None:
        x = beschriftung_b + innen_b * richtwert / 100
        teile.append(f'<line x1="{x:.1f}" y1="{RAND_O + kopf - 8}" x2="{x:.1f}" '
                     f'y2="{hoehe - 10}" class="richtlinie"/>')
        teile.append(_achsentext(
            x, RAND_O + 10,
            richtwert_text or f"Richtwert {richtwert:g}{einheit}",
            "middle", "richtwert-text"))

    for i, p in enumerate(posten):
        y = RAND_O + kopf + i * zeilenhoehe
        breite = innen_b * max(0.0, min(100.0, p["wert"])) / 100
        klasse = p.get("klasse", "r1")
        # Bei Zaehlwerten steht die Zahl selbst da, nicht ein Prozentsatz:
        # «60 %» waere hier 60 Prozent wovon.
        beschriftet = p.get("label", f'{p["wert"]:g}{einheit}')
        zeilen = _beschriftung_zeilen(p["name"], max_zeichen)
        if len(zeilen) == 1:
            teile.append(_achsentext(beschriftung_b - 10, y + 15, zeilen[0],
                                     "end", "balken-name"))
        else:
            teile.append(_achsentext(beschriftung_b - 10, y + 9, zeilen[0],
                                     "end", "balken-name"))
            teile.append(_achsentext(beschriftung_b - 10, y + 23, zeilen[1],
                                     "end", "balken-name"))
        teile.append(
            f'<rect x="{beschriftung_b}" y="{y}" width="{max(2, breite):.1f}" '
            f'height="20" rx="4" class="balken {klasse}">'
            f'<title>{escape(p["name"])}: {escape(str(beschriftet))}'
            f'</title></rect>')
        teile.append(
            f'<text x="{beschriftung_b + breite + 8:.1f}" y="{y + 15}" '
            f'class="direkt {klasse}">{escape(str(beschriftet))}</text>')
        if p.get("n") and "label" not in p:
            teile.append(_achsentext(BREITE - RAND_R, y + 15, f'n={p["n"]}',
                                     "end", "achse"))

    return (f'<svg viewBox="0 0 {BREITE} {hoehe:.0f}" class="diagramm" role="img" '
            f'aria-label="{escape(titel or "Balkenvergleich")}">'
            + "".join(teile) + "</svg>")


def vorher_nachher(vorher, nachher, einheit="", titel="", hoeher_ist_besser=True):
    """Der Kern eines Qualitaetskreislaufs: zwei Messungen, ein Vergleich.

    Solange die zweite fehlt, zeigt die Zeichnung eine offene Stelle statt
    eines Balkens. Genau das ist die Aussage.
    """
    hoehe = 150
    mitte_y = 70
    b = 210
    x1, x2 = 60, 60 + b + 120

    # SVG bricht Text nicht um: was nicht in den Kasten passt, wird gekuerzt.
    # Der volle Wert steht im Titel und damit im Tooltip.
    def kurz(wert, zeichen=26):
        s = str(wert)
        return s if len(s) <= zeichen else s[:zeichen - 1].rstrip() + "…"

    teile = []
    teile.append(_achsentext(x1 + b / 2, 26, "erste Messung", "middle", "balken-name"))
    teile.append(_achsentext(x2 + b / 2, 26, "Nachmessung", "middle", "balken-name"))

    teile.append(f'<rect x="{x1}" y="{mitte_y - 26}" width="{b}" height="52" '
                 f'rx="8" class="messfeld"/>')
    teile.append(f'<text x="{x1 + b / 2}" y="{mitte_y + 8}" text-anchor="middle" '
                 f'class="messwert">{escape(kurz(vorher))}{escape(einheit)}'
                 f'<title>{escape(str(vorher))}</title></text>')

    pfeil_x1, pfeil_x2 = x1 + b + 18, x2 - 18
    teile.append(f'<line x1="{pfeil_x1}" y1="{mitte_y}" x2="{pfeil_x2 - 7}" '
                 f'y2="{mitte_y}" class="raster"/>')
    teile.append(f'<path d="M{pfeil_x2 - 12} {mitte_y - 4}L{pfeil_x2 - 6} '
                 f'{mitte_y}l-6 4" class="pfeil"/>')

    if nachher is None:
        teile.append(f'<rect x="{x2}" y="{mitte_y - 26}" width="{b}" height="52" '
                     f'rx="8" class="messfeld offen"/>')
        teile.append(f'<text x="{x2 + b / 2}" y="{mitte_y + 6}" '
                     f'text-anchor="middle" class="messwert offen">steht aus</text>')
        teile.append(_achsentext(x1 + b + (x2 - x1 - b) / 2, mitte_y + 34,
                                 "Kreislauf offen", "middle", "achse"))
    else:
        teile.append(f'<rect x="{x2}" y="{mitte_y - 26}" width="{b}" height="52" '
                     f'rx="8" class="messfeld erfuellt"/>')
        teile.append(f'<text x="{x2 + b / 2}" y="{mitte_y + 8}" '
                     f'text-anchor="middle" class="messwert">'
                     f'{escape(kurz(nachher))}{escape(einheit)}'
                     f'<title>{escape(str(nachher))}</title></text>')

    return (f'<svg viewBox="0 0 {BREITE} {hoehe}" class="diagramm" role="img" '
            f'aria-label="{escape(titel or "Messung und Nachmessung")}">'
            + "".join(teile) + "</svg>")


def zeitstrahl(posten, heute_text="heute"):
    """Die Fristen als Strahl statt als Tabelle.

    Der Abstand auf dem Strahl entspricht dem echten zeitlichen Abstand,
    sonst wäre die Zeichnung eine Lüge über die verbleibende Zeit.
    """
    if not posten:
        return ""
    hoehe = 132
    y = 62
    x0, x1 = 40, BREITE - 40
    max_tage = max(p["tage"] for p in posten)
    if max_tage <= 0:
        return ""

    def px(tage):
        return x0 + (x1 - x0) * max(0, tage) / max_tage

    teile = [f'<line x1="{x0}" y1="{y}" x2="{x1}" y2="{y}" class="raster"/>']
    # Heute als Anker links.
    teile.append(f'<circle cx="{x0}" cy="{y}" r="5" class="heute"/>')
    teile.append(_achsentext(x0, y + 24, heute_text, "start"))

    oben = True
    for p in posten:
        x = px(p["tage"])
        teile.append(f'<line x1="{x:.1f}" y1="{y - 9}" x2="{x:.1f}" '
                     f'y2="{y + 9}" class="marke-{p["stufe"]}"/>')
        teile.append(f'<circle cx="{x:.1f}" cy="{y}" r="5.5" '
                     f'class="frist {p["stufe"]}"><title>{escape(p["beschriftung"])}: '
                     f'{escape(p["datum"])}, noch {p["tage"]} Tage</title></circle>')
        ty = y - 22 if oben else y + 34
        teile.append(_achsentext(x, ty, f'{p["tage"]} Tage', "middle",
                                 f'frist-tage {p["stufe"]}'))
        teile.append(_achsentext(x, ty + (-14 if oben else 14), p["datum"],
                                 "middle", "achse"))
        oben = not oben

    return (f'<svg viewBox="0 0 {BREITE} {hoehe}" class="diagramm" role="img" '
            f'aria-label="Fristen bis zur Erneuerung">' + "".join(teile) + "</svg>")


def kuchen(posten, titel="", einheit=""):
    """Anteile eines Ganzen als Kreis.

    Erlaubt, weil hier wirklich ein Ganzes zerlegt wird: Jede Nennung
    gehoert genau einem Thema, und die Summe ist die Grundgesamtheit. Wo
    das nicht gilt, bleibt der Balken die richtige Form.

    Eine Farbe, abnehmende Deckkraft: Das ordnet nach Groesse, ohne acht
    Farben zu erfinden, die nichts bedeuten. Der groesste Posten ist der
    kraeftigste. Die Trennung zwischen den Segmenten ist die Grundfarbe,
    damit aneinandergrenzende Flaechen nicht ineinanderlaufen.
    """
    import math

    posten = [p for p in posten if p.get("wert", 0) > 0]
    if not posten:
        return '<p class="leise">Keine Daten.</p>'
    gesamt = sum(p["wert"] for p in posten)
    if not gesamt:
        return '<p class="leise">Keine Daten.</p>'

    r = 96
    mitte_x, mitte_y = 122, 124
    hoehe = max(248, RAND_O + len(posten) * 24 + 24)
    legende_x = 262

    teile = []
    # Bei 12 Uhr beginnen und im Uhrzeigersinn, wie eine Uhr gelesen wird.
    winkel = -math.pi / 2
    for i, p in enumerate(posten):
        anteil = p["wert"] / gesamt
        deckung = max(0.26, 1 - i * 0.14)
        ende = winkel + 2 * math.pi * anteil
        beschriftet = p.get("label") or f'{p["wert"]:g}{einheit}'
        titel_text = (f'{escape(p["name"])}: {escape(str(beschriftet))}, '
                      f'{anteil * 100:.1f} %')
        if anteil >= 0.999:
            # Ein einziges Thema: ein Kreis, kein Sektor. Ein Pfad mit
            # 360 Grad faellt sonst auf seinen Anfangspunkt zusammen.
            teile.append(
                f'<circle cx="{mitte_x}" cy="{mitte_y}" r="{r}" '
                f'class="kuchenstueck r1" fill-opacity="{deckung:.2f}">'
                f'<title>{titel_text}</title></circle>')
        else:
            x1 = mitte_x + r * math.cos(winkel)
            y1 = mitte_y + r * math.sin(winkel)
            x2 = mitte_x + r * math.cos(ende)
            y2 = mitte_y + r * math.sin(ende)
            gross = 1 if anteil > 0.5 else 0
            teile.append(
                f'<path d="M {mitte_x} {mitte_y} L {x1:.2f} {y1:.2f} '
                f'A {r} {r} 0 {gross} 1 {x2:.2f} {y2:.2f} Z" '
                f'class="kuchenstueck r1" fill-opacity="{deckung:.2f}">'
                f'<title>{titel_text}</title></path>')

        y = RAND_O + 6 + i * 24
        teile.append(
            f'<rect x="{legende_x}" y="{y}" width="12" height="12" rx="3" '
            f'class="kuchenstueck r1" fill-opacity="{deckung:.2f}"/>')
        name = p["name"] if len(p["name"]) <= 44 else p["name"][:43] + "…"
        teile.append(
            f'<text x="{legende_x + 20}" y="{y + 11}" class="balken-name">'
            f'{escape(name)}</text>')
        teile.append(
            f'<text x="{BREITE - RAND_R}" y="{y + 11}" text-anchor="end" '
            f'class="direkt r1">{escape(str(beschriftet))}'
            f'<tspan class="achse">  {anteil * 100:.1f} %</tspan></text>')
        winkel = ende

    return (f'<svg viewBox="0 0 {BREITE} {hoehe}" class="diagramm" role="img" '
            f'aria-label="{escape(titel or "Anteile")}">'
            + "".join(teile) + "</svg>")


def lage_balken(gruppen_zahlen):
    """Ein gestapelter Balken über alle Kriterien.

    Teil eines Ganzen, das die Summe wirklich ergibt, darum gestapelt und
    nicht nebeneinander. Zwischen den Segmenten bleibt eine Lücke, damit
    angrenzende Flächen nicht ineinanderlaufen.
    """
    gesamt = sum(z for _, z, _ in gruppen_zahlen)
    if not gesamt:
        return ""
    hoehe = 34
    x0, breite = 0, BREITE
    y = 4
    teile = []
    x = x0
    for name, zahl, klasse in gruppen_zahlen:
        if not zahl:
            continue
        b = breite * zahl / gesamt
        teile.append(
            f'<rect x="{x:.1f}" y="{y}" width="{max(1, b - 2):.1f}" height="26" '
            f'rx="3" class="lage {klasse}"><title>{escape(name)}: {zahl} von '
            f'{gesamt}</title></rect>')
        if b > 34:
            # Die Zahl traegt die Klasse ihres Segments mit: auf einem ruhigen
            # Ton braucht sie dunkle Schrift, auf einem satten helle.
            teile.append(_achsentext(x + b / 2 - 1, y + 18, str(zahl), "middle",
                                     f"lage-zahl {klasse}"))
        x += b
    return (f'<svg viewBox="0 0 {BREITE} {hoehe}" class="diagramm lagebalken" '
            f'role="img" aria-label="Lage der {gesamt} Kriterien">'
            + "".join(teile) + "</svg>")


def saeulen_zeit(werte, beschriftungen, marke=None, marke_text="", titel="",
                 einheit=""):
    """Zaehlwerte über die Zeit, als Säulen.

    Säulen und nicht Linie, weil es Zählungen sind und nicht ein Verlauf
    einer Grösse: ein Monat ohne Meldung ist eine Null, kein fehlender Wert.
    Genau diese Nullen sind hier die Aussage.
    """
    if not werte:
        return '<p class="leise">Keine Daten.</p>'
    hoehe = 220
    rand_u = 46
    innen_h = hoehe - RAND_O - rand_u
    innen_b = BREITE - RAND_L - RAND_R
    n = len(werte)
    schritt = innen_b / n
    hoechster = max(max(werte), 1)

    teile = []
    for stufe in (0, hoechster):
        y = RAND_O + innen_h * (1 - stufe / hoechster)
        teile.append(f'<line x1="{RAND_L}" y1="{y:.1f}" x2="{BREITE - RAND_R}" '
                     f'y2="{y:.1f}" class="raster"/>')
        teile.append(_achsentext(RAND_L - 8, y + 4, f"{stufe:g}", "end"))

    if marke is not None and 0 <= marke < n:
        x = RAND_L + marke * schritt + schritt / 2
        teile.append(f'<line x1="{x:.1f}" y1="{RAND_O - 4}" x2="{x:.1f}" '
                     f'y2="{RAND_O + innen_h}" class="richtlinie"/>')
        if marke_text:
            anker = "start" if marke < n * 0.6 else "end"
            versatz = 6 if anker == "start" else -6
            teile.append(_achsentext(x + versatz, RAND_O + 4, marke_text, anker,
                                     "richtwert-text"))

    for i, w in enumerate(werte):
        x = RAND_L + i * schritt
        b = max(2, schritt - 3)
        if w:
            h = innen_h * w / hoechster
            teile.append(
                f'<rect x="{x:.1f}" y="{RAND_O + innen_h - h:.1f}" '
                f'width="{b:.1f}" height="{h:.1f}" rx="2" class="balken r1">'
                f'<title>{escape(beschriftungen[i])}: {w}{einheit}</title></rect>')
        else:
            # Ein leerer Monat bekommt einen sichtbaren Platzhalter, sonst
            # sieht die Lücke aus wie fehlende Daten.
            teile.append(
                f'<rect x="{x:.1f}" y="{RAND_O + innen_h - 2:.1f}" '
                f'width="{b:.1f}" height="2" class="null">'
                f'<title>{escape(beschriftungen[i])}: keine Meldung</title></rect>')

    jeder = max(1, round(n / 12))
    for i, bez in enumerate(beschriftungen):
        if i % jeder == 0 or i == n - 1:
            x = RAND_L + i * schritt + schritt / 2
            teile.append(f'<text x="{x:.1f}" y="{hoehe - rand_u + 20:.1f}" '
                         f'text-anchor="end" class="achse" '
                         f'transform="rotate(-45 {x:.1f} {hoehe - rand_u + 20:.1f})">'
                         f'{escape(bez)}</text>')

    return (f'<svg viewBox="0 0 {BREITE} {hoehe}" class="diagramm" role="img" '
            f'aria-label="{escape(titel or "Zeitreihe")}">' + "".join(teile) + "</svg>")


def vergleich_punkte(posten, von, bis, beschriftung_vorher="vorher",
                     beschriftung_nachher="nachher", titel=""):
    """Zwei Messzeitpunkte je Frage, verbunden durch eine Linie.

    Die Form zeigt Richtung und Abstand zugleich: eine kurze Verbindung heisst
    wenig Veraenderung, und genau das ist bei kleinen Stichproben oft die
    ehrlichste Aussage.
    """
    if not posten:
        return '<p class="leise">Keine Daten.</p>'
    zeilenhoehe = 34
    kopf = 26
    hoehe = RAND_O + kopf + len(posten) * zeilenhoehe + 16
    beschriftung_b = 190
    innen_b = BREITE - beschriftung_b - RAND_R - 40

    def px(w):
        return beschriftung_b + innen_b * (w - von) / (bis - von)

    teile = []
    for w in range(int(von), int(bis) + 1):
        x = px(w)
        teile.append(f'<line x1="{x:.1f}" y1="{RAND_O + kopf - 10}" x2="{x:.1f}" '
                     f'y2="{hoehe - 14}" class="raster"/>')
        teile.append(_achsentext(x, hoehe - 2, str(w)))

    for i, p in enumerate(posten):
        y = RAND_O + kopf + i * zeilenhoehe + 8
        x1, x2 = px(p["vorher"]), px(p["nachher"])
        teile.append(_achsentext(beschriftung_b - 12, y + 4, p["name"], "end",
                                 "balken-name"))
        teile.append(f'<line x1="{x1:.1f}" y1="{y}" x2="{x2:.1f}" y2="{y}" '
                     f'class="verbindung"/>')
        teile.append(f'<circle cx="{x1:.1f}" cy="{y}" r="5" class="punkt-vorher">'
                     f'<title>{escape(p["name"])} {escape(beschriftung_vorher)}: '
                     f'{p["vorher"]}</title></circle>')
        teile.append(f'<circle cx="{x2:.1f}" cy="{y}" r="5" class="punkt-nachher">'
                     f'<title>{escape(p["name"])} {escape(beschriftung_nachher)}: '
                     f'{p["nachher"]}</title></circle>')
        teile.append(_achsentext(BREITE - RAND_R, y + 4,
                                 f'{p["nachher"] - p["vorher"]:+.2f}', "end",
                                 "achse"))

    teile.append(f'<circle cx="{beschriftung_b + 8}" cy="{RAND_O + 4}" r="5" '
                 f'class="punkt-vorher"/>')
    teile.append(_achsentext(beschriftung_b + 20, RAND_O + 8,
                             escape(beschriftung_vorher), "start"))
    teile.append(f'<circle cx="{beschriftung_b + 120}" cy="{RAND_O + 4}" r="5" '
                 f'class="punkt-nachher"/>')
    teile.append(_achsentext(beschriftung_b + 132, RAND_O + 8,
                             escape(beschriftung_nachher), "start"))

    return (f'<svg viewBox="0 0 {BREITE} {hoehe:.0f}" class="diagramm" role="img" '
            f'aria-label="{escape(titel or "Vergleich zweier Messungen")}">'
            + "".join(teile) + "</svg>")


def fortschrittskreis(schritte, groesse=44):
    """Ein Ring aus drei Segmenten: Messung, Massnahme, Nachmessung.

    Zeigt nicht nur wie weit, sondern welcher Schritt fehlt. Ein halb voller
    Balken sagt das nicht; ein Ring mit einer offenen Lücke schon.
    """
    r = groesse / 2 - 4
    mitte = groesse / 2
    n = len(schritte) or 1
    umfang = 2 * 3.14159265 * r
    laenge = umfang / n - 3

    teile = []
    for i, (typ, erledigt) in enumerate(schritte):
        # Bei 12 Uhr beginnen und im Uhrzeigersinn.
        versatz = -umfang * i / n
        teile.append(
            f'<circle cx="{mitte}" cy="{mitte}" r="{r:.1f}" fill="none" '
            f'stroke-width="5" stroke-linecap="butt" '
            f'class="ring {"voll" if erledigt else "leer"} t-{typ}" '
            f'stroke-dasharray="{laenge:.2f} {umfang - laenge:.2f}" '
            f'stroke-dashoffset="{versatz:.2f}" '
            f'transform="rotate(-90 {mitte} {mitte})"/>')

    fertig = sum(1 for _, e in schritte if e)
    teile.append(
        f'<text x="{mitte}" y="{mitte + 4.5}" text-anchor="middle" '
        f'class="ringzahl">{fertig}</text>')

    return (f'<svg viewBox="0 0 {groesse} {groesse}" class="fortschritt" '
            f'role="img" aria-label="{fertig} von {n} Schritten erledigt">'
            + "".join(teile) + "</svg>")


# Die Einsatzkette ist breiter als die uebrigen Zeichnungen: zehn Zeitpunkte
# mit lesbaren Namen brauchen Platz. Sie rollt in ihrem eigenen Rahmen.
KETTE_BREITE = 1040


def _berechenbar(intervall, vorhanden):
    """Ein Intervall braucht beide Endpunkte. Fehlt einer, ist es keine
    ungenaue Zahl, sondern gar keine."""
    return intervall["von"] in vorhanden and intervall["bis"] in vorhanden


def einsatzkette(zeitpunkte, intervalle):
    """Die zehn Zeitpunkte nach Kriterium 7.4 als Kette, darueber die sechs
    Intervalle als Klammern.

    Die Zeichnung hat genau eine Aussage: welche Zeitpunkte der Export
    wirklich liefert und welche Intervalle daraus berechenbar sind. Ein
    fehlender Zeitpunkt steht gestrichelt, ein Intervall ohne beide
    Endpunkte ebenfalls. Damit steht die Luecke in der Zeichnung und nicht
    in einer Fussnote darunter.

    Die Abstaende sind gleich gross und nicht zeitproportional: es sind
    Schritte eines Ablaufs und keine Punkte auf einer Uhr. Proportional
    gezeichnet behauptete die Kette Dauern, die hier niemand gemessen hat.
    """
    if len(zeitpunkte) < 2:
        return ""

    vorhanden = {z["code"] for z in zeitpunkte if z["spalte"]}
    bahnen = max(i["bahn"] for i in intervalle) + 1 if intervalle else 0
    bahn_hoehe = 23
    kette_y = 32 + bahnen * bahn_hoehe
    hoehe = kette_y + 62

    x0, x1 = 56, KETTE_BREITE - 56
    schritt = (x1 - x0) / (len(zeitpunkte) - 1)
    mitte = {z["code"]: x0 + i * schritt for i, z in enumerate(zeitpunkte)}

    # Die Verbindung folgt der Signaturkomponente der Oberflaeche, der
    # Kreislaufkette: grau, solange ein Ende fehlt, im Werkbankblau dort, wo
    # beide Zeitpunkte vorliegen. Eine gefuellte Strecke sagt damit auf einen
    # Blick, welche Spanne wirklich messbar ist.
    teile = []
    for vorher, nachher in zip(zeitpunkte, zeitpunkte[1:]):
        beide = vorher["code"] in vorhanden and nachher["code"] in vorhanden
        teile.append(
            f'<line x1="{mitte[vorher["code"]]:.1f}" y1="{kette_y}" '
            f'x2="{mitte[nachher["code"]]:.1f}" y2="{kette_y}" '
            f'class="kettenlinie{"" if beide else " offen"}"/>')

    # Die Klammern zuerst, damit die Knoten darauf liegen und nicht darunter.
    for iv in intervalle:
        offen = "" if _berechenbar(iv, vorhanden) else " offen"
        y = kette_y - 34 - iv["bahn"] * bahn_hoehe
        xa, xb = mitte[iv["von"]], mitte[iv["bis"]]
        hinweis = ("aus dem Export berechenbar" if not offen
                   else "nicht berechenbar, ein Zeitpunkt fehlt")
        teile.append(
            f'<path d="M{xa:.1f} {y + 7:.1f}V{y:.1f}H{xb:.1f}V{y + 7:.1f}" '
            f'class="intervall{offen}"><title>{escape(iv["name"])}: '
            f'{hinweis}</title></path>')
        teile.append(_achsentext((xa + xb) / 2, y - 6, iv["name"], "middle",
                                 f"intervall-name{offen}"))

    for zp in zeitpunkte:
        x = mitte[zp["code"]]
        offen = "" if zp["spalte"] else " offen"
        voll = zp["voll"]
        hinweis = (f'im Export vorhanden, Spalte {zp["spalte"]}' if not offen
                   else "fehlt im Export")
        teile.append(
            f'<rect x="{x - 14:.1f}" y="{kette_y - 14}" width="28" height="28" '
            f'rx="8" class="zeitpunkt{offen}"><title>{escape(voll)}: '
            f'{hinweis}</title></rect>')
        teile.append(_achsentext(x, kette_y + 5, zp["nr"] or "·", "middle",
                                 f"zeitpunkt-nr{offen}"))
        teile.append(_achsentext(x, kette_y + 33, zp["name"], "middle",
                                 "zeitpunkt-name"))
        if zp["zusatz"]:
            teile.append(_achsentext(x, kette_y + 46, zp["zusatz"], "middle",
                                     "zeitpunkt-name"))

    erfasst = len(vorhanden)
    rechenbar = sum(1 for i in intervalle if _berechenbar(i, vorhanden))
    beschriftung = (
        f"Einsatzkette nach Kriterium 7.4: {erfasst} von {len(zeitpunkte)} "
        f"Zeitpunkten liefert der Export, {rechenbar} von {len(intervalle)} "
        f"Intervallen sind daraus berechenbar")
    return (f'<svg viewBox="0 0 {KETTE_BREITE} {hoehe}" class="diagramm einsatzkette" '
            f'role="img" aria-label="{escape(beschriftung)}">'
            + "".join(teile) + "</svg>")
