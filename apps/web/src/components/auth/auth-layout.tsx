"use client";

import * as React from "react";
import { CalendarCheck, Heart, Route } from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { LogoSymbol } from "@/components/shell/brand-mark";
import { useLocale } from "@/components/shell/locale-provider";
import { useBrowseCopy } from "@/lib/browse-copy";
import { DESTINATIONS } from "@/lib/catalog";
import { splitTail } from "@/lib/text";

/**
 * Shared frame for sign-in, sign-up, recovery and verification. The photo
 * panel is decorative; every control lives in the form column.
 */
export function AuthLayout({
  title,
  description,
  children,
  footer,
  imageIndex = 2,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  imageIndex?: number;
}) {
  const { t } = useLocale();
  const copy = useBrowseCopy();
  const destination = DESTINATIONS[imageIndex % DESTINATIONS.length];
  const [lead, tail] = splitTail(t("authAsideKicker"), 2);
  const perks = [
    { icon: Heart, label: copy.saveExperience },
    { icon: Route, label: copy.planMyTrip },
    { icon: CalendarCheck, label: t("bookings") },
  ];

  return (
    <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[1.75rem] border border-border-subtle bg-surface-raised shadow-lg lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col justify-center gap-8 p-7 sm:p-10 md:p-12">
        <div className="grid gap-3">
          <LogoSymbol className="h-7" />
          <h1 className="title-page mt-3 text-[2.4rem] md:text-[2.8rem]">{title}</h1>
          {description ? (
            <div className="text-pretty text-sm leading-relaxed text-text-muted">{description}</div>
          ) : null}
        </div>
        {children}
        {footer ? <div className="border-t border-border-subtle pt-5 text-sm text-text-muted">{footer}</div> : null}
      </div>
      <div className="relative isolate hidden min-h-[40rem] overflow-hidden bg-brand lg:block">
        <CatalogImage src={destination.image} alt="" className="absolute inset-0" sizes="50vw" />
        <div className="photo-scrim absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 grid gap-6 p-10 text-white">
          <p className="title-section max-w-md">
            {lead} <span className="text-serif text-accent">{tail}</span>
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-white/85">{t("authAside")}</p>
          <ul className="flex flex-wrap gap-2">
            {perks.map((perk) => (
              <li
                key={perk.label}
                className="inline-flex items-center gap-2 rounded-pill bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur"
              >
                <perk.icon className="size-3.5" aria-hidden />
                {perk.label}
              </li>
            ))}
          </ul>
          <p className="text-xs text-white/70">
            {destination.name} · {destination.region}
          </p>
        </div>
      </div>
    </div>
  );
}
