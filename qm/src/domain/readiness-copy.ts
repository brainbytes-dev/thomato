/** Hinweis im Dashboard, wenn Pflichtkriterien als nicht anwendbar markiert sind. */
export function naMandatoryNotice(n: number): string | null {
  if (n <= 0) return null;
  return n === 1
    ? "1 Pflichtkriterium als nicht anwendbar markiert"
    : `${n} Pflichtkriterien als nicht anwendbar markiert`;
}
