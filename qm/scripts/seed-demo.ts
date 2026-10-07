import "dotenv/config";
import { readFileSync } from "node:fs";

process.env.ALLOW_DEMO_RESET ??= process.argv.includes("--yes-reset") ? "1" : "";
const catalog: unknown = JSON.parse(readFileSync("../web/ivr/demo/kriterien.json", "utf8"));

async function main() {
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
