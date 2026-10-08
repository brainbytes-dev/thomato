import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WISSEN_DISCLAIMER, WISSEN_DRAFT_LABEL } from "@/content/wissen";

export function DraftMarker({ draft }: { draft: boolean }) {
  if (!draft) return null;
  return <Badge tone="warning" dot>{WISSEN_DRAFT_LABEL}</Badge>;
}

export function Disclaimer() {
  return (
    <p className="type-meta flex items-center gap-2 text-text-muted">
      <Info aria-hidden="true" className="size-4 shrink-0" />
      <span>{WISSEN_DISCLAIMER}</span>
    </p>
  );
}
