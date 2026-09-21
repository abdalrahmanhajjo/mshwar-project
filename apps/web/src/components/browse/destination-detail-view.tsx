"use client";

import { ArrowLeft, ArrowUpRight, Clock, Info, MapPin, Route } from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { ExperienceCard } from "@/components/browse/experience-card";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import { Eyebrow, SectionHeader } from "@/components/ui/page-header";
import { useBrowseCopy } from "@/lib/browse-copy";
import type { Destination, Experience } from "@/lib/catalog";
import { cn, focusRing } from "@/lib/utils";

export function DestinationDetailView({
  destination,
  experiences,
}: {
  destination: Destination;
  experiences: Experience[];
}) {
  const copy = useBrowseCopy();
  const featured = experiences[0];
  const remainder = experiences.length % 3;
  const ctaSpan = remainder === 0 ? 3 : 3 - remainder;
  const ctaWide = ctaSpan > 1;
  const mapsQuery = encodeURIComponent(`${destination.name}, ${destination.region}, Lebanon`);

  return (
    <div>
      <section className="relative isolate min-h-[30rem] overflow-hidden bg-brand md:min-h-[38rem]">
        <CatalogImage src={destination.image} alt={destination.imageAlt} className="absolute inset-0" priority />
        <div className="photo-scrim-side absolute inset-0" />
        <div className="photo-scrim absolute inset-0 opacity-60" />
        <div className="shell-frame relative flex min-h-[30rem] flex-col justify-end gap-5 pb-14 pt-24 text-white md:min-h-[38rem] md:pb-20">
          <LocaleLink
            href="/destinations"
            className={cn(
              "mb-4 inline-flex w-fit items-center gap-2 rounded-sm text-sm text-white/90 hover:text-white",
              focusRing,
            )}
          >
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
            {copy.backDestinations}
          </LocaleLink>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/85">
            {destination.region} · {destination.country}
          </p>
          <h1 className="title-hero max-w-3xl">
            {destination.name},<span className="text-serif block">{copy.atYourOwnPace}</span>
          </h1>
        </div>
      </section>

      <div className="shell-frame grid gap-12 py-16 md:py-20 lg:grid-cols-[1.35fr_1fr] lg:items-start lg:gap-20">
        <div className="grid gap-5">
          <Eyebrow>{copy.destinationIntroKicker}</Eyebrow>
          <h2 className="title-page max-w-xl text-balance">{copy.destinationIntroTitle}</h2>
          <p className="max-w-xl text-lg leading-relaxed text-text-muted">{destination.blurb}</p>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label={copy.tagsLabel}>
            {destination.tags.map((tag) => (
              <li key={tag} className="rounded-pill bg-brand-subtle px-3.5 py-1.5 text-sm font-medium text-text">
                {tag}
              </li>
            ))}
          </ul>
        </div>
        <aside className="grid gap-5 rounded-card border border-border-subtle bg-surface-raised p-6 shadow-sm md:p-8">
          <h2 className="title-card text-[1.4rem]">{copy.planVisit}</h2>
          <ul className="grid gap-4 text-[0.9375rem]">
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-5 shrink-0 text-text-muted" strokeWidth={1.6} aria-hidden />
              {destination.name}, {destination.region}
            </li>
            {featured ? (
              <li className="flex items-start gap-3">
                <Clock className="mt-0.5 size-5 shrink-0 text-text-muted" strokeWidth={1.6} aria-hidden />
                {copy.sampleExperience} · {featured.hours} {copy.hoursLabel}
              </li>
            ) : null}
            <li className="flex items-start gap-3 text-text-muted">
              <Info className="mt-0.5 size-5 shrink-0" strokeWidth={1.6} aria-hidden />
              {copy.hoursAccess}
            </li>
          </ul>
          <Button asChild variant="outline" size="lg" className="w-full">
            <a href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noreferrer">
              {copy.openMaps}
              <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
            </a>
          </Button>
        </aside>
      </div>

      {featured ? (
        <div className="shell-frame grid gap-8 pb-20">
          <SectionHeader eyebrow={copy.makeADayKicker} title={`${copy.makeADay} ${destination.name}.`} />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {experiences.map((experience) => (
              <ExperienceCard key={experience.slug} experience={experience} />
            ))}
            <div
              className={cn(
                "flex flex-col justify-between gap-8 rounded-card bg-surface-sunken p-8 md:p-10",
                ctaSpan === 2 && "lg:col-span-2",
                ctaSpan === 3 && "sm:col-span-2 lg:col-span-3",
                ctaWide && "lg:flex-row lg:items-center",
              )}
            >
              <span className="grid size-12 place-items-center rounded-full bg-surface-raised text-text shadow-sm">
                <Route className="size-5" strokeWidth={1.6} aria-hidden />
              </span>
              <div className={cn("grid gap-3", ctaWide && "lg:flex-1")}>
                <h3 className="title-section text-[1.9rem]">{copy.oneStop}</h3>
                <p className="text-text-muted">{copy.oneStopBody}</p>
              </div>
              <Button asChild className="w-fit">
                <LocaleLink href={`/plan?add=${featured.slug}`}>
                  {copy.startPlan}
                  <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
                </LocaleLink>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
