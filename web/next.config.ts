import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Die Schriften für das Vorschaubild liegen ausserhalb von public und werden
  // per fs gelesen – ohne diesen Eintrag fehlen sie, falls das Bild einmal zur
  // Laufzeit statt beim Build erzeugt wird.
  outputFileTracingIncludes: {
    "/opengraph-image": ["./src/assets/fonts/*.ttf"],
    "/twitter-image": ["./src/assets/fonts/*.ttf"],
    // Das PDF des Sanitaetsdienst-Rechners setzt dieselben Schriften.
    "/api/rechner-pdf": ["./src/assets/fonts/*.ttf"],
    "/sanitaetsdienst-rechner/opengraph-image": ["./src/assets/fonts/*.ttf"],
  },

  // Schreibweisen, die jemand von Hand eintippt oder in eine Mail schreibt.
  // Kanonisch ist /sanitaetsdienst-rechner: Google liest Bindestriche als
  // Worttrennung, eine zusammengeschriebene Adresse ist ein unbekanntes Wort.
  async redirects() {
    return [
      {
        source: "/sanitatsdienstrechner",
        destination: "/sanitaetsdienst-rechner",
        permanent: true,
      },
      {
        source: "/sanitaetsdienstrechner",
        destination: "/sanitaetsdienst-rechner",
        permanent: true,
      },
      {
        source: "/sanitaetsdienstrechner-veranstaltung",
        destination: "/sanitaetsdienst-rechner",
        permanent: true,
      },
      // Die Produktseite hiess bis zum 16.09.2026 nach dem Kürzel des
      // Interverbands. Das Kürzel ist geschützt, die Adresse leitet um, auch
      // die der Demo darunter.
      {
        source: "/ivr-anerkennung",
        destination: "/qualitaetsmanagement-tool",
        permanent: true,
      },
      // Der Platzhalter allein liesse die Wurzel auf «/qualitaetsmanagement-tool/»
      // landen, mit Schrägstrich, und Next nähme ihn in einem zweiten Sprung
      // wieder weg. Deshalb steht die Wurzel oben einzeln.
      {
        source: "/ivr-anerkennung/:pfad+",
        destination: "/qualitaetsmanagement-tool/:pfad+",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
