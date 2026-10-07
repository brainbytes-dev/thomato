import { config } from "dotenv";
import { Pool } from "pg";
import { applyRoles } from "./roles-lib";

config({ path: ".env" });

async function main() {
  const url = process.env.DATABASE_URL_DIRECT;
  const password = process.env.QM_APP_PASSWORD;
  if (!url) throw new Error("DATABASE_URL_DIRECT fehlt (Besitzer-Verbindung, direkt, ohne Pooler).");
  if (!password) throw new Error("QM_APP_PASSWORD fehlt (Passwort der Rolle qm_app, nur aus der Umgebung).");
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await applyRoles(pool, password);
  } finally {
    await pool.end();
  }
  console.log("Rolle qm_app bereit");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unbekannter Fehler");
  process.exit(1);
});
