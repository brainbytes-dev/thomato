import { Plus } from "lucide-react";
import { BRAND } from "@/brand";

/** Logo-Quadrat und Wortmarke, gemeinsam für Login und Fehlerseiten. */
export function BrandMark() {
  return (
    <p className="flex items-center gap-2">
      <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-primary text-on-primary">
        <Plus className="size-3.5" strokeWidth={3} />
      </span>
      <span className="type-label font-semibold uppercase tracking-wider">{BRAND.name}</span>
    </p>
  );
}
