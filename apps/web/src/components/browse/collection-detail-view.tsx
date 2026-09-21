"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Route } from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { ExperienceCard } from "@/components/browse/experience-card";
import { LocaleLink } from "@/components/shell/locale-link";
import { useAuth } from "@/components/shell/auth-provider";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/page-header";
import { useBrowseCopy } from "@/lib/browse-copy";
import { withLocalePrefix } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";
import type { Experience, Idea } from "@/lib/catalog";
import { cn, focusRing } from "@/lib/utils";

export function CollectionDetailView({ collection, stops }: { collection: Idea; stops: Experience[] }) {
  const copy = useBrowseCopy();
  const { user } = useAuth();
  const { locale } = useLocale();
  const router = useRouter();
  const total = stops.reduce((sum, stop) => sum + stop.priceFrom, 0);
  const hours = stops.reduce((sum, stop) => sum + stop.hours, 0);

  async function openAsTrip() {
    if (!user) {
      router.push(withLocalePrefix(locale, `/signin?next=/collections/${collection.slug}`));
      return;
    }
    const response = await fetch(`/api/v1/catalogue/collections/${collection.slug}/open-as-trip`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      return;
    }
    const trip = (await response.json()) as { id: string };
    router.push(withLocalePrefix(locale, `/plan?trip=${trip.id}&collection=${collection.slug}`));
  }

  return (
    <div className="shell-frame grid gap-12 pb-20 pt-10 md:pt-12">
      <LocaleLink
        href="/collections"
        className={cn(
          "inline-flex w-fit items-center gap-2 rounded-sm text-sm text-text-muted hover:text-text",
          focusRing,
        )}
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {copy.collectionsTitle}
      </LocaleLink>
      <header className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div className="grid gap-5">
          <Eyebrow dot>{collection.kicker}</Eyebrow>
          <h1 className="title-page text-balance">{collection.title}</h1>
          <p className="max-w-lg text-lg leading-relaxed text-text-muted">{collection.description}</p>
          <dl className="flex flex-wrap gap-x-8 gap-y-3 border-y border-border-subtle py-4 text-sm">
            <div>
              <dt className="text-text-muted">{copy.stopsLabel}</dt>
              <dd className="text-xl font-semibold tracking-tight">{stops.length}</dd>
            </div>
            <div>
              <dt className="text-text-muted">{copy.hoursLabel}</dt>
              <dd className="text-xl font-semibold tracking-tight">{hours}</dd>
            </div>
            <div>
              <dt className="text-text-muted">{copy.fromPrice}</dt>
              <dd className="text-xl font-semibold tracking-tight">
                {total > 0 ? (
                  <>
                    ${total} <span className="text-sm font-normal text-text-muted">/ {copy.perPerson}</span>
                  </>
                ) : (
                  copy.free
                )}
              </dd>
            </div>
          </dl>
          <div>
            <Button type="button" size="lg" onClick={() => void openAsTrip()}>
              <Route aria-hidden />
              {copy.openAsTrip}
            </Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-[1.5rem]">
          <div className="aspect-[4/3]">
            <CatalogImage
              src={collection.image}
              alt={collection.imageAlt}
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
          </div>
        </div>
      </header>
      <ol className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {stops.map((experience, index) => (
          <li key={experience.slug} className="grid content-start gap-3">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
              <span className="grid size-7 place-items-center rounded-full border border-border-subtle bg-surface-raised text-text">
                {String(index + 1).padStart(2, "0")}
              </span>
            </span>
            <ExperienceCard experience={experience} />
          </li>
        ))}
      </ol>
    </div>
  );
}
