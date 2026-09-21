import * as React from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon,
  progress,
  className,
  title,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  /** 0–100; renders a thin bar under the value. */
  progress?: number;
  className?: string;
  title?: string;
}) {
  return (
    <div
      className={cn("flex flex-col gap-3 rounded-card border border-border-subtle bg-surface-raised p-5", className)}
      title={title}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-muted">{label}</p>
        {icon ? (
          <span className="grid size-9 place-items-center rounded-full bg-brand-subtle text-text [&_svg]:size-4">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="text-[2rem] font-semibold leading-none tracking-[-0.03em] text-text">{value}</p>
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
      {progress != null ? (
        <div className="h-1.5 rounded-pill bg-brand-subtle" aria-hidden data-rtl-chart>
          <div
            className="h-1.5 rounded-pill bg-accent"
            style={{ width: `${Math.max(0, Math.min(100, Math.round(progress)))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
