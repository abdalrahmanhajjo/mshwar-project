"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, MapPin, Search, Users } from "lucide-react";
import { DESTINATIONS, parseExperienceFilters, serializeExperienceFilters } from "@/lib/catalog";
import { withLocalePrefix } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useBrowseCopy } from "@/lib/browse-copy";
import { cn } from "@/lib/utils";

const bareField =
  "min-h-0 border-0 bg-transparent px-0 py-0.5 text-[0.9375rem] font-medium shadow-none hover:border-0 focus-visible:ring-0 focus-visible:ring-offset-0";

function SearchSegment({
  icon: Icon,
  label,
  htmlFor,
  children,
  className,
}: {
  icon: typeof MapPin;
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative flex min-w-0 items-center gap-3 rounded-control px-4 py-3 transition-colors focus-within:bg-surface-sunken hover:bg-surface-sunken/70",
        className,
      )}
    >
      <Icon className="size-[1.15rem] shrink-0 text-text-muted" strokeWidth={1.6} aria-hidden />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <label htmlFor={htmlFor} className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
          {label}
        </label>
        {children}
      </div>
    </div>
  );
}

export function HeroSearch({ initialQuery = "", compact = false }: { initialQuery?: string; compact?: boolean }) {
  const copy = useBrowseCopy();
  const { locale } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [where, setWhere] = React.useState(initialQuery);
  const [destination, setDestination] = React.useState("");
  const [when, setWhen] = React.useState("");
  const [party, setParty] = React.useState("2");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = compact ? parseExperienceFilters(searchParams) : {};
    if (compact) {
      next.q = where.trim() || undefined;
    } else {
      next.destination = destination || undefined;
      next.party = party ? Number(party) : undefined;
    }
    next.date = when || next.date || undefined;
    next.page = 1;
    const query = serializeExperienceFilters(next);
    router.push(withLocalePrefix(locale, query ? `/experiences?${query}` : "/experiences"));
  }

  if (compact) {
    return (
      <form onSubmit={onSubmit} role="search" className="relative min-w-0 flex-1">
        <label htmlFor="browse-where" className="sr-only">
          {copy.searchExperiences}
        </label>
        <Search
          className="pointer-events-none absolute start-4 top-1/2 size-[1.1rem] -translate-y-1/2 text-text-muted"
          aria-hidden
        />
        <Input
          id="browse-where"
          name="q"
          type="search"
          value={where}
          onChange={(event) => setWhere(event.target.value)}
          placeholder={copy.searchExperiences}
          className="h-12 border-border-subtle ps-11 text-[0.9375rem]"
        />
      </form>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      className="grid gap-1 rounded-card border border-border-subtle bg-surface-raised p-2 shadow-lg md:grid-cols-[1.25fr_1fr_1fr_auto] md:items-center md:gap-0"
    >
      <SearchSegment icon={MapPin} label={copy.where} htmlFor="browse-where">
        <NativeSelect
          id="browse-where"
          name="destination"
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          className={bareField}
        >
          <option value="">{copy.wherePlaceholder}</option>
          {DESTINATIONS.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </NativeSelect>
      </SearchSegment>
      <SearchSegment
        icon={CalendarDays}
        label={copy.when}
        htmlFor="browse-when"
        className="md:border-s md:border-border-subtle md:rounded-none"
      >
        <Input
          id="browse-when"
          name="date"
          type="date"
          value={when}
          onChange={(event) => setWhen(event.target.value)}
          placeholder={copy.whenPlaceholder}
          className={cn(bareField, !when && "text-text-muted")}
        />
      </SearchSegment>
      <SearchSegment
        icon={Users}
        label={copy.company}
        htmlFor="browse-party"
        className="md:border-s md:border-border-subtle md:rounded-none"
      >
        <NativeSelect
          id="browse-party"
          name="party"
          value={party}
          onChange={(event) => setParty(event.target.value)}
          className={bareField}
        >
          {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((count) => (
            <option key={count} value={count}>
              {count} {copy.guests.toLowerCase()}
            </option>
          ))}
        </NativeSelect>
      </SearchSegment>
      <div className="p-1 md:ps-3">
        <Button type="submit" size="lg" className="h-13 w-full px-6 md:w-auto">
          <Search aria-hidden />
          {copy.findPlace}
        </Button>
      </div>
    </form>
  );
}
