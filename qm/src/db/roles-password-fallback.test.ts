import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { applyRoles } from "../../scripts/roles-lib";

type Call = { text: string; values?: unknown[] };

// Mock-Pool: protokolliert Aufrufe, format() wird nachgebildet (der Server ist hier nicht beteiligt).
function fakePool(failVerifier: Error | null) {
  const calls: Call[] = [];
  const pool = {
    async query(text: string, values?: unknown[]) {
      calls.push({ text, values });
      if (text.startsWith("SELECT format(")) {
        return { rows: [{ stmt: `ALTER ROLE qm_app PASSWORD '${String(values?.[0])}'` }] };
      }
      if (text.startsWith("ALTER ROLE qm_app PASSWORD") && failVerifier && text.includes("SCRAM-SHA-256$")) throw failVerifier;
      return { rows: [] };
    },
  } as unknown as Pool;
  return { pool, calls };
}

describe("applyRoles password handling", () => {
  it("sends only the SCRAM verifier when the server accepts it", async () => {
    const { pool, calls } = fakePool(null);
    await applyRoles(pool, "Geheim12345678", "SELECT 1");
    const alters = calls.filter((c) => c.text.startsWith("ALTER ROLE qm_app PASSWORD"));
    expect(alters).toHaveLength(1);
    expect(alters[0].text).toContain("SCRAM-SHA-256$");
    expect(JSON.stringify(calls)).not.toContain("Geheim12345678");
  });

  it("falls back to the plaintext password only for Neon's specific refusal", async () => {
    const { pool, calls } = fakePool(new Error('Received HTTP code 400: {"error":"Neon only supports being given plaintext passwords"}'));
    await applyRoles(pool, "Geheim12345678", "SELECT 1");
    const alters = calls.filter((c) => c.text.startsWith("ALTER ROLE qm_app PASSWORD"));
    expect(alters).toHaveLength(2);
    expect(alters[1].text).toContain("Geheim12345678");
  });

  it("does not fall back on unrelated errors", async () => {
    const { pool } = fakePool(new Error("permission denied"));
    await expect(applyRoles(pool, "Geheim12345678", "SELECT 1")).rejects.toThrow("permission denied");
  });
});
