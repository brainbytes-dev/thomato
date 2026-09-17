# Thomato IVR QM — Design System

**Status:** verbindliche Designleitlinie  
**Stand:** 17. September 2026  
**Geltungsbereich:** IVR-QM-Anwendung / zukünftige SaaS-Oberfläche  
**Zweck:** Source of truth für Google Stitch, UI-Design und spätere Implementierung

---

## 1. Produktidee in einem Satz

Thomato ist die interne Arbeitsoberfläche für kontinuierliche IVR-Readiness eines Rettungsdienstes.

Die Oberfläche beantwortet jederzeit zwei Fragen:

1. **Sind wir IVR-ready?**
2. **Was muss jetzt getan werden, damit wir ready werden oder bleiben?**

Die bestehende Produktfrage bleibt der Kern:

> **Was fehlt noch, und bis wann?**

Thomato ist deshalb kein generisches SaaS-Dashboard, kein Projektmanagement-Tool und kein Ersatz der offiziellen IVR-Plattform. Es ist eine ruhige, präzise Arbeitsoberfläche für Kriterien, Nachweise, Dokumente, Fristen, Qualitätskreisläufe, Massnahmen, Beschwerden und Prozesse.

---

## 2. Designrichtung

### Swiss Clinical Minimalism

Die visuelle Sprache verbindet:

- Schweizer Informationsdesign
- klinische Ruhe und Vertrauenswürdigkeit
- moderne B2B-SaaS-Interaktion
- hohe Informationsdichte ohne visuelles Rauschen
- präzise, funktionale Typografie
- sehr zurückhaltende Dekoration

Die Oberfläche soll wirken wie ein hochwertiges Schweizer Fachsystem, nicht wie ein generisches Startup-Dashboard.

### Leitbegriffe

```text
präzise
ruhig
klinisch
vertrauenswürdig
strukturiert
dicht, aber nicht gedrängt
modern, aber nicht modisch
sachlich, aber nicht steril
```

---

## 3. Nicht verhandelbare Designprinzipien

### 3.1 Information vor Dekoration

Typografie, Raster, Raum und Linien erzeugen die Hierarchie.

Nicht jede Information braucht eine Karte.
Nicht jeder Status braucht eine farbige Fläche.
Nicht jede Zahl braucht ein Diagramm.

### 3.2 Raum trennt zuerst

Bereiche werden primär durch Abstand und Ausrichtung getrennt.

Rahmen sind sekundär.
Schatten sind tertiär.

### 3.3 Farbe trägt Bedeutung

Farben werden semantisch verwendet.

- Blau = Marke, Navigation, Aktion, Fokus
- Rot = kritisch, blockierend, Fehler
- Gelb/Ocker = Warnung, Aufmerksamkeit
- Grün = erfüllt, bestätigt, erfolgreich
- Violett = fachliche Zusatzkategorie, nicht allgemeine Dekoration

Keine dekorativen Regenbogen-Dashboards.

### 3.4 Status vor Score

**IVR-Readiness ist kein Prozentwert.**

Ein Rettungsdienst kann einen hohen Dokumentationsstand haben und trotzdem wegen eines zwingenden offenen Punktes nicht vollständig ready sein.

Deshalb werden zwei Dinge getrennt dargestellt:

1. **qualitativer Readiness-Status**
2. **quantitativer Dokumentations-/Erfüllungsfortschritt**

Beispiel:

```text
IVR READINESS

HANDLUNGSBEDARF

3 kritische Punkte verhindern aktuell vollständige Readiness.

82 %
Dokumentationsstand

47 / 56 Kriterien vollständig
```

Der Prozentwert darf nie allein als Aussage über Anerkennungsfähigkeit dargestellt werden.

### 3.5 Actionability vor Reporting

Das Dashboard ist kein Management-Poster.

Nach dem Readiness-Status folgt unmittelbar:

> **Was braucht jetzt Aufmerksamkeit?**

Offene oder kritische Aufgaben, Fristen, fehlende Nachweise, ablaufende Dokumente und fällige Prüfungen stehen vor sekundären Analysen.

