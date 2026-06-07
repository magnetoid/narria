import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "accent" | "sage" | "gold" | "muted" | "outline";

const variants: Record<BadgeVariant, string> = {
  default: "bg-surface-2 text-ink-soft",
  accent: "bg-accent-soft text-accent",
  sage: "bg-sage-soft text-sage",
  gold: "bg-gold-soft text-gold",
  muted: "bg-surface-2 text-muted",
  outline: "border border-line text-ink-soft",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
