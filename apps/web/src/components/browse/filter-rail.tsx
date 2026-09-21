"use client";

import { DESTINATIONS } from "@/lib/catalog";
import { useBrowseCopy } from "@/lib/browse-copy";
import type { ExperienceFilters } from "@/lib/catalog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

export function FilterRail({
  filters,
  onChange,
  layout = "rail",
  id,
}: {
  filters: ExperienceFilters;
  onChange: (next: Partial<ExperienceFilters>) => void;
  layout?: "rail" | "panel";
  id?: string;
}) {
  const copy = useBrowseCopy();

  return (
    <aside
      id={id}
      aria-label={copy.filters}
      className={cn(
        "rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6",
        layout === "panel" && "shadow-sm",
      )}
    >
      <h2 className={cn("text-sm font-semibold", layout === "panel" && "sr-only")}>{copy.filters}</h2>
      <div
        className={cn(
          "grid gap-4",
          layout === "rail" ? "mt-4" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 xl:items-end",
        )}
      >
        <div className="grid gap-2">
          <Label htmlFor="filter-date">{copy.filterDate}</Label>
          <Input
            id="filter-date"
            type="date"
            value={filters.date ?? ""}
            onChange={(event) => onChange({ date: event.target.value || undefined, page: 1 })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="filter-price">{copy.filterPrice}</Label>
          <NativeSelect
            id="filter-price"
            value={filters.priceMax ?? ""}
            onChange={(event) =>
              onChange({ priceMax: event.target.value ? Number(event.target.value) : undefined, page: 1 })
            }
          >
            <option value="">{copy.priceAny}</option>
            <option value="25">$25</option>
            <option value="35">$35</option>
            <option value="45">$45</option>
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="filter-distance">{copy.filterDistance}</Label>
          <NativeSelect
            id="filter-distance"
            value={filters.distance ?? ""}
            onChange={(event) =>
              onChange({ distance: event.target.value ? Number(event.target.value) : undefined, page: 1 })
            }
          >
            <option value="">{copy.distanceAny}</option>
            <option value="20">20 km</option>
            <option value="40">40 km</option>
            <option value="80">80 km</option>
          </NativeSelect>
        </div>
        {layout === "rail" ? (
          <div className="grid gap-2">
            <Label htmlFor="filter-destination">{copy.destinations}</Label>
            <NativeSelect
              id="filter-destination"
              value={filters.destination ?? ""}
              onChange={(event) => onChange({ destination: event.target.value || undefined, page: 1 })}
            >
              <option value="">{copy.anywhere}</option>
              {DESTINATIONS.map((destination) => (
                <option key={destination.slug} value={destination.slug}>
                  {destination.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="filter-party">{copy.filterGroup}</Label>
          <Input
            id="filter-party"
            type="number"
            min={1}
            max={20}
            value={filters.party ?? ""}
            onChange={(event) =>
              onChange({ party: event.target.value ? Number(event.target.value) : undefined, page: 1 })
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="filter-rating">{copy.filterRating}</Label>
          <NativeSelect
            id="filter-rating"
            value={filters.rating ?? ""}
            onChange={(event) =>
              onChange({ rating: event.target.value ? Number(event.target.value) : undefined, page: 1 })
            }
          >
            <option value="">{copy.anyRating}</option>
            <option value="4">4+</option>
            <option value="4.5">4.5+</option>
          </NativeSelect>
        </div>
        <label className="flex min-h-[var(--layout-min-target)] cursor-pointer items-center gap-2.5 rounded-control border border-border-subtle bg-surface px-3.5 text-sm">
          <input
            type="checkbox"
            checked={Boolean(filters.available)}
            onChange={(event) => onChange({ available: event.target.checked || undefined, page: 1 })}
          />
          {copy.availableOnly}
        </label>
      </div>
    </aside>
  );
}