### 3.6 Wenige visuelle Ebenen

Die Anwendung arbeitet mit wenigen, klar definierten Oberflächenebenen.

Keine verschachtelten Cards in Cards in Panels.

### 3.7 Fachsoftware darf dicht sein

Thomato ist ein tägliches Arbeitswerkzeug für professionelle Nutzer.

Ziel ist ungefähr **mittlere Informationsdichte**, nicht luftige Marketing-Ästhetik.

Nutzer sollen zehn relevante Punkte überblicken können, ohne drei Bildschirmhöhen scrollen zu müssen.

---

## 4. Farbwelt — Deep Clinical Blue

Die bestehende Farbidentität des Repositories bleibt Grundlage des Designs.

### Light Theme

| Token | Wert | Verwendung |
|---|---:|---|
| `background` | `#EEF2F9` | ruhiger Fenster-/App-Hintergrund |
| `surface` | `#FFFFFF` | primäre Arbeitsfläche |
| `surface-subtle` | `#F3F6FB` | sekundäre Flächen |
| `sidebar` | `#F7F9FD` | Navigation |
| `text` | `#050F1E` | Primärtext |
| `text-muted` | `#4D5F7D` | Meta- und Sekundärtext |
| `border` | `#DDE5F0` | feine Strukturierung |
| `field-border` | `#8095B3` | Eingabefelder |
| `primary` | `#0052A8` | Deep Clinical Blue |
| `primary-deep` | `#003B7A` | aktive/kräftige Variante |
| `primary-subtle` | `#E7EFFB` | dezente Akzentfläche |
| `critical` | `#B3261E` | kritisch / blockierend |
| `warning` | `#8A5A00` | Warnung / Handlungsbedarf |
| `success` | `#1A6B3C` | erfüllt / bestätigt |
| `violet` | `#5B46C4` | fachliche Zusatzkategorie |

### Farbregel

`#0052A8` ist die Marken- und Interaktionsfarbe.

**Rot ist niemals Markenfarbe.** Rot bleibt für kritische oder blockierende Zustände reserviert.

Das verhindert, dass Marke und Problemzustand visuell miteinander konkurrieren.

---

## 5. Dark Mode

Der bestehende Dark Mode bleibt Bestandteil der Designsprache.

Er ist kein invertiertes Light Theme, sondern ein eigener Satz abgestimmter Flächen und Kontraste.

Bestehende Grundwerte:

| Token | Dark |
|---|---:|
| `background` | `#050F1E` |
| `surface` | `#0A1830` |
| `surface-subtle` | `#102341` |
| `sidebar` | `#040C18` |
| `text` | `#EEF5FF` |
| `text-muted` | `#9DB6D8` |
| `primary` | `#3C8CFF` |
| `critical` | `#FF9B91` |
| `warning` | `#E0B45C` |
| `success` | `#76D3A1` |

Designs werden primär im Light Theme entwickelt und müssen anschliessend im Dark Theme semantisch gleich funktionieren.

---

## 6. Typografie

### Schriftfamilie

System Sans Serif.

```css
-apple-system,
BlinkMacSystemFont,
"SF Pro Text",
"Segoe UI Variable Text",
"Segoe UI",
system-ui,
sans-serif
```

Kein dekorativer Branding-Font für die Produktoberfläche.

Die Software soll präzise und nativ wirken.

### Typografische Stufen

Die bestehende Beschränkung auf wenige Grössen bleibt erhalten:

| Rolle | Grösse |
|---|---:|
| Display | `2.125rem` / ca. 34 px |
| Abschnitt | `1.4375rem` / ca. 23 px |
| Text | `0.9375rem` / ca. 15 px |
| Meta | `0.8125rem` / ca. 13 px |

Zusätzlich sind kleine Eyebrows/Labels um ca. 10–12 px zulässig.

### Regeln

