"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { LocateFixed, MapPin, Save, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlannerCopy } from "@/lib/planner-copy";
import { reversePlace, saveStartLocation, searchPlaces, type PlaceHit, type StartLocation } from "@/lib/planner";
import { LEBANON } from "@/lib/geo";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

function pinFromClick(clientX: number, clientY: number, rect: DOMRect): { lat: number; lng: number } {
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  const lng = LEBANON.lngMin + x * (LEBANON.lngMax - LEBANON.lngMin);
  const lat = LEBANON.latMax - y * (LEBANON.latMax - LEBANON.latMin);
  return { lat, lng };
}

function pinPosition(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  const x = (lng - LEBANON.lngMin) / (LEBANON.lngMax - LEBANON.lngMin);
  const y = (LEBANON.latMax - lat) / (LEBANON.latMax - LEBANON.latMin);
  if (x < 0 || x > 1 || y < 0 || y > 1) {
    return null;
  }
  return { x: x * 100, y: y * 100 };
}

export function StartLocationPicker({
  initial,
  onSaved,
  standalone = false,
}: {
  initial?: StartLocation | null;
  onSaved?: (value: StartLocation) => void;
  standalone?: boolean;
}) {
  const copy = usePlannerCopy();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<PlaceHit[]>([]);
  // Results only make sense for a query that is still long enough to search.
  const visibleHits = query.trim().length < 2 ? [] : hits;
  const [label, setLabel] = React.useState(initial?.label ?? "");
  const [lat, setLat] = React.useState(String(initial?.lat ?? LEBANON.beirut.lat));
  const [lng, setLng] = React.useState(String(initial?.lng ?? LEBANON.beirut.lng));
  const [source, setSource] = React.useState<StartLocation["source"]>(initial?.source ?? "manual");
  const [denied, setDenied] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }
    // Ignore answers for a query the user has already moved past.
    let current = true;
    const handle = window.setTimeout(() => {
      void searchPlaces(query)
        .then((found) => current && setHits(found))
        .catch(() => current && setHits([]));
    }, 200);
    return () => {
      current = false;
      window.clearTimeout(handle);
    };
  }, [query]);

  async function applyPlace(place: PlaceHit, nextSource: StartLocation["source"]) {
    setLabel(place.label);
    setLat(String(place.lat));
    setLng(String(place.lng));
    setSource(nextSource);
    setHits([]);
  }

  async function onPin(event: React.MouseEvent<HTMLDivElement>) {
    const point = pinFromClick(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    const place = await reversePlace(point.lat, point.lng);
    await applyPlace(place, "pin");
  }

  function onLocate() {
    if (!navigator.geolocation) {
      setDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDenied(false);
        void reversePlace(position.coords.latitude, position.coords.longitude).then((place) =>
          applyPlace(place, "device"),
        );
      },
      () => setDenied(true),
    );
  }

  async function onSave() {
    setPending(true);
    try {
      const saved = await saveStartLocation({
        lat: Number(lat),
        lng: Number(lng),
        label: label || "Dropped pin",
        source,
      });
      const start = saved.preferences.start_location;
      setStatus(copy.savedStart);
      if (start && onSaved) {
        onSaved(start);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.manualEntry);
    } finally {
      setPending(false);
    }
  }

  const pin = pinPosition(Number(lat), Number(lng));
  const Heading = standalone ? "h1" : "h3";

  return (
    <section className="grid gap-6 rounded-card border border-border-subtle bg-surface-raised p-6 shadow-sm md:p-7">
      <header className="grid gap-2">
        {standalone ? <p className="eyebrow">{copy.routeStart}</p> : null}
        <Heading className={standalone ? "title-page" : "title-card"}>{copy.startTitle}</Heading>
        <p className="text-sm leading-relaxed text-text-muted">{copy.startHint}</p>
      </header>
      <div className={cn("grid gap-6", standalone && "lg:grid-cols-[1fr_1.1fr]")}>
        <div className="grid content-start gap-5">
          <div className="grid gap-2">
            <Label htmlFor="place-search">{copy.searchPlace}</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
                aria-hidden
              />
              <Input
                id="place-search"
                value={query}
                placeholder={copy.searchPlaceholder}
                className="ps-10"
                onChange={(event) => {
                  const next = event.target.value;
                  setQuery(next);
                  if (next.trim().length < 2) {
                    setHits([]);
                  }
                }}
              />
            </div>
            {visibleHits.length ? (
              <ul className="grid gap-1 rounded-control border border-border-subtle bg-surface-raised p-1.5 shadow-md">
                {visibleHits.map((hit) => (
                  <li key={hit.place_id}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-start rounded-[0.6rem]"
                      onClick={() => void applyPlace(hit, "search")}
                    >
                      <MapPin aria-hidden />
                      {hit.label}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Button type="button" variant="outline" onClick={onLocate}>
              <LocateFixed aria-hidden />
              {copy.useLocation}
            </Button>
            <p className="text-xs text-text-muted">{copy.precisePermission}</p>
            {denied ? (
              <p role="alert" className="text-sm text-danger">
                {copy.locationDenied}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="start-label">{copy.manualEntry}</Label>
            <Input id="start-label" value={label} onChange={(event) => setLabel(event.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Input
                aria-label="lat"
                value={lat}
                onChange={(event) => setLat(event.target.value)}
                className="tabular-nums"
              />
              <Input
                aria-label="lng"
                value={lng}
                onChange={(event) => setLng(event.target.value)}
                className="tabular-nums"
              />
            </div>
          </div>
        </div>
        <div className="grid content-start gap-2">
          <p className="text-sm font-medium">{copy.dropPin}</p>
          <div
            role="application"
            aria-label={copy.dropPin}
            dir="ltr"
            className="surface-grain relative min-h-[260px] cursor-crosshair overflow-hidden rounded-card border border-border-subtle bg-brand-subtle/60"
            onClick={(event) => void onPin(event)}
          >
            <div
              aria-hidden
              className="absolute inset-y-0 start-0 w-[18%] bg-gradient-to-r from-[#bfd9dd] to-transparent opacity-70"
            />
            {pin ? (
              <span
                aria-hidden
                className="absolute -translate-x-1/2 -translate-y-full"
                style={{ insetInlineStart: `${pin.x}%`, top: `${pin.y}%` }}
              >
                <MapPin className="size-8 fill-accent text-surface-raised drop-shadow" strokeWidth={1.5} />
              </span>
            ) : null}
            <span className="absolute bottom-3 start-3 max-w-[80%] truncate rounded-pill bg-surface-raised/95 px-3 py-1.5 text-sm font-medium shadow-sm">
              {label || copy.dropPin}
            </span>
          </div>
          {!MAPS_KEY ? <p className="text-xs text-text-muted">{copy.mapFallback}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-5">
        <Button type="button" disabled={pending} onClick={() => void onSave()}>
          <Save aria-hidden />
          {copy.saveStart}
        </Button>
        {status ? (
          <p role="status" className="text-sm text-text-muted">
            {status}
          </p>
        ) : null}
      </div>
    </section>
  );
}
