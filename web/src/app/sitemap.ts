import { MetadataRoute } from "next";
import { brand } from "@/data/brand";
import { rechnerUrl } from "@/data/rechner";
import { qmToolUrl } from "@/data/qualitaetsmanagement-tool";

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
    {
      url: qmToolUrl,
      lastModified: new Date("2026-09-16"),
      changeFrequency: "yearly",
      priority: 0.8,
    },
  ];
}
