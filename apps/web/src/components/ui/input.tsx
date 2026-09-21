import * as React from "react";
import { cn, controlSize, focusRing } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/** Shared field chrome so inputs, selects and textareas line up everywhere. */
export const fieldChrome = cn(
  "w-full rounded-control border border-border bg-surface-raised px-3.5 text-sm text-text shadow-[inset_0_1px_0_rgba(18,53,47,0.02)]",
  "transition-[border-color,box-shadow] duration-quick placeholder:text-text-muted/80",
  "hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-50",
  "aria-[invalid=true]:border-danger",
);

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = "text", ...props }, ref) => {
  return (
    <input
      className={cn(
        "flex py-2.5",
        fieldChrome,
        type === "file" &&
          "py-2 file:me-3 file:rounded-pill file:border-0 file:bg-brand-subtle file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text",
        focusRing,
        controlSize,
        className,
      )}
      ref={ref}
      type={type}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
