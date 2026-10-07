import { z } from "zod";
import { isValidIsoDate } from "@/domain/dates";
import { MAX_FILE_BYTES } from "@/domain/file-validation";
import type { UploadInput } from "@/domain/documents";

const number = z.string().min(1).max(40);
const validUntil = z
  .string()
  .max(20)
  .refine((v) => v === "" || isValidIsoDate(v), "Die Gültigkeit muss ein gültiges Datum sein.")
  .optional();

export const uploadInput = z.object({
  number,
  title: z.string().trim().min(3).max(120),
  validUntil,
});

export const versionInput = z.object({
  number,
  documentId: z.uuid(),
  validUntil,
});

export const linkInput = z.object({ number, documentId: z.uuid() });

export const unlinkInput = z.object({ number, linkId: z.uuid() });

type FileLike = { name: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };

function isFileLike(value: unknown): value is FileLike {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === "string" && typeof v.size === "number" && typeof v.arrayBuffer === "function";
}

/** Liest einen Formular-Eintrag als Datei. Prüft die Grösse VOR dem Lesen; der Typ des Clients wird ignoriert. */
export async function readFile(value: unknown): Promise<UploadInput | null> {
  if (!isFileLike(value)) return null;
  if (value.size <= 0 || value.size > MAX_FILE_BYTES) return null;
  const bytes = new Uint8Array(await value.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_FILE_BYTES) return null;
  return { name: value.name, bytes };
}
