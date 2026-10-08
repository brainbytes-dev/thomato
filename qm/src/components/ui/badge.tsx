import type { ReactNode } from "react";

export type BadgeTone = "critical" | "warning" | "success" | "neutral" | "primary";

const TONE: Record<BadgeTone, string> = {
  critical: "bg-critical-tint text-critical",
  warning: "bg-warning-tint text-warning",
  success: "bg-success-tint text-success",
  primary: "bg-primary-subtle text-primary",
  neutral: "bg-surface-subtle text-text-muted border border-border",
};

const DOT: Record<BadgeTone, string> = {
  critical: "bg-critical",
  warning: "bg-warning",
  success: "bg-success",
  primary: "bg-primary",
  neutral: "bg-text-muted",
};

/** Status immer als Wort, die Farbe verstärkt nur. */
export function Badge({
  tone,
  children,
  dot = false,
  upper = false,
  title,
  className = "",
}: {
  tone: BadgeTone;
  children: ReactNode;
  dot?: boolean;
  upper?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={`type-badge inline-flex items-center gap-2 whitespace-nowrap rounded-[3px] px-2 py-0.5 ${upper ? "uppercase" : ""} ${TONE[tone]} ${className}`}
    >
      {dot && <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${DOT[tone]}`} />}
      {children}
    </span>
  );
}

export const CARD = "rounded-xl border border-border bg-surface";
