"use client";

import { useMemo, useState } from "react";
import { ExperienceCard } from "@/components/browse/experience-card";
import { SaveExperienceButton } from "@/components/browse/save-button";
import { BidiText } from "@/components/ui/bidi-text";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useCookieChoices } from "@/components/legal/cookie-consent-state";
import { ESSENTIAL_ONLY, writeCookieChoices } from "@/lib/cookie-consent";
import { useTrustCopy } from "@/lib/trust-copy";
import { cn } from "@/lib/utils";
import { useBrowseCopy } from "@/lib/browse-copy";
import { listingCoordinates } from "@/lib/listing-coordinates";
import type { Experience } from "@/lib/catalog";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

function clusterBeirut(items: Experience[]) {
  const beirut = items.filter((item) => item.destinationSlug === "beirut");
  const others = items.filter((item) => item.destinationSlug !== "beirut");
  return { beirut, others };
}

export function ExperiencesMap({
  items,
  onSearchArea,
}: {
  items: Experience[];
  onSearchArea: (destination?: string) => void;
}) {
  const copy = useBrowseCopy();
  const trust = useTrustCopy();
  const choices = useCookieChoices();
  const [active, setActive] = useState<string | null>(null);
  const selected = items.find((item) => item.slug === active) ?? null;
  const { beirut, others } = useMemo(() => clusterBeirut(items), [items]);
  const failed = !MAPS_KEY;
  // Google Maps sets its own cookies, so it loads only once maps are allowed (MSHWAR-113).
  const blocked = !failed && !choices?.maps;

  if (failed || blocked) {
    return (
      <div className="grid gap-4">
        {blocked ? (
          <Notice>
            <p className="font-semibold text-text">{trust.mapOffTitle}</p>
            <p>{trust.mapOffBody}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => writeCookieChoices({ ...(choices ?? ESSENTIAL_ONLY), maps: true })}
            >
              {trust.mapAllow}
            </Button>
          </Notice>
        ) : (
          <Notice>{copy.mapUnavailable}</Notice>
        )}
        <div
          className="surface-grain relative min-h-[420px] overflow-hidden rounded-[1.5rem] border border-border-subtle bg-brand-subtle/50"
          role="img"
          aria-label={copy.mapView}
        >
          <div className="absolute inset-6 grid grid-cols-3 gap-3">
            {beirut.length ? (
              <button
                type="button"
                className="h-fit w-fit rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-md"
                onClick={() => onSearchArea("beirut")}
              >
                {copy.clusterLabel} <BidiText>Beirut</BidiText> · {beirut.length}
              </button>
            ) : null}
            {others.map((item) => {
              const point = listingCoordinates(item);
              return (
                <button
                  key={item.slug}
                  type="button"
                  className={cn(
                    "h-fit w-fit rounded-pill border px-3.5 py-2 text-start text-sm font-medium shadow-md transition-colors",
                    active === item.slug
                      ? "border-brand bg-brand text-brand-foreground"
                      : "border-border-subtle bg-surface-raised hover:border-brand",
                  )}
                  style={{ marginTop: point ? `${(34.4 - point.lat) * 40}px` : undefined }}
                  onClick={() => setActive(item.slug)}
                >
                  <BidiText>{item.title}</BidiText>
                </button>
              );
            })}
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onSearchArea()}>
          {copy.searchThisArea}
        </Button>
        {selected ? (
          <div className="max-w-sm">
            <ExperienceCard experience={selected} compact />
          </div>
        ) : null}
      </div>
    );
  }

  const src = `https://www.google.com/maps/embed/v1/view?key=${MAPS_KEY}&center=33.89,35.50&zoom=8`;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="grid gap-3">
        <iframe title={copy.mapView} src={src} className="min-h-[420px] w-full rounded-[1.5rem] border-0" />
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Button key={item.slug} type="button" size="sm" variant="outline" onClick={() => setActive(item.slug)}>
              {item.title}
            </Button>
          ))}
          <Button type="button" size="sm" onClick={() => onSearchArea()}>
            {copy.searchThisArea}
          </Button>
        </div>
      </div>
      {selected ? (
        <div className="grid gap-3">
          <SaveExperienceButton slug={selected.slug} />
          <ExperienceCard experience={selected} compact />
        </div>
      ) : null}
    </div>
  );
}
