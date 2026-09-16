/**
 * Brand data layer – single source of truth derived from /brand/*.md
 * All content, copy, and structure originates from these markdown files.
 *
 * Thomato operates two equal pillars:
 *   1. Digitale Lösungen  – websites, small line-of-business apps, operations
 *   2. Sicherheit          – concepts and advisory. No on-site service: any
 *                            wording promising staff would trigger a permit.
 * Both rest on the same foundation: active paramedic experience.
 */

const safetyOffers = [
  {
    id: "01",
    title: "Sanitätskonzept",
    subtitle: "für Veranstaltungen",
    description:
      "Bemessung nach der Richtlinie des Interverbands für Rettungswesen. Sie erhalten ein Konzept, das der Bewilligungsbehörde standhält, und wissen genau, welche Mittel Sie bestellen müssen.",
    deliverables: [
      "Bemessung nach der Richtlinie des Interverbands für Rettungswesen",
      "Ein Konzept, das der Bewilligungsbehörde standhält",
      "Klare Liste der Mittel, die Sie bestellen müssen",
      "Grundlage für Ihr Gesuch um die Anlassbewilligung",
    ],
    link: {
      href: "/sanitaetsdienst-rechner",
      label: "Bedarf selbst berechnen",
    },
  },
  {
    id: "02",
    title: "Sicherheitskonzept",
    subtitle: "für Veranstalter & Gemeinden",
    description:
      "Zufahrten, Alarmierung, Zuständigkeiten und Abläufe für Veranstalter und Gemeinden. Schriftlich, nachvollziehbar, ohne Textbausteine.",
    deliverables: [
      "Zufahrten und Rettungsachsen",
      "Alarmierung und Zuständigkeiten, schriftlich festgehalten",
      "Abläufe für den Ernstfall, nachvollziehbar dokumentiert",
      "Ohne Textbausteine, auf Ihre Lage geschrieben",
    ],
  },
  {
    id: "03",
    title: "Ersthelferorganisation",
    subtitle: "im Betrieb",
    description:
      "Wer alarmiert, wer versorgt, wo liegt das Material und wer prüft es. Ich gehe mit Ihnen durch, was Sie heute haben, und sage Ihnen, was fehlt.",
    deliverables: [
      "Alarmierung und Zuständigkeiten im Betrieb geklärt",
      "Standort und Prüfung des Notfallmaterials geregelt",
      "Abgleich zwischen dem, was Sie haben, und dem, was fehlt",
      "Schriftliche Empfehlung zum Nachrüsten",
    ],
  },
  {
    id: "04",
    title: "Begehung und Beurteilung",
    subtitle: "Ihrer Notfallabläufe",
    description:
      "Eine Beurteilung Ihrer bestehenden Notfallabläufe vor Ort, mit schriftlichem Bericht und einer Liste der Massnahmen nach Dringlichkeit.",
    deliverables: [
      "Begehung Ihrer Räume und Abläufe",
      "Beurteilung der bestehenden Notfallorganisation",
      "Schriftlicher Bericht",
      "Massnahmenliste nach Dringlichkeit geordnet",
    ],
  },
] as const;

const digitalOffers = [
  {
    id: "01",
    title: "Website",
    subtitle: "für Praxen, Rettungsdienste und Pflegebetriebe",
    description:
      "Eine Seite, die Ihre Leistungen, Öffnungszeiten und Kontaktwege sauber zeigt. Schnell, auf dem Mobilgerät lesbar, in der Schweiz gehostet. Auf Wunsch mit Terminbuchung.",
    deliverables: [
      "Leistungen, Öffnungszeiten und Kontaktwege auf einen Blick",
      "Auf dem Mobilgerät gleich gut lesbar wie am Bildschirm",
      "Hosting in der Schweiz",
      "Online-Terminbuchung, wenn Sie sie brauchen",
    ],
  },
  {
    id: "02",
    title: "Fachanwendungen",
    subtitle: "Dienstplanung, Material, Medikamente",
    description:
      "Dienst- und Schichtplanung, Material- und Medikamentenverwaltung. Kleine Werkzeuge für Abläufe, die sonst in Tabellen enden.",
    deliverables: [
      "Dienst- und Schichtplanung mit Pikett und Verfügbarkeiten",
      "Material- und Medikamentenverwaltung mit Ablaufkontrolle",
      "Qualitätsmanagement für die Anerkennung als Rettungsdienst",
      "Zugeschnitten auf Ihren Ablauf statt umgekehrt",
    ],
    link: {
      href: "/qualitaetsmanagement-tool",
      label: "Beispiel: Qualitätsmanagement-Tool",
    },
  },
  {
    id: "03",
    title: "Betrieb und Wartung",
    subtitle: "im monatlichen Abonnement",
    description:
      "Hosting, Domain, Aktualisierungen und Inhaltspflege im Abonnement. Sie haben eine Ansprechperson, kein Ticketsystem.",
    deliverables: [
      "Hosting, Domain und Zertifikate in einer Hand",
      "Sicherheitsupdates und Aktualisierungen laufend",
      "Inhaltspflege auf Wunsch im Abonnement",
      "Eine feste Ansprechperson statt Ticketsystem",
    ],
  },
] as const;

