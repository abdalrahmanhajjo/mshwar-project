"use client";

import { LocaleLink } from "@/components/shell/locale-link";
import { cn, controlSize, focusRing } from "@/lib/utils";
import { isNavActive, type ShellNavItem } from "@/components/shell/nav-config";
import { useLocale } from "@/components/shell/locale-provider";

export function NavLink({
  item,
  pathname,
  variant = "inline",
  onNavigate,
}: {
  item: ShellNavItem;
  pathname: string;
  variant?: "inline" | "stack";
  onNavigate?: () => void;
}) {
  const { t } = useLocale();
  const active = isNavActive(pathname, item);
  const Icon = item.icon;

  if (variant === "inline") {
    return (
      <LocaleLink
        href={item.href}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        className={cn(
          "relative inline-flex items-center rounded-control px-3 text-[0.9375rem] font-medium text-text transition-colors",
          "after:absolute after:bottom-0.5 after:start-1/2 after:size-1.5 after:-translate-x-1/2 after:rounded-full after:bg-accent after:opacity-0 after:transition-opacity",
          "rtl:after:translate-x-1/2 hover:text-text/70",
          active && "after:opacity-100",
          controlSize,
          focusRing,
        )}
      >
        {t(item.labelKey)}
      </LocaleLink>
    );
  }

  return (
    <LocaleLink
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "group inline-flex w-full items-center justify-start gap-3 rounded-control px-3 text-[0.9375rem] transition-colors",
        controlSize,
        focusRing,
        active
          ? "bg-brand-subtle font-semibold text-text"
          : "font-medium text-text-muted hover:bg-surface-sunken hover:text-text",
      )}
    >
      <Icon
        className={cn("size-[1.05rem] shrink-0", active ? "text-text" : "text-text-muted group-hover:text-text")}
        strokeWidth={1.75}
        aria-hidden
      />
      {t(item.labelKey)}
    </LocaleLink>
  );
}
