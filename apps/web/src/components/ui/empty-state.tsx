import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border-subtle bg-surface-sunken/70 px-6 py-14 text-center md:py-20",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div className="mb-2 grid size-14 place-items-center rounded-full bg-surface-raised text-text shadow-sm [&_svg]:size-6">
          {icon}
        </div>
      ) : null}
      <h2 className="title-section max-w-lg text-balance text-text">{title}</h2>
      {description ? <p className="max-w-md text-pretty text-text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
