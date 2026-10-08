import type { CriteriaGroup } from "@/domain/source-reference";

/** Gruppenzeile der Kriterientabelle (Kapitelüberschrift nach Richtlinie). */
export function GroupHeadingRow({ group, colSpan }: { group: CriteriaGroup; colSpan: number }) {
  return (
    <tr className="bg-surface-subtle">
      <th scope="colgroup" colSpan={colSpan} className="type-label px-4 py-3 text-left">{group.heading}</th>
    </tr>
  );
}
