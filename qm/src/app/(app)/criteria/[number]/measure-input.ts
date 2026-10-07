import { z } from "zod";
import { MEASURE_STATUSES } from "@/db/schema";
import { isValidIsoDate } from "@/domain/dates";

const number = z.string().min(1).max(40);
const title = z.string("Der Titel muss zwischen 3 und 120 Zeichen lang sein.").trim().refine((v) => [...v].length >= 3 && [...v].length <= 120, "Der Titel muss zwischen 3 und 120 Zeichen lang sein.");
const description = z
  .string("Die Beschreibung ist ungültig.")
  .refine((v) => [...v.trim()].length <= 1000, "Die Beschreibung darf höchstens 1000 Zeichen lang sein.")
  .optional();
const dueDate = z.string("Die Frist ist ungültig.").max(20, "Die Frist ist ungültig.").refine(isValidIsoDate, "Die Frist ist ungültig.");
// Better Auth vergibt keine UUIDs; die Mitgliedschaftsprüfung im Service ist die eigentliche Validierung.
const ownerUserId = z.string().min(1).max(64);
const measureId = z.uuid();

const fields = { title, description, ownerUserId, dueDate };

export const createMeasureInput = z.object({ number, ...fields });
export const updateMeasureInput = z.object({ number, measureId, ...fields });
export const statusInput = z.object({ number, measureId, status: z.enum(MEASURE_STATUSES) });