- wenige Grössen, klare Hierarchie
- Gewicht und Abstand wichtiger als zusätzliche Schriftgrössen
- keine unnötig grossen SaaS-Headlines
- Zahlen in Tabellen und Kennzahlen mit `tabular-nums`
- kurze Labels dürfen in Versalien mit erhöhter Laufweite gesetzt werden
- Fliesstext bleibt normal gesetzt
- fachliche Inhalte werden nicht in ALL CAPS geschrieben

---

## 7. Raster und Spacing

### Grundraster

- 12-Spalten-Raster für grosse Desktop-Ansichten
- 8-px-basierter Spacing-Rhythmus
- kleinere 4-px-Schritte für Mikroabstände zulässig
- Inhalte konsequent an gemeinsamen Achsen ausrichten

### Ziel

Die Seite soll auch bei vielen Tabellenzeilen, Kriterien und Fristen ruhig bleiben.

Ausrichtung ist wichtiger als dekorative Gruppierung.

### Inhaltsbreite

Arbeitsansichten dürfen die verfügbare Breite sinnvoll nutzen.

Keine künstlich schmale Marketing-Content-Spalte für Tabellen oder Kriterienregister.

Textpassagen und lange Erklärungen werden dagegen auf gut lesbare Zeilenlänge begrenzt.

---

## 8. Radius

Thomato bleibt bewusst kantiger als typische Consumer-SaaS-Produkte.

Bestehende Richtwerte:

```text
Gruppen / grössere Flächen    6–7 px
Inputs / Buttons              4 px
kleine Badges / Elemente      3 px
```

Keine 12–20-px-Standardradien.
Keine Pill-Form für normale Buttons oder Container.

Pills sind nur dort erlaubt, wo die Form semantisch sinnvoll ist, z. B. kompakte Filter-Chips oder klar begrenzte Status-Tags.

---

## 9. Schatten und Elevation

### Neue Grundregel

**Borders + Raum vor Shadows.**

Normale Inhaltsbereiche und Tabellen benötigen keinen sichtbaren Schatten.

Schatten sind reserviert für echte Elevation:

- Dialoge
- Popover
- Dropdown
- schwebende Kontextmenüs
- gezielt angehobene interaktive Objekte

Keine Grid-Ansicht aus zwanzig schwebenden Karten.

### Hover

Hover soll primär über Folgendes kommuniziert werden:

- leichte Hintergrundänderung
- Border-/Textänderung
- Cursor

`translateY(-2px)` und stärkere Card-Shadows werden nicht zum Standardinteraktionsmuster.

---

## 10. Dashboard — Readiness + Action Center

Das Dashboard folgt einer festen Informationshierarchie.

### 10.1 Ebene 1 — IVR Readiness

Ganz oben steht die qualitative Antwort:

```text
IVR READINESS                                      STAND 17.09.2026
──────────────────────────────────────────────────────────────

HANDLUNGSBEDARF

3 kritische Punkte verhindern aktuell vollständige Readiness.

82 %                      47 / 56                    21 MONATE
Dokumentationsstand       Kriterien vollständig     bis Erneuerung

──────────────────────────────────────────────────────────────
KRITISCH  3          OFFEN  6          ≤30 TAGE  4
```

### 10.2 Ebene 2 — Braucht Aufmerksamkeit

Unmittelbar danach folgt die operative Arbeitsliste.

Beispiel:

```text
BRAUCHT AUFMERKSAMKEIT                                  ALLE →

PRIORITÄT   THEMA                         FÄLLIG       STATUS
──────────────────────────────────────────────────────────────
KRITISCH    Kriterium 2.3 Personal        Heute        Nachweis fehlt
KRITISCH    Medikamentenprozess           19.09.       Dokument veraltet
HOCH        PDCA Fahrzeugcheck             23.09.       Wirkung prüfen
NORMAL      SOP Reanimation                04.10.       Review
```

Diese Liste ist wichtiger als dekorative Charts.

### 10.3 Ebene 3 — Übersicht / Fortschritt

Erst danach folgen verdichtete Übersichten zu Bereichen, Kriterien, Qualitätskreisläufen oder Fristen.

