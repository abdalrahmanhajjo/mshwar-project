import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, controlSize, focusRing } from "@/lib/utils";

const buttonVariants = cva(
  cn(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-pill text-sm font-medium",
    "transition-[background-color,color,border-color,box-shadow,transform] duration-quick ease-standard",
    "active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    focusRing,
    controlSize,
  ),
  {
    variants: {
      variant: {
        default: "bg-brand text-brand-foreground shadow-sm hover:bg-brand/90",
        accent: "bg-accent text-accent-foreground shadow-sm hover:bg-accent/90",
        destructive: "bg-danger text-danger-foreground hover:bg-danger/90",
        outline: "border border-brand/70 bg-transparent text-text hover:border-brand hover:bg-brand-subtle",
        secondary: "bg-brand-subtle text-text hover:bg-brand-subtle/70",
        ghost: "text-text hover:bg-surface-sunken",
        link: "min-h-0 rounded-none px-0 text-text underline decoration-border-subtle underline-offset-[6px] hover:decoration-text",
      },
      size: {
        default: "px-5 py-2",
        sm: "px-4 text-[0.8125rem]",
        lg: "px-7 text-base",
        icon: "size-[var(--layout-min-target)] p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = "button", ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={asChild ? undefined : type}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
