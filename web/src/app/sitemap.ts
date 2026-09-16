import { MetadataRoute } from "next";
import { brand } from "@/data/brand";
import { rechnerUrl } from "@/data/rechner";

// Feste Daten statt `new Date()`: sonst meldet jeder Build eine Änderung, und
// die Suchmaschine lernt, dass das Datum nichts bedeutet.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: brand.meta.url,
      lastModified: new Date("2026-09-08"),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: rechnerUrl,
      lastModified: new Date("2026-09-08"),
      changeFrequency: "yearly",
      priority: 0.8,
    },
    // Das Qualitätsmanagement-Tool steht seit dem 16.09.2026 hinter einer
    // Sperre, solange die Namensfrage offen ist, siehe src/middleware.ts.
    // Eine Seite, die mit 401 antwortet, gehört nicht in die Sitemap: die
    // Search Console meldet sie sonst als Fehler. Kommt mit dem Aufschalten
    // zurück, `qmToolUrl` liefert die Adresse.
  ];
}
