import "dotenv/config";
import { readFileSync } from "node:fs";
import { db } from "@/db";
import { importCatalog } from "@/domain/catalog";
import { ACTIVE_STANDARD_VERSION } from "@/db/schema";

const file = process.argv[2] ?? "../web/ivr/demo/kriterien.json";
const rows: unknown = JSON.parse(readFileSync(file, "utf8"));
if (!Array.isArray(rows)) throw new Error("Katalogdatei muss ein Array sein");

importCatalog(db, {
  standardVersionId: ACTIVE_STANDARD_VERSION,
  label: "IVR Rettungsdienst (Entwurf, aus Python-Demo extrahiert)",
  rows,
}).then((r) => {
  console.log(`Importiert: ${r.imported}`);
  process.exit(0);
});
