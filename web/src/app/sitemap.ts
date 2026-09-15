import { MetadataRoute } from "next";
import { brand } from "@/data/brand";
import { rechnerUrl } from "@/data/rechner";
import { ivrUrl } from "@/data/ivr-anerkennung";

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
      url: ivrUrl,
      lastModified: new Date("2026-09-15"),
      changeFrequency: "yearly",
      priority: 0.8,
    },
  ];
}
