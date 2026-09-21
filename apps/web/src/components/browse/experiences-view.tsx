"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LayoutGrid, Map as MapIcon, SlidersHorizontal, X } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { CategoryPills } from "@/components/browse/category-pills";
import { ExperienceCard } from "@/components/browse/experience-card";
import { FilterRail } from "@/components/browse/filter-rail";
import { HeroSearch } from "@/components/browse/hero-search";
import { SoftPlanCta } from "@/components/browse/plan-cta";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
import { useBrowseCopy } from "@/lib/browse-copy";
import { formatPlural } from "@/i18n/format";
import { withLocalePrefix } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";
import { ExperiencesMap } from "@/components/browse/experiences-map";
import { splitSentence } from "@/lib/text";
import { cn, focusRing } from "@/lib/utils";
import {
  DESTINATIONS,
  LISTING_KINDS,
  serializeExperienceFilters,
  type Experience,
  type ExperienceFilters,
  type ExperiencePage,
} from "@/lib/catalog";

export function ExperiencesView({
  filters,
  page,
  mapItems,
}: {
  filters: ExperienceFilters;
  page: ExperiencePage;
  mapItems: Experience[];
}) {
  const copy = useBrowseCopy();
  const { locale } = useLocale();
  const router = useRouter();
  const [lead, tail] = splitSentence(copy.browseTitle);

  function pushFilters(next: ExperienceFilters) {
    const query = serializeExperienceFilters(next);
    router.push(withLocalePrefix(locale, query ? `/experiences?${query}` : "/experiences"));
  }

  function patch(partial: Partial<ExperienceFilters>) {
    pushFilters({ ...filters, ...partial });
  }

  const activeChips = [
    filters.q ? { key: "q", label: filters.q } : null,
    filters.category && filters.category !== "all" ? { key: "category", label: filters.category } : null,
    filters.destination
      ? {
          key: "destination",
          label: DESTINATIONS.find((item) => item.slug === filters.destination)?.name ?? filters.destination,
        }
      : null,
    filters.kind && filters.kind !== "all" ? { key: "kind", label: filters.kind } : null,
    filters.date ? { key: "date", label: filters.date } : null,
    filters.priceMax ? { key: "priceMax", label: `$${filters.priceMax}` } : null,
    filters.distance ? { key: "distance", label: `${filters.distance} km` } : null,
    filters.party ? { key: "party", label: String(filters.party) } : null,
    filters.rating ? { key: "rating", label: `${filters.rating}+` } : null,
    filters.available ? { key: "available", label: copy.availableOnly } : null,
  ].filter(Boolean) as { key: keyof ExperienceFilters; label: string }[];

  const advancedCount = [
    filters.date,
    filters.priceMax,
    filters.distance,
    filters.party,
    filters.rating,
    filters.available,
  ].filter(Boolean).length;
  const [showFilters, setShowFilters] = React.useState(false);
  const isMap = filters.view === "map";

  return (
    <div className="shell-frame grid gap-8 pb-20 pt-12 md:pt-16">
      <PageHeader eyebrow={copy.browseEyebrow} title={lead} accent={tail || undefined} description={copy.browseBody} />

      <div className="grid gap-3">
        <div className="flex flex-col gap-3 rounded-card border border-border-subtle bg-surface-sunken/70 p-3 md:flex-row md:items-center md:p-4">
          <HeroSearch initialQuery={filters.q ?? ""} compact />
          <NativeSelect
            aria-label={copy.destinations}
            wrapperClassName="md:w-56"
            className="h-12 border-border-subtle"
            value={filters.destination ?? ""}
            onChange={(event) => patch({ destination: event.target.value || undefined, page: 1 })}
          >
            <option value="">{copy.anywhere}</option>
            {DESTINATIONS.map((destination) => (
              <option key={destination.slug} value={destination.slug}>
                {destination.name}
              </option>
            ))}
          </NativeSelect>
          <Button
            type="button"
            variant="outline"
            className="h-12 px-6 lg:hidden"
            aria-expanded={showFilters}
            aria-controls="experience-filters"
            onClick={() => setShowFilters((value) => !value)}
          >
            <SlidersHorizontal aria-hidden />
            {copy.filters}
            {advancedCount ? (
              <span className="grid size-5 place-items-center rounded-full bg-brand text-[0.6875rem] text-brand-foreground">
                {advancedCount}
              </span>
            ) : null}
          </Button>
        </div>
        {/* Collapsed on phones until the toggle opens it; always open from `lg` up. */}
        <div className={cn("lg:block", showFilters ? "block" : "hidden")}>
          <FilterRail id="experience-filters" layout="panel" filters={filters} onChange={patch} />
        </div>
      </div>

      <div className="grid gap-4">
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
          {/* Scrolls instead of widening the page when the labels outgrow a phone. */}
          <div
            role="group"
            aria-label={copy.kindAll}
            className="scrollbar-hide inline-flex min-w-0 max-w-full overflow-x-auto rounded-pill border border-border-subtle bg-surface-raised p-1"
          >
            {LISTING_KINDS.map((kind) => {
              const active = (filters.kind ?? "all") === kind.slug;
              return (
                <button
                  key={kind.slug}
                  type="button"
                  aria-pressed={active}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-pill px-4 text-sm font-medium transition-colors",
                    active ? "bg-brand text-brand-foreground" : "text-text-muted hover:text-text",
                    focusRing,
                  )}
                  onClick={() => patch({ kind: kind.slug === "all" ? undefined : kind.slug, page: 1 })}
                >
                  {kind.slug === "all"
                    ? copy.kindAll
                    : kind.slug === "experience"
                      ? copy.kindExperiences
                      : kind.slug === "attraction"
                        ? copy.kindAttractions
                        : copy.kindRestaurants}
                </button>
              );
            })}
          </div>
        </div>
        <CategoryPills active={filters.category ?? "all"} />
      </div>

      {activeChips.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => patch({ [chip.key]: undefined, page: 1 } as Partial<ExperienceFilters>)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-pill bg-brand-subtle py-1.5 pe-2 ps-3 text-sm font-medium text-text hover:bg-brand-subtle/70",
                focusRing,
              )}
            >
              {chip.label}
              <X className="size-3.5" aria-hidden />
            </button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push(withLocalePrefix(locale, "/experiences"))}
          >
            {copy.clearFilters}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
        <p className="text-sm text-text-muted">
          {formatPlural(locale, page.total, { one: copy.placesOne, other: copy.placesOther })}
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">{copy.resultsSort}</span>
            <NativeSelect
              className="min-h-10 w-44 border-transparent bg-transparent py-2 hover:border-border-subtle"
              value={filters.sort ?? "recommended"}
              onChange={(event) =>
                patch({ sort: event.target.value === "recommended" ? undefined : event.target.value, page: 1 })
              }
              aria-label={copy.recommended}
            >
              <option value="recommended">{copy.sortRecommended}</option>
              <option value="price">{copy.sortPrice}</option>
              <option value="duration">{copy.sortDuration}</option>
              <option value="rating">{copy.sortRating}</option>
            </NativeSelect>
          </label>
          <div
            role="group"
            aria-label={copy.viewToggle}
            className="inline-flex rounded-control border border-border-subtle bg-surface-raised p-1"
          >
            <button
              type="button"
              aria-pressed={!isMap}
              onClick={() => patch({ view: undefined })}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-[0.55rem] px-2.5 text-sm font-medium",
                !isMap ? "bg-brand text-brand-foreground" : "text-text-muted hover:text-text",
                focusRing,
              )}
            >
              <LayoutGrid className="size-4" aria-hidden />
              <span className="sr-only sm:not-sr-only">{copy.listView}</span>
            </button>
            <button
              type="button"
              aria-pressed={isMap}
              onClick={() => patch({ view: "map" })}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-[0.55rem] px-2.5 text-sm font-medium",
                isMap ? "bg-brand text-brand-foreground" : "text-text-muted hover:text-text",
                focusRing,
              )}
            >
              <MapIcon className="size-4" aria-hidden />
              <span className="sr-only sm:not-sr-only">{copy.mapView}</span>
            </button>
          </div>
        </div>
      </div>

      {isMap ? (
        <ExperiencesMap items={mapItems} onSearchArea={(destination) => patch({ destination, page: 1 })} />
      ) : page.items.length ? (
        <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {page.items.map((experience) => (
            <ExperienceCard key={experience.slug} experience={experience} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<SlidersHorizontal aria-hidden />}
          title={copy.emptyResults}
          action={
            <Button type="button" onClick={() => router.push(withLocalePrefix(locale, "/experiences"))}>
              {copy.clearFilters}
            </Button>
          }
        />
      )}

      {page.pages > 1 ? (
        <nav className="flex items-center justify-center gap-3" aria-label="Pagination">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page.page <= 1}
            onClick={() => patch({ page: page.page - 1 })}
          >
            <ArrowLeft className="rtl:rotate-180" aria-hidden />
            {copy.pagePrevious}
          </Button>
          <p className="min-w-16 text-center text-sm tabular-nums text-text-muted">
            {page.page} / {page.pages}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page.page >= page.pages}
            onClick={() => patch({ page: page.page + 1 })}
          >
            {copy.pageNext}
            <ArrowRight className="rtl:rotate-180" aria-hidden />
          </Button>
        </nav>
      ) : null}

      <p className="-mt-2 text-xs text-text-muted">{copy.sampleOffer}</p>

      <SoftPlanCta />
      <p className="text-center text-sm">
        <LocaleLink
          href="/ideas"
          className="font-medium underline decoration-border-subtle underline-offset-4 hover:decoration-text"
        >
          {copy.ideasTitle}
        </LocaleLink>
      </p>
    </div>
  );
}
