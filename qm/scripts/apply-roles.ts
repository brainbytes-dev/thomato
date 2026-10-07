import { Pool } from "pg";
import { applyRoles } from "./roles-lib";

// Bewusst KEIN .env-Laden: Besitzer-URL und Passwort kommen ausschliesslich aus der Prozessumgebung,
// damit nie versehentlich gegen eine falsche Datenbank oder mit abgelegten Geheimnissen gearbeitet wird.
async function main() {
  const url = process.env.DATABASE_URL_DIRECT;
  const password = process.env.QM_APP_PASSWORD;
  if (!url) throw new Error("DATABASE_URL_DIRECT fehlt (Besitzer-Verbindung, direkt, ohne Pooler; nur aus der Umgebung).");
  if (!password) throw new Error("QM_APP_PASSWORD fehlt (Passwort der Rolle qm_app; nur aus der Umgebung).");
  const parsed = new URL(url);
  if (parsed.hostname.includes("-pooler")) {
    throw new Error("DATABASE_URL_DIRECT zeigt auf einen Pooler (-pooler). Bitte die Direct-URL des Besitzers verwenden.");
  }
  if (decodeURIComponent(parsed.username) === "qm_app") {
    throw new Error("DATABASE_URL_DIRECT darf nicht der Benutzer qm_app sein, sondern der Besitzer.");
  }
  console.log(`Ziel: ${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}/${parsed.pathname.replace(/^\//, "")}`);
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
