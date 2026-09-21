"use client";

import * as React from "react";
import { ExperienceCard } from "@/components/browse/experience-card";
import { Compass, Heart, HeartOff } from "lucide-react";
import { HubFrame } from "@/components/hub/hub-nav";
import { HubLoading, HubPagination } from "@/components/hub/hub-pagination";
import { useHubPage } from "@/components/hub/use-hub-page";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { getExperience, type Experience } from "@/lib/catalog";
import { apiRequest } from "@/lib/api/client";
import { listingFromApi } from "@/lib/catalogue-api";
import { fetchFavorites, mergeFavorites, removeFavorite, type FavoriteRecord } from "@/lib/hub";
import { useHubCopy } from "@/lib/hub-copy";
import { useSavedExperiences } from "@/lib/saved-experiences";

export function FavoritesView() {
  const copy = useHubCopy();
  const { slugs, has, toggle } = useSavedExperiences();
  const loader = React.useCallback((page: number) => fetchFavorites(page), []);
  const { page, data, error, pending, load, setData } = useHubPage(loader);
  const synced = React.useRef(false);
  const [resolved, setResolved] = React.useState<Record<string, Experience>>({});

  React.useEffect(() => {
    const missing = (data?.items ?? [])
      .map((item) => item.listing_slug)
      .filter((slug) => !getExperience(slug) && !resolved[slug]);
    if (!missing.length) {
      return;
    }
    let cancelled = false;
    type ApiListingItem = Parameters<typeof listingFromApi>[0];
    void Promise.all(
      missing.map((slug) =>
        apiRequest<ApiListingItem>(`/api/v1/catalogue/experiences/${encodeURIComponent(slug)}`)
          .then((row) => [slug, listingFromApi(row)] as const)
          .catch(() => null),
      ),
    ).then((pairs) => {
      if (cancelled) {
        return;
      }
      const additions: Record<string, Experience> = {};
      for (const pair of pairs) {
        if (pair) {
          additions[pair[0]] = pair[1];
        }
      }
      if (Object.keys(additions).length) {
        setResolved((prev) => ({ ...prev, ...additions }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [data, resolved]);

  React.useEffect(() => {
    if (synced.current || slugs.length === 0) {
      return;
    }
    synced.current = true;
    // One request for every locally saved listing (the server ignores ones already saved).
    void mergeFavorites(slugs)
      .then(() => load(1))
      .catch(() => undefined);
  }, [load, slugs]);

  async function onRemove(item: FavoriteRecord) {
    await removeFavorite(item.id);
    if (has(item.listing_slug)) {
      toggle(item.listing_slug);
    }
    await load(page);
    setData((current) =>
      current ? { ...current, items: current.items.filter((row) => row.id !== item.id) } : current,
    );
  }

  return (
    <HubFrame
      current="/favorites"
      eyebrow={copy.favoritesKicker}
      title={copy.favoritesTitle}
      description={copy.favoritesBody}
      actions={
        // The empty state carries its own call to action; avoid two identical links.
        data && data.items.length > 0 ? (
          <Button asChild variant="outline" size="lg">
            <LocaleLink href="/experiences">
              <Compass aria-hidden />
              {copy.explorePlaces}
            </LocaleLink>
          </Button>
        ) : null
      }
    >
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      {pending && !data ? <HubLoading /> : null}
      {data && data.items.length === 0 ? (
        <EmptyState
          icon={<Heart aria-hidden />}
          title={copy.favoritesEmpty}
          description={copy.favoritesEmptyHint}
          action={
            <Button asChild size="lg">
              <LocaleLink href="/experiences">{copy.explorePlaces}</LocaleLink>
            </Button>
          }
        />
      ) : null}
      {data && data.items.length > 0 ? (
        <div className="grid gap-6">
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((item) => {
              const experience = getExperience(item.listing_slug) ?? resolved[item.listing_slug];
              return (
                <div key={item.id} className="grid content-start gap-3">
                  {experience ? (
                    <ExperienceCard experience={experience} />
                  ) : (
                    <div className="grid aspect-[4/3] place-items-center rounded-card border border-dashed border-border-subtle bg-surface-sunken p-6 text-center">
                      <p className="title-card">{item.listing_slug}</p>
                    </div>
                  )}
                  <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => void onRemove(item)}>
                    <HeartOff aria-hidden />
                    {copy.unfavorite}
                  </Button>
                </div>
              );
            })}
          </div>
          <HubPagination page={page} total={data.total} onPage={(next) => void load(next)} />
        </div>
      ) : null}
    </HubFrame>
  );
}
