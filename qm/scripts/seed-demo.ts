// Zerstörerisch: leert alle Tabellen. Zwei Hürden:
// 1. CLI verlangt --yes-reset (eine vorgesetzte ALLOW_DEMO_RESET-Variable genügt nicht).
// 2. seedDemo verweigert nicht-lokale DATABASE_URL, ausser ALLOW_DEMO_RESET_REMOTE=1 ist gesetzt.
import "dotenv/config";
import { readFileSync } from "node:fs";

if (!process.argv.includes("--yes-reset")) {
  console.error("Abbruch: Der Demo-Seed leert die Datenbank. Mit --yes-reset bestätigen.");
  process.exit(1);
}
process.env.ALLOW_DEMO_RESET = "1";

async function main() {
  const catalog: unknown = JSON.parse(readFileSync("../web/ivr/demo/kriterien.json", "utf8"));
  // Dynamischer Import: db/auth lesen die Umgebung erst nach dotenv.
  const { seedDemo } = await import("@/seed/demo");
  const out = await seedDemo({ catalog });
  console.log("Demo bereit. Organisation:", out.organizationId);
  for (const [role, u] of Object.entries(out.users)) console.log(role, u.email, u.password);
}

main().then(
  () => process.exit(0),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
