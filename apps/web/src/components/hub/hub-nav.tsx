"use client";

import * as React from "react";
import { Heart, LifeBuoy, Route, Settings } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { PageHeader } from "@/components/ui/page-header";
import { useBrowseCopy } from "@/lib/browse-copy";
import { cn, controlSize, focusRing } from "@/lib/utils";

const HUB_LINKS = [
  { href: "/trips", key: "myTrips" as const, icon: Route },
  { href: "/favorites", key: "favorites" as const, icon: Heart },
  { href: "/settings", key: "settings" as const, icon: Settings },
];

export function HubNav({ current }: { current: string }) {
  const { t } = useLocale();
  const browse = useBrowseCopy();
  return (
    <nav aria-label={t("yourMshwar")} className="grid gap-6">
      <p className="eyebrow hidden lg:block">{t("yourMshwar")}</p>
      <ul className="scrollbar-hide -mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:grid lg:overflow-visible lg:px-0">
        {HUB_LINKS.map((item) => {
          const active = current === item.href;
          return (
            <li key={item.href} className="shrink-0">
              <LocaleLink
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 whitespace-nowrap rounded-control px-3.5 text-[0.9375rem] transition-colors",
                  controlSize,
                  focusRing,
                  active
                    ? "bg-brand-subtle font-semibold text-text"
                    : "border border-border-subtle font-medium text-text-muted hover:bg-surface-sunken hover:text-text lg:border-transparent",
                )}
              >
                <item.icon className="size-[1.05rem] shrink-0" strokeWidth={1.75} aria-hidden />
                {t(item.key)}
              </LocaleLink>
            </li>
          );
        })}
        <li className="shrink-0">
          <LocaleLink
            href="/contact"
            className={cn(
              "flex items-center gap-3 whitespace-nowrap rounded-control border border-border-subtle px-3.5 text-[0.9375rem] font-medium text-text-muted transition-colors hover:bg-surface-sunken hover:text-text lg:border-transparent",
              controlSize,
              focusRing,
            )}
          >
            <LifeBuoy className="size-[1.05rem] shrink-0" strokeWidth={1.75} aria-hidden />
            {browse.helpCenter}
          </LocaleLink>
        </li>
      </ul>
      <p className="text-serif hidden max-w-[11rem] text-[1.6rem] leading-snug text-text-muted lg:block">
        {t("hubTagline")}
      </p>
    </nav>
  );
}

/** Account hub frame: sidebar navigation + page header + content, matching the My trips design. */
export function HubFrame({
  current,
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  current: string;
  eyebrow?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[14rem_1fr] lg:gap-16">
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <HubNav current={current} />
      </aside>
      <div className="grid min-w-0 content-start gap-8">
        <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />
        {children}
      </div>
    </div>
  );
}
