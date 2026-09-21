import * as React from "react";
import { cn } from "@/lib/utils";

export function Progress({
  value = 0,
  label = "Progress",
  className,
}: {
  value?: number;
  label?: string;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("grid gap-1.5", className)}>
      <span className="text-label text-text-muted">{label}</span>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        aria-label={label}
        className="relative h-1.5 w-full overflow-hidden rounded-pill bg-brand-subtle"
      >
        <div
          className="absolute inset-y-0 start-0 h-full rounded-pill bg-brand transition-[width] duration-normal"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
