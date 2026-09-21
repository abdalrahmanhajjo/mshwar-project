import * as React from "react";
import { ChevronDown } from "lucide-react";
import { fieldChrome } from "@/components/ui/input";
import { cn, controlSize, focusRing } from "@/lib/utils";

export type NativeSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  wrapperClassName?: string;
};

/** Styled native `<select>` — keeps platform pickers and form semantics. */
const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, wrapperClassName, children, ...props }, ref) => (
    <div className={cn("relative w-full", wrapperClassName)}>
      <select
        ref={ref}
        className={cn("w-full appearance-none py-2.5 pe-10", fieldChrome, focusRing, controlSize, className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
        aria-hidden
      />
    </div>
  ),
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
