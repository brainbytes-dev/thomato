import { z } from "zod";
import type { Db } from "@/db";
import { criterion, standardVersion } from "@/db/schema";

/** Entfernt Private-Use-, Steuer- und Format-Zeichen (Extraktionsreste aus dem PDF) und normalisiert Leerraum. */
function cleanTitle(raw: string): string {
  return raw.replace(/[\p{Co}\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/g, " ").trim();
}

export const catalogRowSchema = z.object({
  nummer: z.string().min(1),
  titel: z.string().min(1),
  kapitel: z.string().min(1),
  anerkennung_muss: z.boolean(),
  anerkennung_soll: z.boolean(),
  erneuerung_muss: z.boolean(),
  erneuerung_soll: z.boolean(),
  sortierung: z.number().int(),
});

export type CatalogInput = {
  standardVersionId: string;
  label: string;
  rows: unknown[];
};

export async function importCatalog(db: Db, input: CatalogInput): Promise<{ imported: number }> {
  const rows = z.array(catalogRowSchema).parse(input.rows);
  await db.transaction(async (tx) => {
    // Bestehende Version bleibt in ihrem Validierungsstatus, neue startet als draft_extracted.
    await tx
      .insert(standardVersion)
      .values({ id: input.standardVersionId, label: input.label })
      .onConflictDoNothing();
    for (const r of rows) {
      await tx
        .insert(criterion)
        .values({
          standardVersionId: input.standardVersionId,
          number: r.nummer,
          title: cleanTitle(r.titel),
          chapter: r.kapitel,
          mandatoryAccreditation: r.anerkennung_muss,
          shouldAccreditation: r.anerkennung_soll,
          mandatoryRenewal: r.erneuerung_muss,
          shouldRenewal: r.erneuerung_soll,
          sortOrder: r.sortierung,
        })
        .onConflictDoUpdate({
          target: [criterion.standardVersionId, criterion.number],
          set: {
            title: cleanTitle(r.titel),
            chapter: r.kapitel,
            mandatoryAccreditation: r.anerkennung_muss,
            shouldAccreditation: r.anerkennung_soll,
            mandatoryRenewal: r.erneuerung_muss,
            shouldRenewal: r.erneuerung_soll,
            sortOrder: r.sortierung,
          },
        });
    }
  });
  return { imported: rows.length };
}
