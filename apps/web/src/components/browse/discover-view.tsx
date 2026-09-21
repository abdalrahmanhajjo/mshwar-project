"use client";

import { ArrowUpRight } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { CatalogImage } from "@/components/browse/catalog-image";
import { DestinationCard } from "@/components/browse/destination-card";
import { ExperienceCard } from "@/components/browse/experience-card";
import { SoftPlanCta } from "@/components/browse/plan-cta";
import { ArrowLink } from "@/components/ui/arrow-link";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { useBrowseCopy } from "@/lib/browse-copy";
import { DESTINATIONS, EXPERIENCES, IDEAS, listingKind } from "@/lib/catalog";
import { splitTail } from "@/lib/text";
import { cn, focusRing } from "@/lib/utils";

export function DiscoverView() {
  const copy = useBrowseCopy();
  const experiences = EXPERIENCES.filter((item) => listingKind(item) === "experience").slice(0, 3);
  const attractions = EXPERIENCES.filter((item) => listingKind(item) === "attraction");
  const restaurants = EXPERIENCES.filter((item) => listingKind(item) === "restaurant");
  const [lead, tail] = splitTail(copy.discoverTitle);

  return (
    <div className="shell-frame grid gap-20 pb-20 pt-12 md:gap-24 md:pt-16">
      <PageHeader eyebrow={copy.browseEyebrow} title={lead} accent={tail} description={copy.discoverBody} />

      <section className="grid gap-8">
        <SectionHeader
          title={copy.destinations}
          action={<ArrowLink href="/destinations">{copy.exploreAll}</ArrowLink>}
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DESTINATIONS.slice(0, 3).map((destination) => (
            <DestinationCard key={destination.slug} destination={destination} />
          ))}
        </div>
      </section>

      <section className="grid gap-8">
        <SectionHeader
          title={copy.kindExperiences}
          action={<ArrowLink href="/experiences?kind=experience">{copy.exploreAll}</ArrowLink>}
        />
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {experiences.map((experience) => (
            <ExperienceCard key={experience.slug} experience={experience} />
          ))}
        </div>
      </section>

      <div className="grid gap-16 lg:grid-cols-2 lg:gap-10">
        <section className="grid content-start gap-8">
          <SectionHeader
            title={copy.kindAttractions}
            action={<ArrowLink href="/experiences?kind=attraction">{copy.exploreAll}</ArrowLink>}
          />
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2">
            {attractions.map((experience) => (
              <ExperienceCard key={experience.slug} experience={experience} compact />
            ))}
          </div>
        </section>

        <section className="grid content-start gap-8">
          <SectionHeader
            title={copy.kindRestaurants}
            action={<ArrowLink href="/experiences?kind=restaurant">{copy.exploreAll}</ArrowLink>}
          />
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2">
            {restaurants.map((experience) => (
              <ExperienceCard key={experience.slug} experience={experience} compact />
            ))}
          </div>
        </section>
      </div>

      <section className="grid gap-10 overflow-hidden rounded-[1.75rem] bg-surface-sunken p-8 md:p-12 lg:grid-cols-[1fr_1.4fr] lg:items-center">
        <div className="grid gap-5">
          <p className="eyebrow">{copy.ideasEyebrow}</p>
          <h2 className="title-section text-balance">{copy.ideasTitle}</h2>
          <p className="text-text-muted">{copy.ideasBody}</p>
          <Button asChild className="w-fit">
            <LocaleLink href="/ideas">
              {copy.exploreDay}
              <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
            </LocaleLink>
          </Button>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {IDEAS.map((idea) => (
            <li key={idea.slug}>
              <LocaleLink
                href={`/experiences/${idea.experienceSlugs[0]}`}
                className={cn(
                  "group grid gap-3 rounded-card bg-surface-raised p-3 shadow-sm transition-shadow hover:shadow-md",
                  focusRing,
                )}
              >
                <div className="aspect-[4/3] overflow-hidden rounded-[0.9rem]">
                  <CatalogImage
                    src={idea.image}
                    alt={idea.imageAlt}
                    className="transition-transform duration-slow group-hover:scale-105"
                  />
                </div>
                <span className="px-1 pb-1 font-semibold tracking-tight">{idea.title}</span>
              </LocaleLink>
            </li>
          ))}
        </ul>
      </section>

      <SoftPlanCta />
    </div>
  );
}
