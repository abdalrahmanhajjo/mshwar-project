"use client";

import { ArrowUpRight, MapPin } from "lucide-react";
import { ArrowLink } from "@/components/ui/arrow-link";
import { LocaleLink } from "@/components/shell/locale-link";
import { CategoryPills } from "@/components/browse/category-pills";
import { CatalogImage } from "@/components/browse/catalog-image";
import { DestinationCard } from "@/components/browse/destination-card";
import { ExperienceCard } from "@/components/browse/experience-card";
import { HeroSearch } from "@/components/browse/hero-search";
import { PlanSplitCta } from "@/components/browse/plan-cta";
import { SectionHeader } from "@/components/ui/page-header";
import { useBrowseCopy } from "@/lib/browse-copy";
import { CATEGORIES, DESTINATIONS, EXPERIENCES, HOME_HERO_IMAGE } from "@/lib/catalog";
import type { Destination, Experience } from "@/lib/catalog";
import { splitTail } from "@/lib/text";
import { cn, focusRing } from "@/lib/utils";

export function HomeView({
  experiences = EXPERIENCES,
  destinations = DESTINATIONS,
  heroImage = HOME_HERO_IMAGE,
}: {
  experiences?: Experience[];
  destinations?: Destination[];
  heroImage?: string;
} = {}) {
  const copy = useBrowseCopy();
  const featured = experiences.slice(0, 3);
  const stripSource = [destinations[1], destinations[3], destinations[4]].filter(Boolean) as Destination[];
  const strip = stripSource.length >= 3 ? stripSource : destinations.slice(0, 3);
  const stripKickers = strip.map((destination) => {
    const match = experiences.find((item) => item.destinationSlug === destination.slug);
    return CATEGORIES.find((item) => item.slug === match?.category)?.label ?? destination.region;
  });
  const [heroLead, heroTail] = splitTail(copy.heroTitle);

  return (
    <div className="pb-4">
      <section className="px-2 pt-2 sm:px-3 sm:pt-3">
        <div className="relative isolate min-h-[36rem] overflow-hidden rounded-[1.5rem] bg-brand md:min-h-[38rem]">
          <CatalogImage src={heroImage} alt="" className="absolute inset-0 h-full w-full scale-[1.02]" priority />
          <div className="photo-scrim-side absolute inset-0" />
          <div className="photo-tint absolute inset-0" />
          <div className="shell-frame relative flex min-h-[36rem] flex-col justify-center gap-7 pb-32 pt-16 text-white md:min-h-[38rem] md:pb-28">
            <p className="inline-flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-white/85">
              <span className="size-1.5 rounded-full bg-accent" aria-hidden />
              {copy.heroKicker}
            </p>
            <h1 className="title-hero max-w-3xl text-balance animate-rise">
              {heroLead} <span className="text-serif text-accent">{heroTail}</span>
            </h1>
            <p className="max-w-md text-base leading-relaxed text-white/85 md:text-lg">{copy.heroBody}</p>
            <LocaleLink
              href="/plan"
              className={cn(
                "group inline-flex w-fit items-center gap-3 border-b border-white/50 pb-2 text-sm font-medium text-white transition-colors hover:border-white",
                focusRing,
              )}
            >
              {copy.heroCta}
              <ArrowUpRight
                className="size-4 transition-transform group-hover:-translate-y-0.5 rtl:-scale-x-100"
                aria-hidden
              />
            </LocaleLink>
          </div>
          <p className="absolute bottom-24 end-6 hidden items-center gap-1.5 text-xs text-white/80 md:flex">
            <MapPin className="size-3.5" aria-hidden />
            {copy.heroCaption}
            <span className="ms-2 text-[0.6875rem] tabular-nums tracking-wide text-white/60" dir="ltr">
              34.1230° N, 35.6519° E
            </span>
          </p>
        </div>
        <div className="shell-frame relative z-10 -mt-20 md:-mt-12">
          <div className="mx-auto max-w-5xl">
            <HeroSearch />
          </div>
        </div>
      </section>

      <div className="shell-frame grid gap-20 pt-14 md:gap-24 md:pt-16">
        <div className="flex flex-col gap-2 border-b border-border-subtle pb-8 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-serif text-2xl text-text md:text-[1.75rem]">{copy.lessSearching}</p>
          <p className="text-sm text-text-muted">{copy.lessSearchingNote}</p>
        </div>

        <section className="-mt-6 grid gap-8 md:-mt-12">
          <SectionHeader eyebrow={copy.perfectDayKicker} title={copy.perfectDay} />
          <CategoryPills variant="icons" />
        </section>

        <section className="grid gap-8">
          <SectionHeader
            eyebrow={copy.goodDaysKicker}
            title={copy.goodDays}
            action={<ArrowLink href="/experiences">{copy.exploreAll}</ArrowLink>}
          />
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((experience) => (
              <ExperienceCard key={experience.slug} experience={experience} />
            ))}
          </div>
          <p className="text-xs text-text-muted">{copy.illustrativePrices}</p>
        </section>

        <PlanSplitCta />

        <section className="grid gap-8">
          <SectionHeader
            eyebrow={copy.closeToHomeKicker}
            title={copy.closeToHome}
            action={<ArrowLink href="/destinations">{copy.findPlaceCta}</ArrowLink>}
          />
          <div className="grid gap-5 md:grid-cols-[1.15fr_1fr_1fr]">
            {strip.map((destination, index) => (
              <DestinationCard
                key={destination.slug}
                destination={destination}
                kicker={stripKickers[index]}
                subtitle={destination.blurb}
                className="md:[&_article]:min-h-[24rem]"
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
