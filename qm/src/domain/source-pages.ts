/**
 * GENERIERT von scripts/gen-source-pages.ts (pnpm sources:gen). Nicht von Hand ändern.
 *
 * Zuordnung Katalognummer -> Quelle und Seite. Nur Nummern und Seitenzahlen, kein Dokumenttext.
 * Erzeugt aus: Richtlinien zur Anerkennung von Rettungsdiensten, 08/2025, Version 2022
 *   SHA-256 8eaa0c3a2ac02209e4a39d01d2c4baff5d501f35b0b99c61be6d04a5a9bb300c
 * und: Handbuch zum Verfahren, 08/2025, Version 2022
 *   SHA-256 99690f9839f37e44b4997c06b0983ae96dfaea977890998c2a9a42d9eaaecfaa
 * Seitenzahl = PDF-Seite = gedruckte Seitenzahl. 7.4.1 ist ein Unterpunkt ohne eigene Nummer
 * (Seite, auf der die Bezeichnung steht). Weicht die Prüfsumme eines PDFs ab (pnpm sources:check),
 * ist diese Zuordnung ungeprüft, bis sie neu erzeugt und kontrolliert wurde.
 */
import type { SourceId } from "./sources";

export const SOURCE_PAGES: Readonly<Record<string, { source: SourceId; page: number }>> = {
  "5.2.1": { source: "handbuch", page: 13 },
  "5.2.2": { source: "handbuch", page: 13 },
  "5.2.3": { source: "handbuch", page: 14 },
  "5.2.4": { source: "handbuch", page: 14 },
  "6.1": { source: "richtlinie", page: 11 },
  "6.2": { source: "richtlinie", page: 11 },
  "6.3.1": { source: "richtlinie", page: 11 },
  "6.3.2": { source: "richtlinie", page: 11 },
  "6.4": { source: "richtlinie", page: 11 },
  "6.5.1": { source: "richtlinie", page: 11 },
  "6.5.2": { source: "richtlinie", page: 11 },
  "6.6": { source: "richtlinie", page: 11 },
  "6.7": { source: "richtlinie", page: 12 },
  "6.8": { source: "richtlinie", page: 12 },
  "6.9": { source: "richtlinie", page: 12 },
  "6.10": { source: "richtlinie", page: 12 },
  "6.11": { source: "richtlinie", page: 12 },
  "6.11.1": { source: "richtlinie", page: 13 },
  "6.11.2": { source: "richtlinie", page: 13 },
  "6.11.3": { source: "richtlinie", page: 13 },
  "7.1": { source: "richtlinie", page: 14 },
  "7.2": { source: "richtlinie", page: 14 },
  "7.3": { source: "richtlinie", page: 15 },
  "7.3.1": { source: "richtlinie", page: 15 },
  "7.3.2": { source: "richtlinie", page: 15 },
  "7.3.3": { source: "richtlinie", page: 15 },
  "7.3.4": { source: "richtlinie", page: 15 },
  "7.3.5": { source: "richtlinie", page: 15 },
  "7.3.6": { source: "richtlinie", page: 15 },
  "7.3.7": { source: "richtlinie", page: 15 },
  "7.3.8": { source: "richtlinie", page: 15 },
  "7.3.9": { source: "richtlinie", page: 15 },
  "7.3.10": { source: "richtlinie", page: 15 },
  "7.3.11": { source: "richtlinie", page: 15 },
  "7.3.12": { source: "richtlinie", page: 16 },
  "7.3.13": { source: "richtlinie", page: 16 },
  "7.3.14": { source: "richtlinie", page: 16 },
  "7.3.15": { source: "richtlinie", page: 16 },
  "7.3.16": { source: "richtlinie", page: 16 },
  "7.3.17": { source: "richtlinie", page: 16 },
  "7.3.18": { source: "richtlinie", page: 16 },
  "7.3.19": { source: "richtlinie", page: 16 },
  "7.3.20": { source: "richtlinie", page: 16 },
  "7.4": { source: "richtlinie", page: 16 },
  "7.4.1": { source: "richtlinie", page: 17 },
  "7.5": { source: "richtlinie", page: 17 },
  "7.6": { source: "richtlinie", page: 17 },
  "7.7": { source: "richtlinie", page: 17 },
  "7.8": { source: "richtlinie", page: 18 },
  "7.9": { source: "richtlinie", page: 18 },
  "7.10": { source: "richtlinie", page: 18 },
  "8.1": { source: "richtlinie", page: 19 },
  "8.1.1": { source: "richtlinie", page: 19 },
  "8.1.2": { source: "richtlinie", page: 19 },
  "8.1.3": { source: "richtlinie", page: 19 },
  "8.1.4": { source: "richtlinie", page: 19 },
  "8.1.5": { source: "richtlinie", page: 20 },
  "8.2": { source: "richtlinie", page: 20 },
  "8.3": { source: "richtlinie", page: 20 },
  "8.4": { source: "richtlinie", page: 20 },
  "8.5": { source: "richtlinie", page: 20 },
};