Der Standard ist:

- Zahl
- Text
- lineare Darstellung
- Tabelle

Kreisdiagramme oder Ringanzeigen nur, wenn die Kreisform einen echten Informationsvorteil bietet.

---

## 11. Readiness-Zustände

Mindestens folgende fachliche Zustände werden visuell unterschieden:

### Ready

```text
READY
Keine kritischen Punkte offen.
```

Farbe: Grün nur als Statusindikator, nicht als grosse Vollflächen-Dekoration.

### Handlungsbedarf

```text
HANDLUNGSBEDARF
Offene Punkte müssen bearbeitet werden.
```

Farbe: Ocker/Gelb.

### Kritisch / blockiert

```text
KRITISCH
Mindestens ein zwingender Punkt verhindert vollständige Readiness.
```

Farbe: Rot.

### Neutral / nicht bewertet

Für noch nicht bewertete oder nicht anwendbare Sachverhalte werden neutrale Grau-/Blautöne verwendet.

---

## 12. Tabellen und Listen

Tabellen sind ein primäres UI-Muster von Thomato und kein notwendiges Übel.

### Regeln

- kompakte, gut lesbare Zeilen
- klare Spaltenausrichtung
- Zahlen rechtsbündig oder tabellarisch ausgerichtet
- Statusinformation möglichst nah am betreffenden Objekt
- Hover nur subtil
- keine Cards pro Tabellenzeile
- sortierbare Spalten klar kennzeichnen
- Filter oberhalb der Tabelle, nicht in separaten Dashboard-Kacheln verteilen
- Zeilenaktionen kompakt und sekundär behandeln

### Priorität

Information wird zuerst über Text und Position vermittelt.
Farbe verstärkt den Zustand, ersetzt aber nicht die Beschriftung.

---

## 13. Cards

Cards sind erlaubt, aber nicht das Standardlayout.

Eine Card ist sinnvoll, wenn ein Objekt:

- eine klar eigene Interaktion besitzt
- als eigenständige Einheit verschoben/ausgewählt werden kann
- eine abgeschlossene fachliche Einheit darstellt

Nicht sinnvoll:

- jeder KPI in eigener Card
- jede Statistik in eigener Card
- jede Tabellenzeile in eigener Card
- Card in Card
- Karten nur, um Weissraum zu erzeugen

Für Dashboard-Kennzahlen bevorzugen wir ein gemeinsames Raster mit Linien und Typografie statt separater KPI-Karten.

---

## 14. Buttons und Aktionen

### Primary Action

Deep Clinical Blue (`#0052A8`).

Nur eine klare primäre Aktion pro lokalem Kontext.

### Secondary Action

Neutral oder Outline.

### Destructive Action

Rot, jedoch nur für tatsächlich destruktive Aktionen.

### Button-Stil

- Radius ca. 4 px
- keine extrem grossen Flächen
- keine Pill-Buttons als Default
- Icon + Text, wenn das Icon allein nicht eindeutig ist
- Icon-only nur bei etablierten, verständlichen Aktionen

---

## 15. Formulare

Formulare sollen wie Fachsoftware funktionieren, nicht wie Landingpage-Formulare.

### Regeln

- sichtbare Labels
- Placeholder ersetzt nie das Label
- klare Pflichtfeldlogik
- Fehlermeldung direkt am Feld
- Hilfetext nur, wenn er wirklich hilft
- zusammengehörige Felder strukturell gruppieren
- keine unnötigen Wizard-Schritte für einfache Eingaben
- bei langen fachlichen Workflows sind klar bezeichnete Abschnitte erlaubt

---

## 16. Status-Badges

Badges werden sparsam eingesetzt.

Gut:

```text
KRITISCH
OFFEN
GEPRÜFT
FÄLLIG
```

Nicht gut:

```text
blauer Badge + grüner Badge + violetter Badge + grauer Badge
in jeder Tabellenzelle nur aus dekorativen Gründen
```

Ein Badge braucht eine semantische Funktion.

---

## 17. Icons

