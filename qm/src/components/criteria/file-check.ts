/** Reine Vorprüfung im Browser. Der Server bleibt massgebend; das hier verhindert nur den Request-Body-Fehler von Next. */
export function checkClientFile(size: number, maxBytes: number): string | null {
  if (size <= 0) return "Die Datei ist leer.";
  if (size > maxBytes) return `Die Datei ist grösser als ${maxBytes / (1024 * 1024)} MB.`;
  return null;
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1).replace(".", ",")} KB`;
  return `${(size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
