"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  CalendarPlus,
  Check,
  Clock,
  MapPin,
  Navigation,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { ExperienceCard } from "@/components/browse/experience-card";
import { SaveExperienceButton } from "@/components/browse/save-button";
import { Button } from "@/components/ui/button";
import { LocaleLink } from "@/components/shell/locale-link";
import { Eyebrow, SectionHeader } from "@/components/ui/page-header";
import { useBrowseCopy } from "@/lib/browse-copy";
import {
  bookingModeLabel,
  listingAvailabilityNote,
  listingAvailable,
  listingDistance,
  listingGallery,
  listingKind,
  listingPolicies,
  listingRating,
  priceKindLabel,
  type Experience,
} from "@/lib/catalog";
import { CATEGORIES } from "@/lib/catalog";
import { Rating } from "@/components/ui/rating";
import { splitSentence } from "@/lib/text";
import { cn, focusRing } from "@/lib/utils";

const FACT_ICONS = [Clock, Users, MapPin, ShieldCheck];

export function ExperienceDetailView({ experience, related }: { experience: Experience; related: Experience[] }) {
  const copy = useBrowseCopy();
  const category = CATEGORIES.find((item) => item.slug === experience.category)?.label ?? experience.category;
  const mapsQuery = encodeURIComponent(experience.placeLabel);
  const gallery = listingGallery(experience);
  const policies = listingPolicies(experience);
  const available = listingAvailable(experience);
  const rating = listingRating(experience);
  const kind = listingKind(experience);
  const [region] = experience.placeLabel.split(" · ").slice(-1);
  const [summaryLead, summaryTail] = splitSentence(experience.summary ?? experience.title);

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": kind === "restaurant" ? "Restaurant" : "TouristAttraction",
            name: experience.title,
            description: experience.body,
            image: gallery,
            url: `/experiences/${experience.slug}`,
            address: {
              "@type": "PostalAddress",
              addressLocality: experience.placeLabel,
              addressCountry: "LB",
            },
            offers: {
              "@type": "Offer",
              priceCurrency: "USD",
              price: experience.priceFrom,
              availability: available ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
              description: `${priceKindLabel(experience.priceLabel)}. ${bookingModeLabel(experience.bookingMode)}.`,
            },
          }),
        }}
      />
      <div className="shell-frame grid gap-5 pb-8 pt-8 md:pt-10">
        <LocaleLink
          href="/experiences"
          className={cn(
            "inline-flex w-fit items-center gap-2 rounded-sm text-sm text-text-muted hover:text-text",
            focusRing,
          )}
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {copy.backExperiences}
        </LocaleLink>
        <Eyebrow>
          {category} · {region}
        </Eyebrow>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="title-page max-w-3xl text-balance">{experience.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <LocaleLink href={`/plan?add=${experience.slug}&destination=${experience.destinationSlug}`}>
                <CalendarPlus aria-hidden />
                {copy.planDayHere}
              </LocaleLink>
            </Button>
            <SaveExperienceButton slug={experience.slug} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4" strokeWidth={1.75} aria-hidden />
            {experience.placeLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4" strokeWidth={1.75} aria-hidden />
            {experience.hours} {copy.hoursLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Navigation className="size-4" strokeWidth={1.75} aria-hidden />
            {listingDistance(experience)} km {copy.fromBeirut}
          </span>
          {rating ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-text">
              <Star className="size-4 fill-accent text-accent" aria-hidden />
              {rating.toFixed(1)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="shell-frame pb-4">
        <div className="grid overflow-hidden rounded-[1.5rem] bg-brand text-brand-foreground lg:grid-cols-[1.6fr_1fr]">
          <div className="relative aspect-[16/10] lg:aspect-auto lg:min-h-[26rem]">
            <CatalogImage
              src={gallery[0] ?? experience.image}
              alt={experience.imageAlt}
              className="absolute inset-0"
              priority
              sizes="(min-width: 1024px) 62vw, 100vw"
            />
          </div>
          <div className="flex flex-col justify-center gap-4 p-8 md:p-12">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-brand-foreground/65">
              {copy.makeADayKicker}
            </p>
            <p className="title-section text-balance">
              {summaryLead}
              {summaryTail ? <span className="block">{summaryTail}</span> : null}
            </p>
            <p className="text-sm text-brand-foreground/70">{experience.tags.join(" · ")}</p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "mt-2 inline-flex w-fit items-center gap-2 border-b border-brand-foreground/40 pb-1 text-sm font-medium hover:border-brand-foreground",
                focusRing,
              )}
            >
              {copy.seeArea}
              <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
            </a>
          </div>
        </div>
        {gallery.length > 1 ? (
          <ul aria-label={copy.galleryLabel} className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {gallery.slice(1, 5).map((src, index) => (
              <li key={`${src}-${index}`} className="overflow-hidden rounded-card">
                <div className="aspect-[4/3]">
                  <CatalogImage src={src} alt={experience.imageAlt} />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="shell-frame grid gap-12 py-12 md:py-16">
        <div className="grid gap-12">
          <section className="grid gap-4">
            <Eyebrow>{copy.theExperience}</Eyebrow>
            <h2 className="title-section">{copy.goodDayTitle}</h2>
            <p className="text-lg leading-relaxed text-text-muted">{experience.body}</p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {experience.tags.map((tag) => (
                <li
                  key={tag}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-brand-subtle px-3 py-1.5 text-sm font-medium"
                >
                  <Check className="size-3.5" aria-hidden />
                  {tag}
                </li>
              ))}
            </ul>
          </section>

          <section className="grid gap-6 border-t border-border-subtle pt-10" aria-labelledby="expect-heading">
            <h2 id="expect-heading" className="title-card text-[1.5rem]">
              {copy.whatToExpect}
            </h2>
            <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
              {experience.facts.map((fact, index) => {
                const Icon = FACT_ICONS[index % FACT_ICONS.length];
                return (
                  <li key={fact.title} className="grid gap-2">
                    <Icon className="size-5 text-text" strokeWidth={1.6} aria-hidden />
                    <h3 className="font-semibold">{fact.title}</h3>
                    <p className="text-sm leading-relaxed text-text-muted">{fact.body}</p>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="grid gap-3 rounded-card border border-border-subtle bg-surface-sunken/60 p-6">
            <h2 className="font-semibold">{copy.availabilityStatus}</h2>
            <p className="text-sm font-medium">{`${bookingModeLabel(experience.bookingMode)} · ${copy.preview}`}</p>
            <p className="text-sm text-text-muted">
              {available ? listingAvailabilityNote(experience) : copy.availabilityUnknown}
            </p>
            <p className="text-sm text-text-muted">{priceKindLabel(experience.priceLabel)}</p>
          </section>

          <section
            aria-labelledby="listing-policies-heading"
            className="grid gap-5 border-t border-border-subtle pt-10"
          >
            <h2 id="listing-policies-heading" className="title-card text-[1.5rem]">
              {copy.policies}
            </h2>
            <ul className="grid gap-4">
              {policies.map((policy) => (
                <li key={policy.title} className="grid gap-1 border-b border-border-subtle pb-4 last:border-b-0">
                  <p className="text-sm font-semibold">{policy.title}</p>
                  <p className="text-sm leading-relaxed text-text-muted">{policy.body}</p>
                </li>
              ))}
            </ul>
          </section>

          {rating ? (
            <div className="border-t border-border-subtle pt-10">
              <Rating value={Math.round(rating)} readOnly label={`${copy.ratingLabel} · ${rating.toFixed(1)}`} />
            </div>
          ) : null}

          <section className="grid gap-3 border-t border-border-subtle pt-10">
            <h2 className="title-card text-[1.5rem]">{copy.fewThingsToKnow}</h2>
            <p className="text-sm leading-relaxed text-text-muted">{copy.sampleOffer}</p>
          </section>
        </div>
      </div>

      {related.length ? (
        <div className="shell-frame grid gap-8 pb-20">
          <SectionHeader title={copy.keepExploring} />
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <div key={item.slug} className="grid content-start gap-2">
                <ExperienceCard experience={item} />
                {item.distanceKm != null ? (
                  <p className="text-xs text-text-muted">
                    {item.distanceKm} km
                    {item.travelSeconds
                      ? ` · ${Math.max(1, Math.round(item.travelSeconds / 60))} ${copy.minutesLabel}`
                      : ""}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