Bevorzugt wird eine konsistente, reduzierte Outline-Icon-Sprache, z. B. Lucide.

### Regeln

- Icon ersetzt keinen unklaren Text
- normale Grösse ungefähr 14–18 px
- keine Emojis in der Produktoberfläche
- keine Mischung mehrerer Icon-Stile
- dekorative Icons vermeiden

---

## 18. Diagramme und Datenvisualisierung

Thomato ist kein Analytics-Produkt.

Visualisierung wird verwendet, wenn sie einen Zusammenhang schneller verständlich macht als eine Zahl oder Tabelle.

### Bevorzugt

- lineare Fortschrittsanzeigen
- Zeitachsen
- einfache Balken
- kleine Trendlinien
- klar beschriftete Verteilungen

### Zurückhaltend verwenden

- Donuts
- Radial Gauges
- Kreisfortschrittsanzeigen
- grosse Dashboard-Charts

### Regel

Wenn eine Zahl plus Label dieselbe Aussage schneller vermittelt, gewinnt die Zahl.

---

## 19. Animation

Animation unterstützt Orientierung, nicht Unterhaltung.

Bestehende Baseline:

```text
Dauer: ca. 180 ms
Kurve: cubic-bezier(.32, .72, 0, 1)
```

### Erlaubt

- kleine Zustandswechsel
- Öffnen/Schliessen
- Fokus-/Hover-Feedback
- nachvollziehbare Prozessbewegung

### Nicht verwenden

- Bounce
- overshoot
- grosse Zoom-Effekte
- permanente Animationen
- decorative loading theatre

---

## 20. Accessibility

Accessibility ist Teil des Designs und keine spätere Korrektur.

### Anforderungen

- ausreichender Textkontrast
- sichtbarer `:focus-visible`-Ring
- Status nie nur über Farbe kommunizieren
- Tastaturnavigation
- sinnvolle semantische HTML-Struktur
- Inputs mit Labels
- Tabellen mit korrekten Headern
- Interaktionen mit klaren Fokuszuständen
- Dark Mode mit eigenständig geprüften Kontrasten

Bestehende Fokusfarbe: Deep Clinical Blue.

---

## 21. Navigation

Die endgültige Informationsarchitektur der Hauptnavigation wird separat festgelegt.

Für das Design gelten bereits folgende Regeln:

- stabile linke Hauptnavigation auf Desktop
- aktive Seite klar erkennbar
- Deep Clinical Blue darf den aktiven Hauptpunkt markieren
- Gruppenlabels sind klein und ruhig
- Navigation konkurriert nicht mit dem Arbeitsinhalt
- Zähler werden nur gezeigt, wenn sie handlungsrelevant sind

Keine Navigation voller bunter Badges.

---

## 22. Responsive Verhalten

Thomato ist Desktop-first, aber nicht Desktop-only.

### Desktop

Primäre Arbeitsumgebung.
Volle Tabellen, Sidebar und Informationsdichte.

### Tablet

Arbeitsfähig ohne Funktionsverlust.
Spalten dürfen priorisiert oder gestapelt werden.

### Mobile

Mobile dient primär zum Nachsehen und für einfache Aktionen.
Komplexe Tabellen dürfen in gezielte Listenansichten wechseln.

Keine reine Verkleinerung des Desktop-Layouts.

---

## 23. Sprache und Microcopy

Die Sprache ist:

- fachlich
- klar
- knapp
- schweizerisches Deutsch
- ohne Marketingfloskeln

Bevorzugt:

```text
Nachweis fehlt
Prüfung fällig
Dokument veraltet
Wirkung prüfen
3 kritische Punkte
```

Vermeiden:

```text
Oops!
Great job!
You're almost there!
Unlock your potential
```

Das Produkt kommuniziert wie ein gutes Fachwerkzeug.

---

## 24. Do / Don't

### Do

- klare Raster
- gemeinsame Achsen
- viel Bedeutung durch Typografie
- Deep Clinical Blue als Marke
- semantische Statusfarben
- strukturierte Tabellen
- feine Linien
- kleine Radien
- wenige Typostufen
- operative Prioritäten sichtbar machen
- Readiness und Fortschritt getrennt darstellen

