import * as React from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { cn, focusRing } from "@/lib/utils";

export function ArrowLink({
  href,
  children,
  external = false,
  className,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
  className?: string;
}) {
  const Icon = external ? ArrowUpRight : ArrowRight;
  return (
    <LocaleLink
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 rounded-sm text-sm font-semibold text-text hover:text-text/75",
        focusRing,
        className,
      )}
    >
      {children}
      <Icon
        className="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
        aria-hidden
      />
    </LocaleLink>
  );
}
