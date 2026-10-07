import { formatDaysDative, formatMonths } from "./dates";
import type { ExpiryInfo } from "./dashboard";

export type ExpiryCopy = { stat: string; tone: "critical" | "normal" | "muted"; line: string | null };

export function describeExpiry(expiry: ExpiryInfo | null): ExpiryCopy {
  if (expiry === null) return { stat: "k. A.", tone: "muted", line: null };
  if (expiry.kind === "months") return { stat: formatMonths(expiry.months), tone: "normal", line: null };
  const days = formatDaysDative(expiry.days);
  return {
    stat: `abgelaufen seit ${days}`,
    tone: "critical",
    line: `Die Anerkennung ist seit ${days} abgelaufen.`,
  };
}