### Don't

- generisches shadcn-Dashboard im Default-Look
- Card-Zoo
- riesige KPI-Kacheln
- starke Schatten auf jeder Fläche
- 16-px-Radien
- bunte Gradient-Flächen
- Glassmorphism
- Neonfarben
- dekorative Donut-Charts
- unnötige Animationen
- Emojis als UI-Icons
- Prozentwert als alleinige Readiness-Aussage

---

## 25. Google Stitch — verbindliche Vorgaben

Wenn Google Stitch Screens für Thomato erzeugt, muss der Prompt diese Regeln enthalten:

```text
Design a professional Swiss B2B healthcare quality-management application.

Style: Swiss Clinical Minimalism.
Brand color: Deep Clinical Blue #0052A8.

Use a strict grid, precise alignment, restrained typography, medium information density,
subtle borders, very small radii and almost no shadows.

Do not create a generic SaaS card dashboard.
Use typography, spacing, rules and tables to create hierarchy.

The primary dashboard concept is "Readiness + Action Center":
1. show qualitative IVR readiness status,
2. separately show quantitative documentation progress,
3. immediately show the items that need attention.

Red is reserved for critical/blocking states.
Green is reserved for fulfilled/success states.
Deep Clinical Blue is used for brand, navigation and primary actions.

Prefer tables, aligned metrics and linear indicators over donut charts and radial gauges.
Avoid gradients, glassmorphism, oversized rounded cards, decorative illustrations and playful animations.

The product should feel precise, calm, trustworthy, clinical and distinctly Swiss.
```

Dieser Block ist Ausgangspunkt, nicht vollständiger Screen-Prompt. Fachliche Inhalte werden pro Screen ergänzt.

---

## 26. Bestehende Oberfläche vs. Zielbild

| Bestehend | Zielbild |
|---|---|
| gute System-UI | Swiss Information Design |
| Deep Clinical Blue | Deep Clinical Blue beibehalten |
| viele Card-Flächen | stärkere zusammenhängende Informationsflächen |
| sichtbare Card-Shadows | Shadows nur bei echter Elevation |
| mehrere Kreis-/Ringanzeigen | Zahlen, Linien und lineare Indikatoren bevorzugen |
| Hover mit Anhebung | ruhiger Hover über Fläche/Border |
| funktionale Tabellen | Tabellen als erstklassiges Kernmuster weiter ausbauen |
| kleine Radien | beibehalten |
| vier Typostufen | beibehalten |
| Light + Dark | beibehalten |

Das Redesign ist damit **keine neue Markenidentität**, sondern eine Präzisierung der bereits vorhandenen Richtung.

---

## 27. Entscheidungsstand

### Entschieden

```text
✅ Swiss Clinical Minimalism
✅ Deep Clinical Blue #0052A8
✅ Readiness + Action Center als Dashboard-Grundidee
✅ qualitativer Readiness-Status + separater Fortschrittswert
✅ Information Design statt Card Dashboard
✅ kleine Radien
✅ wenig Shadows
✅ mittlere Informationsdichte
✅ semantische Statusfarben
✅ System Sans Serif
✅ bestehender Dark Mode bleibt
```

### Noch separat zu definieren

```text
○ endgültige Hauptnavigation / Informationsarchitektur
○ genaue Dashboard-Inhalte und Reihenfolge unterhalb des Action Centers
○ Detaildesign der Kriterienansicht
○ Detaildesign Dokumente / Handbuch
○ Detaildesign Qualitätskreisläufe
○ Detaildesign Beschwerden
○ SaaS-Administration / Organization Settings
```

Diese offenen Punkte dürfen von Stitch nicht selbst als Produktentscheidung erfunden werden.

---

## 28. Design-Mantra

> **Status zuerst. Handlung als Nächstes. Details danach.**

und

> **Information trägt die Oberfläche — nicht die Karte um die Information.**
