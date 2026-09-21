"use client";

import { LocaleLink } from "@/components/shell/locale-link";
import { useSearchParams } from "next/navigation";
import { Building2, Compass, Waves, Landmark, Mountain, Footprints } from "lucide-react";
import { useBrowseCopy } from "@/lib/browse-copy";
import { CATEGORIES, parseExperienceFilters, serializeExperienceFilters, type ExperienceCategory } from "@/lib/catalog";
import { cn, focusRing } from "@/lib/utils";

export const CATEGORY_ICONS = {
  all: Compass,
  nature: Mountain,
  coast: Waves,
  culture: Landmark,
  adventure: Footprints,
  city: Building2,
} as const;

export function CategoryPills({ active, variant = "chips" }: { active?: string; variant?: "chips" | "icons" }) {
  const copy = useBrowseCopy();
  const params = useSearchParams();

  function hrefFor(slug: string) {
    const next = parseExperienceFilters(params);
    next.category = slug === "all" ? undefined : slug;
    next.page = 1;
    const query = serializeExperienceFilters(next);
    return query ? `/experiences?${query}` : "/experiences";
  }

  if (variant === "icons") {
    return (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {CATEGORIES.map((item) => {
          const Icon = CATEGORY_ICONS[item.slug];
          const isActive = (active ?? "all") === item.slug;
          return (
            <li key={item.slug}>
              <LocaleLink
                href={hrefFor(item.slug)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "group flex h-full min-h-28 flex-col items-center justify-center gap-3 rounded-card border px-3 py-5 text-center text-sm font-medium transition-all duration-normal",
                  isActive
                    ? "border-brand bg-brand text-brand-foreground shadow-md"
                    : "border-border-subtle bg-surface-raised text-text hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md",
                  focusRing,
                )}
              >
                <span
                  className={cn(
                    "grid size-10 place-items-center rounded-full transition-colors",
                    isActive
                      ? "bg-brand-foreground/10"
                      : "bg-brand-subtle group-hover:bg-brand group-hover:text-brand-foreground",
                  )}
                >
                  <Icon className="size-5" strokeWidth={1.6} aria-hidden />
                </span>
                {item.slug === "all" ? copy.experiences : item.label}
              </LocaleLink>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {CATEGORIES.map((item) => {
        const Icon = CATEGORY_ICONS[item.slug];
        const href = hrefFor(item.slug);
        const isActive = (active ?? "all") === item.slug;
        return (
          <LocaleLink
            key={item.slug}
            href={href}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "inline-flex min-h-[var(--layout-min-target)] shrink-0 items-center gap-2 rounded-pill border px-4 text-sm font-medium transition-colors",
              isActive
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border-subtle bg-surface-raised text-text hover:border-brand/50 hover:bg-brand-subtle",
              focusRing,
            )}
          >
            <Icon className="size-4" strokeWidth={1.7} aria-hidden />
            {item.slug === "all" ? copy.experiences : item.label}
          </LocaleLink>
        );
      })}
    </div>
  );
}

export function categoryLabel(slug: "all" | ExperienceCategory): string {
  return CATEGORIES.find((item) => item.slug === slug)?.label ?? slug;
}
