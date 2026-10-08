import { closeMeasure, completeDo, completePlan, recordEffectiveness } from "@/domain/measure-pdca";
import type { OrgContext } from "@/domain/org-context";

/** Führt eine neue Massnahme über die echten Übergänge bis «erledigt» (ohne Checkliste, wirksam bewertet). */
export async function finishMeasure(ctx: OrgContext, id: string, completedAt: Date): Promise<void> {
  await completePlan(ctx, id);
  await completeDo(ctx, id, { confirmNoSteps: true });
  await recordEffectiveness(ctx, id, { result: "effective", note: "Wirksamkeit bestätigt (Test)" });
  await closeMeasure(ctx, id, {}, completedAt);
}
