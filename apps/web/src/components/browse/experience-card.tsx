"use client";

import { LocaleLink } from "@/components/shell/locale-link";
import { ArrowUpRight, Clock, MapPin } from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { SaveExperienceButton } from "@/components/browse/save-button";
import { BidiText } from "@/components/ui/bidi-text";
import { useBrowseCopy } from "@/lib/browse-copy";
import { useLocale } from "@/components/shell/locale-provider";
import { formatCurrency } from "@/i18n/format";
import type { Experience } from "@/lib/catalog";
import { CATEGORIES } from "@/lib/catalog";
import { cn, focusRing } from "@/lib/utils";

export function ExperienceCard({ experience, compact = false }: { experience: Experience; compact?: boolean }) {
  const copy = useBrowseCopy();
  const { locale } = useLocale();
  const category = CATEGORIES.find((item) => item.slug === experience.category)?.label ?? experience.category;
  const [place, region] = experience.placeLabel.split(" · ");

  return (
    <article className="group relative flex h-full flex-col">
      <span className="absolute end-3 top-3 z-10">
        <SaveExperienceButton slug={experience.slug} compact />
      </span>
      <LocaleLink
        href={`/experiences/${experience.slug}`}
        className={cn("flex h-full flex-col rounded-card", focusRing)}
      >
        <div className="relative overflow-hidden rounded-card bg-brand-subtle">
          <div className={compact ? "aspect-[5/4]" : "aspect-[4/3]"}>
            <CatalogImage
              src={experience.image}
              alt={experience.imageAlt}
              className="transition-transform duration-slow ease-standard group-hover:scale-[1.04]"
            />
          </div>
          <span className="absolute start-3 top-3 rounded-pill bg-surface/95 px-2.5 py-1 text-xs font-semibold text-text shadow-sm backdrop-blur">
            {category}
          </span>
        </div>
        <div className="flex flex-1 flex-col pt-4">
          <p className="flex items-center gap-1.5 text-xs text-text-muted">
            <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            <BidiText>{place ?? experience.placeLabel}</BidiText>
            {region ? (
              <>
                <span aria-hidden>·</span>
                <BidiText>{region}</BidiText>
              </>
            ) : null}
          </p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h3 className="title-card text-[1.1875rem] text-text">
              <BidiText>{experience.title}</BidiText>
            </h3>
            <ArrowUpRight
              className="mt-1 size-4 shrink-0 text-text transition-transform duration-normal group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100"
              aria-hidden
            />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border-subtle pt-3.5 text-sm text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" strokeWidth={1.75} aria-hidden />
              {experience.hours} {copy.hoursLabel}
            </span>
            {experience.priceLabel === "quote" ? (
              <span className="text-xs font-semibold text-text">{copy.onRequest}</span>
            ) : !experience.priceFrom ? (
              <span className="text-xs font-semibold text-text">{copy.free}</span>
            ) : (
              <span className="text-xs">
                {copy.fromPrice}{" "}
                <span className="text-lg font-semibold tracking-tight text-text">
                  {formatCurrency(locale, experience.priceFrom, "USD", { maximumFractionDigits: 0 })}
                </span>{" "}
                / {copy.perPerson}
                <span aria-hidden>*</span>
              </span>
            )}
          </div>
        </div>
      </LocaleLink>
    </article>
  );
}
