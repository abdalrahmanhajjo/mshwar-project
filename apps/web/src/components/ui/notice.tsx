import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  info: { icon: Info, className: "border-border-subtle bg-surface-sunken text-text-muted" },
  success: { icon: CheckCircle2, className: "border-transparent bg-success-subtle text-success" },
  warning: { icon: AlertTriangle, className: "border-transparent bg-warning-subtle text-warning" },
  danger: { icon: XCircle, className: "border-transparent bg-danger-subtle text-danger" },
} as const;

export interface NoticeProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: keyof typeof TONES;
  icon?: React.ReactNode | false;
}

/** Inline banner for preview disclaimers, validation summaries and status. */
export function Notice({ tone = "info", icon, className, children, ...props }: NoticeProps) {
  const Tone = TONES[tone];
  const Icon = Tone.icon;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-control border px-4 py-3 text-sm leading-relaxed",
        Tone.className,
        className,
      )}
      {...props}
    >
      {icon === false ? null : <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon ?? <Icon aria-hidden />}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
