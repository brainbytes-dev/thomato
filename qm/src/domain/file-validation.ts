export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_FILE_NAME = 120;
const MAX_EXTENSION = 10;

export type AllowedFile = { fileName: string; mimeType: string; size: number };

const TYPES: Record<string, { mime: string; magic: readonly (readonly number[])[] }> = {
  pdf: { mime: "application/pdf", magic: [[0x25, 0x50, 0x44, 0x46, 0x2d]] },
  png: { mime: "image/png", magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  jpg: { mime: "image/jpeg", magic: [[0xff, 0xd8, 0xff]] },
  jpeg: { mime: "image/jpeg", magic: [[0xff, 0xd8, 0xff]] },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    magic: [[0x50, 0x4b, 0x03, 0x04]],
  },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    magic: [[0x50, 0x4b, 0x03, 0x04]],
  },
};

/** Entfernt Pfade, Steuerzeichen und Anführungszeichen, begrenzt die Länge, behält die Endung. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069"]/g, "").trim();
  const dot = cleaned.lastIndexOf(".");
  const rawExt = dot > 0 ? cleaned.slice(dot) : dot === 0 ? cleaned : "";
  const ext = [...rawExt].slice(0, MAX_EXTENSION).join("");
  const stem = dot > 0 ? cleaned.slice(0, dot).trim() : dot === 0 ? "" : cleaned;
  const safeStem = stem.length > 0 ? stem : "dokument";
  const room = Math.max(1, MAX_FILE_NAME - [...ext].length);
  return `${[...safeStem].slice(0, room).join("")}${ext}`;
}

export function validateUpload(input: {
  name: string;
  bytes: Uint8Array;
}): { ok: true; file: AllowedFile } | { ok: false; error: string } {
  const fileName = sanitizeFileName(input.name);
  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
  const type = Object.hasOwn(TYPES, ext) ? TYPES[ext] : undefined;
  if (!type) return { ok: false, error: "Dateityp nicht erlaubt. Erlaubt sind PDF, PNG, JPG, DOCX und XLSX." };
  if (input.bytes.length === 0) return { ok: false, error: "Die Datei ist leer." };
  if (input.bytes.length > MAX_FILE_BYTES) {
    return { ok: false, error: "Die Datei ist grösser als 4 MiB." };
  }
  const matches = type.magic.some((m) => m.every((b, i) => input.bytes[i] === b));
  if (!matches) return { ok: false, error: "Der Inhalt passt nicht zur Dateiendung." };
  return { ok: true, file: { fileName, mimeType: type.mime, size: input.bytes.length } };
}
