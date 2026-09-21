import * as React from "react";
import { cn, focusRing } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "accent" | "danger" | "success" | "warning" | "outline";
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant = "default", ...props }, ref) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 whitespace-nowrap rounded-pill border px-2.5 py-0.5 text-xs font-medium leading-5",
      focusRing,
      {
        "border-transparent bg-brand text-brand-foreground": variant === "default",
        "border-transparent bg-brand-subtle text-text": variant === "secondary",
        "border-transparent bg-accent-subtle text-accent-strong": variant === "accent",
        "border-transparent bg-danger-subtle text-danger": variant === "danger",
        "border-transparent bg-success-subtle text-success": variant === "success",
        "border-transparent bg-warning-subtle text-warning": variant === "warning",
        "border-border-subtle bg-surface-raised text-text-muted": variant === "outline",
      },
      className,
    )}
    ref={ref}
    {...props}
  />
));
Badge.displayName = "Badge";

export { Badge };
