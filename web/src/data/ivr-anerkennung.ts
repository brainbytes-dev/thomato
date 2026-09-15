import { brand } from "@/data/brand";

/**
 * Inhalte der Produktseite unter /ivr-anerkennung.
 *
 * Getrennt von brand.ts, weil es eine Unterseite beschreibt und nicht die
 * Marke. Texte werden hier geändert, nicht in den Komponenten, gleiche Regel
 * wie bei brand.ts und rechner.ts.
 *
 * Die Adresse der Demo steht in `demo.url`. Ist sie leer, zeigt die Seite
 * statt des Knopfes den Hinweis, dass die Demo auf Anfrage läuft. So bleibt
 * die Seite richtig, auch bevor die Demo eine feste Adresse hat.
 */
export const ivr = {
  pfad: "/ivr-anerkennung",
  name: "IVR-Anerkennung",

  titel: "Software für die IVR-Anerkennung eines Rettungsdienstes",
  beschreibung:
    "Dossier, Betriebshandbuch und Qualitätskreisläufe an einem Ort. Die Anwendung beantwortet vor dem Expertenbesuch die Frage, die zählt: Was fehlt noch, und bis wann?",
  schluesselwoerter:
    "IVR Anerkennung, Rezertifizierung Rettungsdienst, Qualitätsmanagement Rettungsdienst, Betriebshandbuch Rettungsdienst, Qualitätskreislauf PDCA DMAIC, Anerkennungsdossier IVR, Prozesslandkarte Rettungsdienst",

  h1: "Die Anerkennung vorbereiten, ohne den Überblick zu verlieren",
  vorspann:
    "Ein Anerkennungsdossier besteht aus Hunderten Dateien, einundsechzig Kriterien und drei Fristen. Wer es in Ordnern und Tabellen führt, weiss nie genau, wo er steht. Diese Anwendung weiss es jederzeit.",
  vorspannZwei:
    "Gebaut für den eigenen Rettungsdienst, im Betrieb seit September 2026, für die Erneuerung 2028. Sie ist kein Baukasten für alles, sondern ein Werkzeug für diesen einen Zweck.",

  /** Die Demo mit erfundenen Daten. Leer lassen, solange keine läuft. */
  demo: {
    url: "/ivr-anerkennung/demo",
    label: "Demo öffnen und ausprobieren",
    /** Kürzer, für den zweiten Knopf weiter unten auf der Seite. */
    labelKurz: "Demo testen",
    hinweis:
      "Alle Daten in der Demo sind erfunden. Der Betrieb «Rettungsdienst Musterstadt» existiert nicht, die Fälle, Messwerte und Dokumente ebenso wenig.",
    zugang:
      "Drei Zugänge, einer je Rechtestufe: lesen, schreiben und admin, Passwort bei allen drei demo. So sehen Sie auch, was eine Stufe darf und was nicht. Sie dürfen darin alles anfassen, auch löschen; nach kurzer Zeit steht wieder der Ausgangsstand da.",
  },

  /** Das Problem, in der Sprache des Betriebs. */
  problem: {
    titel: "Warum das mühsam ist",
    absaetze: [
      "Die Anerkennung gilt vier Jahre. In dieser Zeit sammeln sich Dienstanweisungen, Konzepte, Auswertungen und Nachweise an verschiedenen Orten an: im SharePoint, im Laufwerk, im Ordner auf dem Pult. Vor dem Besuch der Expertinnen und Experten beginnt dann die Suche.",
      "Am meisten Zeit kostet nicht das Schreiben, sondern die Frage, was überhaupt fehlt. Welche Kriterien sind belegt? Welche Datei gilt noch, welche ist von 2018? Und welcher Qualitätskreislauf ist wirklich geschlossen, also mit einer zweiten Messung, die Wirkung zeigt?",
      "Diese Fragen beantwortet eine Ordnerstruktur nicht. Eine Tabelle beantwortet sie einmal und ist zwei Wochen später falsch.",
    ],
  },

  /** Was die Anwendung kann, je ein Bild dazu. */
  bereiche: [
    {
      id: "uebersicht",
      titel: "Übersicht",
      text: "Alle Kriterien nach Antrag, Struktur, Prozess und Ergebnis, mit dem Stand aus dem letzten Expertenbericht und den Nachweisen im Dossier. Dazu die drei Fristen und der berechnete letzte sinnvolle Starttag für einen Qualitätskreislauf: Messung, Massnahme und Nachmessung brauchen Zeit, und irgendwann reicht sie nicht mehr.",
      bild: "/ivr/uebersicht.jpg",
      alt: "Übersicht der Anwendung mit Zeitstrahl der Fristen und einer offenen Auflage",
    },
    {
      id: "handbuch",
      titel: "Betriebshandbuch",
      text: "Je Kriterium die Dokumente, die im Betrieb gelten, mit Version, letzter Bestätigung und nächster Prüfung. Volltextsuche über Kriterien und den Inhalt der abgelegten Dateien. Jede Datei trägt ihr Prüfdatum, und geprüft heisst freigegeben: sie wandert dabei in den Ordner, der beim Besuch zählt.",
      bild: "/ivr/handbuch.jpg",
      alt: "Handbuchseite mit dem Prüfstand der Dossierdateien",
    },
    {
      id: "kreislauf",
      titel: "Qualitätskreisläufe",
      text: "Fünf Monitoringbereiche nach Kapitel 8.1, davon drei tragend zur Erneuerung. Je Bereich beliebig viele Kreisläufe, wahlweise als PDCA mit drei Schritten oder als DMAIC nach Six Sigma mit fünf. Ein Kreislauf gilt erst als geschlossen, wenn die Nachmessung die Wirksamkeit belegt. Genau das prüft das IVR.",
      bild: "/ivr/kreislauf.jpg",
      alt: "Ein Qualitätskreislauf in den fünf DMAIC-Schritten",
    },
    {
      id: "landkarte",
      titel: "Prozesslandkarte",
      text: "Führungs-, Kern- und Unterstützungsprozesse als Karte, jeder Teilprozess mit den Kriterien, aus denen er stammt, und mit deren Stand. Lücken werden sichtbar, statt unbemerkt zu bleiben, und die Karte lässt sich so ins Dossier legen.",
      bild: "/ivr/prozesslandkarte.jpg",
      alt: "Prozesslandkarte mit Bändern, Prozessen und Abdeckung der Kriterien",
    },
  ],

  /** Kürzere Punkte, die sonst untergehen. */
  weiteres: [
    {
      titel: "Beschwerdemanagement",
      text: "Fälle mit Weg, Kategorie, fachlicher Beurteilung und Bewertung, mit Anhängen, ausgewertet nach Jahr und Kategorie. Kriterium 8.1.3 ist damit belegt, ohne eine zweite Ablage zu führen.",
    },
    {
      titel: "Auflagen und Mängel",
      text: "Was der Expertenbericht bemängelt hat, was daraus wurde, und die Auflagen aus dem Verfahren mit ihren Fristen. Sichtbar auf der Übersicht, in der Landkarte und im Handbuch.",
    },
    {
      titel: "Drei Rechtestufen",
      text: "Lesen sieht alles. Schreiben erfasst und legt Dateien ab. Verwalten prüft, setzt Prüfdaten und nimmt Dokumente ins Handbuch. Wer nur zuschaut, kann nichts verstellen.",
    },
    {
      titel: "Auswertungen",
      text: "Hilfsfrist, Indikatordiagnosen, Ereignismeldungen und Befragungen aus den Exporten der Leitstelle und der Meldesysteme, gezeichnet statt aufgezählt.",
    },
  ],

  /** Für wen es sonst noch taugt. */
  zielgruppen: {
    titel: "Nicht nur für Rettungsdienste",
    absaetze: [
      "Gebaut ist die Anwendung für die Anerkennung eines Rettungsdienstes. Die Struktur dahinter ist aber überall dieselbe, wo der Interverband für Rettungswesen Auflagen macht: eine Liste von Kriterien, Nachweise dazu, Fristen, und der Beleg, dass eine Massnahme gewirkt hat.",
      "Angepasst werden die Kriterienliste und die Prozesslandkarte. Beides ist Inhalt und kein Programmcode, und beides wird einmal eingerichtet statt dauernd gepflegt.",
    ],
    punkte: [
      "Samaritervereine mit Sanitätsdienst an Veranstaltungen",
      "Betriebe mit Auflagen aus einem Anerkennungsverfahren",
      "Ausbildungs- und Schulungsbetriebe im Rettungswesen",
      "Jede Organisation, die Nachweise, Fristen und Qualitätskreisläufe an einem Ort führen will",
    ],
    schluss:
      "Ob es für Ihren Fall passt, lässt sich in einem Gespräch schneller klären als in einer Offerte. Schauen Sie vorher in die Demo, dann reden wir über etwas, das Sie gesehen haben.",
  },

  technik: {
    titel: "Technik",
    text: "Python mit FastAPI und SQLite, Vorlagen ohne Bauschritt, Diagramme als selbst gezeichnetes SVG. Keine fremde Wolke, keine Abhängigkeit von einem Anbieter: die Anwendung läuft auf einem Server im eigenen Haus oder auf einem gemieteten. Die Daten bleiben, wo der Betrieb sie haben will.",
    punkte: [
      "Ein Dienst, eine Datenbankdatei, ein Ordner für das Dossier.",
      "Tägliche Sicherung, Wiederherstellung durch Zurückkopieren.",
      "Anmeldung mit Passwort, davor auf Wunsch ein Zugangsschutz.",
      "Keine Personendaten ausser den Konten und dem, was der Betrieb selbst erfasst.",
    ],
  },

  faq: [
    {
      frage: "Ist das auf einen bestimmten Rettungsdienst zugeschnitten?",
      antwort:
        "Nein. Der Name des Betriebs, die Fristen, die tragenden Monitoringbereiche und der Vorgehenszyklus sind Einstellungen. Die Kriterien kommen aus der Richtlinie und werden eingelesen, nicht abgetippt. Angepasst wird die Prozesslandkarte, weil sie den eigenen Betrieb beschreibt. Das gilt auch über den Rettungsdienst hinaus: für Samaritervereine und andere Organisationen mit Auflagen des IVR lässt sich dieselbe Anwendung auf deren Kriterien stellen.",
    },
    {
      frage: "Wo liegen die Daten?",
      antwort:
        "Dort, wo der Betrieb sie haben will. Die Anwendung ist ein Dienst mit einer Datenbankdatei und einem Dossierordner. Im Einsatz läuft sie auf einem Server im eigenen Haus, erreichbar über einen geschützten Zugang von aussen.",
    },
    {
      frage: "Ersetzt das ein Qualitätsmanagementsystem?",
      antwort:
        "Nein, es führt eines. Die Arbeit bleibt: messen, Massnahmen beschliessen, nachmessen, Dokumente aktuell halten. Die Anwendung sorgt dafür, dass diese Arbeit sichtbar ist und nichts dabei untergeht.",
    },
    {
      frage: "Kann ich es bekommen?",
      antwort:
        "Reden wir darüber. Sinnvoll ist eine Einführung mit dem eigenen Dossier: Kriterien einlesen, Prozesslandkarte auf den Betrieb bringen, laufende Kreisläufe eintragen. Danach führt der Betrieb es selbst.",
    },
  ],

  abschluss: {
    titel: "Interesse?",
    text: "Schreiben Sie kurz, wann Ihre Anerkennung abläuft und wie Sie das Dossier heute führen. Ich melde mich mit einer ehrlichen Einschätzung, ob sich der Umstieg für Sie lohnt.",
  },
} as const;

export const ivrUrl = `${brand.meta.url}${ivr.pfad}`;