export const brand = {
  name: "Thomato",
  tagline: "Digitale Lösungen & Notfallorganisation",
  description:
    "Websites und Fachanwendungen für Betriebe im Gesundheitswesen und Konzepte für die Notfallorganisation – beides aus über 15 Jahren Rettungsdienst.",
  established: 2026,
  location: "Luterbach SO",
  region: "Region Solothurn, Grenchen und Biel",
  /** Orte für `areaServed` im Schema; sichtbar steht die Region im Kontakt und im Fuss. */
  serviceArea: ["Luterbach", "Solothurn", "Grenchen", "Biel"],

  contact: {
    owner: "Michael Thoma",
    email: "info@thomato.ch",
    phone: "+41 76 447 68 61",
    /** Dieselbe Nummer ohne Leerzeichen, für tel:-Links.
     *
     * Beide stehen seit dem 15.09.2026 nur noch im Impressum. Wer sie
     * anderswo einbaut, veröffentlicht sie wieder; für den Kontakt gibt es
     * die E-Mail-Adresse und das Formular. */
    phoneHref: "+41764476861",
    street: "Fichtenweg 4",
    postalCode: "4542",
    city: "Luterbach",
    country: "Schweiz",
    address: "Fichtenweg 4, 4542 Luterbach",
  },

  /** Last review date of Impressum and Datenschutzerklärung. */
  legalUpdated: "8. September 2026",

  /**
   * Hauptpunkte sind die Abschnitte der Startseite. Die beiden Werkzeuge
   * hängen als Unterpunkte an ihrer Säule, statt eigene Hauptpunkte zu sein:
   * das Werkzeug gehört zur Leistung, nicht daneben.
   */
  nav: [
    {
      label: "Software",
      href: "#software",
      children: [
        { label: "Qualitätsmanagement-Tool", href: "/qualitaetsmanagement-tool" },
      ],
    },
    {
      label: "Sicherheit",
      href: "#sicherheit",
      children: [
        { label: "Sanitätsdienst-Rechner", href: "/sanitaetsdienst-rechner" },
      ],
    },
    { label: "Prozess", href: "#prozess" },
    { label: "FAQ", href: "#faq" },
    { label: "Kontakt", href: "#kontakt" },
  ],

  hero: {
    headline: ["Wissen aus der Praxis.", "Für Ihr Unternehmen."],
    /** Die Unterzeile nennt beide Angebote im ersten Bild; die Überschrift allein tut das nicht. */
    sub: "Websites für Praxen. Sanitätskonzepte für Anlässe.",
    body: "Websites und Fachanwendungen für Betriebe im Gesundheitswesen. Sanitäts- und Sicherheitskonzepte für Veranstalter und Gemeinden. Beides aus über 15 Jahren Rettungsdienst.",
    cta: { primary: "Anfrage stellen", secondary: "Leistungen ansehen" },
  },

  trust: [
    { label: "Rettungsdienst-Erfahrung", detail: "Aus über 15 Jahren Dienst" },
    { label: "Software aus der Praxis", detail: "Kein Branchenfremder" },
    { label: "Eine Ansprechperson", detail: "Kein Ticketsystem" },
    { label: "Schweizer Standard", detail: "IVR-Richtlinien & DSG" },
  ],

  /**
   * Two equal pillars – drives the Leistungen section, nav anchors, contact
   * form, marquee, JSON-LD and the social preview image, all from this order.
   *
   * Digital leads. Per the business plan it is pillar 1: it needs no permit,
   * already has a reference, and does not touch the employer. The medical
   * pillar depends on the Gesundheitsamt and the notice to Grenchen.
   */
  pillars: [
    {
      id: "software",
      label: "Digitale Lösungen",
      description:
        "Websites und Anwendungen für Arztpraxen, Rettungsdienste und Pflegebetriebe. Gebaut von jemandem, der Ihre Abläufe kennt.",
      offers: digitalOffers,
    },
    {
      id: "sicherheit",
      label: "Sicherheit und Notfallorganisation",
      description:
        "Konzepte und Beratung aus über 15 Jahren Rettungsdienst. Ich plane, was im Ernstfall funktionieren muss.",
      offers: safetyOffers,
      // Postendienst-Anfragen kommen, weil die Lücke in der Region echt ist.
      // Lieber ehrlich beantworten als ausweichen – und ohne eine Formulierung,
      // die nach Einsatzleistung klingt und eine Bewilligungspflicht auslöst.
      note: "Ich führe selbst keinen Sanitätsdienst an Veranstaltungen durch. Wenn Sie Personal für Ihren Anlass brauchen, erstelle ich Ihnen das Konzept und sage Ihnen, welche Anbieter in der Region dafür in Frage kommen.",
    },
  ],

  /** Flattened for marquee, JSON-LD and anything that needs the full catalogue. */
  offers: [...digitalOffers, ...safetyOffers],

  process: [
    {
      step: "01",
      title: "Kontaktaufnahme",
      description:
        "Schildern Sie mir Ihren Bedarf, unverbindlich und unkompliziert.",
      items: [
        "Antwort in der Regel am selben Werktag",
        "Telefonisch, per E-Mail oder Formular",
      ],
      note: "Am schnellsten geht es telefonisch.",
    },
    {
      step: "02",
      title: "Bedarfsanalyse",
      description:
        "Ich analysiere Ihre Situation und erstelle ein Angebot, das dazu passt.",
      items: [
        "Risikoanalyse, Konzept- oder Projektplanung",
        "Erstgespräch kostenlos und unverbindlich",
      ],
      note: "Das Erstgespräch kostet nichts. Was danach kommt, hat einen Preis, der vorher feststeht.",
    },
    {
      step: "03",
      title: "Umsetzung",
      description:
        "Sie erhalten das fertige Konzept oder die fertige Applikation – geprüft, dokumentiert und übergeben.",
      items: [
        "Konzepte schriftlich und behördentauglich",
        "Software in Etappen, jede einzeln abnehmbar",
      ],
      note: "In der Region Solothurn, Grenchen und Biel, mit einer festen Ansprechperson.",
    },
  ],

  differentiators: [
    {
      title: "Echte Rettungsdienst-Erfahrung",
      description:
        "Meine Leistungen basieren nicht auf Theorie, sondern auf über 15 Jahren Praxis im Rettungsdienst. Das merkt man jedem Konzept und jeder Anwendung an.",
    },
    {
      title: "Software, die den Betrieb schon kennt",
      description:
        "Ich habe Dienstpläne getauscht, Rucksäcke kontrolliert und Ablaufdaten übersehen. Deshalb baue ich Applikationen, die Ihren Ablauf abbilden statt ihn umzubauen. Sie müssen mir Ihre Branche nicht erst erklären.",
    },
    {
      title: "Individuelle Lösungen",
      description:
        "Keine Standardpakete. Jedes Konzept und jede Applikation wird auf Ihre spezifischen Anforderungen zugeschnitten – in Grösse, Tiefe und Umfang.",
    },
    {
      title: "Volle Verlässlichkeit",
      description:
        "Zugesagte Termine halten. Was ich schreibe, hält der Bewilligungsbehörde stand, und was ich baue, läuft auch dann noch, wenn niemand hinschaut. Sicherheit kennt keine Ausnahmen – und keine Entschuldigungen.",
    },
  ],

  faqs: [
    {
      question: "Führen Sie den Sanitätsdienst an unserem Anlass auch durch?",
      answer:
        "Nein. Ich erstelle das Konzept und bemesse den Bedarf nach der Richtlinie des Interverbands für Rettungswesen. Für die Durchführung sage ich Ihnen, welche Anbieter in der Region dafür in Frage kommen.",
    },
    {
      question: "Wonach wird ein Sanitätskonzept bemessen?",
      answer:
        "Nach der Richtlinie des Interverbands für Rettungswesen für den Sanitätsdienst bei Veranstaltungen. Das ist die Grundlage, die auch die Gemeinde bei der Anlassbewilligung erwartet – Sie erhalten damit ein Konzept, das der Bewilligungsbehörde standhält.",
    },
    {
      question:
        "Warum sollte ich Software von einem Rettungssanitäter entwickeln lassen?",
      answer:
        "Weil der teuerste Teil eines Softwareprojekts das Erklären ist. Ich kenne Dienstpläne, Materialkontrollen und den Ablauf in einem medizinischen Betrieb aus eigener Erfahrung. Sie beschreiben mir nicht Ihre Branche, sondern nur Ihren konkreten Fall.",
    },
    {
      question: "Wo werden die Daten unserer Applikation gespeichert?",
      answer:
        "In der Schweiz oder im EU-Raum, je nach Anforderung. Ich arbeite nach dem Schweizer Datenschutzgesetz (DSG). Sind Patientendaten im Spiel, kläre ich die Anforderungen vor Projektstart schriftlich ab.",
    },
    {
      question: "Was kostet eine Web-Applikation?",
      answer:
        "Das hängt vom Umfang ab. Ich starte mit einem kostenlosen Erstgespräch und einer Aufwandschätzung in Etappen. Nach jeder Etappe entscheiden Sie, ob es weitergeht – keine Pauschale ins Blaue.",
    },
    {
      question: "Übernehmen Sie auch Wartung und Weiterentwicklung?",
      answer:
        "Ja. Eine Applikation ist mit dem Launch nicht fertig. Wartung, Support und Weiterentwicklung gibt es als monatliche Vereinbarung oder auf Abruf.",
    },
    {
      question: "Übernehmen Sie auch die Koordination mit Behörden?",
      answer:
        "Ja. Auf Wunsch unterstütze ich Sie bei der Kommunikation mit Gemeinden und Polizei sowie bei der Erstellung behördenkonformer Sicherheitskonzepte.",
    },
  ],

  /**
   * Die Person hinter der Marke. Bewusst ohne Arbeitgeber und ohne Titel der
   * Dienststelle; das kommt erst nach dem Entscheid des Personalamts dazu.
   */
  person: {
    name: "Michael Thoma",
    role: "Rettungssanitäter, seit über 15 Jahren im Dienst, heute in leitender Funktion",
    summary:
      "Dienstpläne, Materialkontrollen, Konzepte für Anlässe, Gespräche mit Gemeinden und Polizei: Das ist mein Alltag, nicht meine Theorie. Thomato ist der Teil davon, den ich für Sie planen und bauen kann.",
  },

  /** Grouped options for the contact form select – mirrors the two pillars. */
  serviceGroups: [
    {
      label: "Digitale Lösungen",
      options: [
        "Website",
        "Fachanwendung",
        "Betrieb und Wartung",
      ],
    },
    {
      label: "Sicherheit und Notfallorganisation",
      options: [
        "Sanitätskonzept",
        "Sicherheitskonzept",
        "Ersthelferorganisation",
        "Begehung und Beurteilung",
      ],
    },
    {
      label: "Weiteres",
      options: ["Sonstiges"],
    },
  ],

  meta: {
    // Titel und Beschreibung tragen die Suchbegriffe und den Ort. Beides wird
    // in den Suchergebnissen abgeschnitten: Titel ab rund 60 Zeichen,
    // Beschreibung ab rund 155.
    title: "Sanitätskonzept & Website für Praxen | Thomato Solothurn",
    description:
      "Sanitätskonzept nach IVR-Richtlinie für Ihren Anlass, Website und Fachanwendung für Ihre Praxis. Aus der Praxis, für Solothurn, Grenchen und Biel.",
    url: "https://thomato.ch",
  },
} as const;

export type Brand = typeof brand;
export type Pillar = (typeof brand.pillars)[number];
export type Offer = (typeof brand.offers)[number];
export type FAQ = (typeof brand.faqs)[number];
export type ProcessStep = (typeof brand.process)[number];
export type Differentiator = (typeof brand.differentiators)[number];
export type TrustItem = (typeof brand.trust)[number];
