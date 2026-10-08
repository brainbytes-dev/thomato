export type Crumb = { label: string; href?: string };

const SECTIONS: ReadonlyArray<{ prefix: string; label: string }> = [
  { prefix: "/criteria", label: "Kriterien" },
  { prefix: "/measures", label: "Massnahmen" },
  { prefix: "/documents", label: "Dokumente" },
];

/** Brotkrumen «Organisation / Bereich [/ Detail]» aus dem Pfad. Das letzte Element ist die aktuelle Seite. */
export function breadcrumbsFor(pathname: string, organizationName: string): Crumb[] {
  const org: Crumb = { label: organizationName };
  if (pathname === "/") return [org, { label: "Übersicht" }];
  const section = SECTIONS.find((s) => pathname === s.prefix || pathname.startsWith(`${s.prefix}/`));
  if (!section) return [org];
  const rest = pathname.slice(section.prefix.length).split("/").filter(Boolean);
  if (rest.length === 0) return [org, { label: section.label }];
  // Massnahmen-IDs sind UUIDs und taugen nicht als Beschriftung.
  if (section.prefix === "/measures") return [org, { label: section.label, href: section.prefix }, { label: "Detail" }];
  let detail = rest[0];
  try {
    detail = decodeURIComponent(detail);
  } catch {
    // Ungültige Kodierung: Rohwert anzeigen.
  }
  return [org, { label: section.label, href: section.prefix }, { label: detail }];
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = [...parts[0]][0] ?? "";
  const last = parts.length > 1 ? ([...parts[parts.length - 1]][0] ?? "") : "";
  return (first + last).toUpperCase();
}
