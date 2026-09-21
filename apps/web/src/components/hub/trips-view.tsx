"use client";

import * as React from "react";
import { Archive, CalendarDays, ChevronLeft, ChevronRight, List, Lock, Plus, Route, SearchX } from "lucide-react";
import { HubFrame } from "@/components/hub/hub-nav";
import { HubLoading, HubPagination } from "@/components/hub/hub-pagination";
import { useHubPage } from "@/components/hub/use-hub-page";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { formatDate, formatPlural } from "@/i18n/format";
import { archiveTrip, fetchAllTrips, fetchTrips, type TripRecord } from "@/lib/hub";
import { useHubCopy } from "@/lib/hub-copy";
import { cn, focusRing } from "@/lib/utils";
import type { Locale } from "@/lib/locale";

const STATUS_VARIANT: Record<string, "secondary" | "warning" | "outline"> = {
  draft: "secondary",
  locked: "warning",
  archived: "outline",
};

const STATUS_ACCENT: Record<string, string> = {
  draft: "bg-brand",
  locked: "bg-warning",
  archived: "bg-border-strong",
};

function dayKey(iso?: string | null): string | null {
  return iso ? iso.slice(0, 10) : null;
}

function TripCard({
  trip,
  copy,
  locale,
  onArchive,
}: {
  trip: TripRecord;
  copy: ReturnType<typeof useHubCopy>;
  locale: Locale;
  onArchive: (trip: TripRecord) => void;
}) {
  const locked = trip.status === "locked";
  return (
    <li
      className={cn(
        "group relative grid overflow-hidden rounded-card border border-border-subtle bg-surface-raised shadow-sm transition-shadow hover:shadow-md",
        trip.status === "archived" && "opacity-75",
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-full", STATUS_ACCENT[trip.status] ?? "bg-border-strong")} />
      <div className="grid gap-5 p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-brand-subtle text-text">
            <Route className="size-5" strokeWidth={1.6} aria-hidden />
          </span>
          <Badge variant={STATUS_VARIANT[trip.status] ?? "secondary"}>
            {locked ? (
              <>
                <Lock className="size-3" aria-hidden />
                {copy.statusLocked}
              </>
            ) : trip.status === "archived" ? (
              copy.statusArchived
            ) : (
              copy.statusDraft
            )}
          </Badge>
        </div>
        <div className="grid gap-1.5">
          <h2 className="title-card text-[1.3rem] leading-snug">{trip.name}</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted">
            {trip.planned_date ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-text">
                <CalendarDays className="size-4" strokeWidth={1.75} aria-hidden />
                {formatDate(locale, trip.planned_date)}
              </span>
            ) : null}
            {trip.stop_count ? (
              <span className="inline-flex items-center gap-1.5">
                <Route className="size-4" strokeWidth={1.75} aria-hidden />
                {formatPlural(locale, trip.stop_count, { one: copy.stopsOne, other: copy.stopsOther })}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
          <Button asChild size="sm">
            <LocaleLink href={`/plan?trip=${trip.id}`}>
              <Route aria-hidden />
              {copy.openTrip}
            </LocaleLink>
          </Button>
          {trip.status === "archived" ? null : (
            <Button type="button" variant="ghost" size="sm" onClick={() => onArchive(trip)}>
              <Archive aria-hidden />
              {copy.archiveTrip}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function TripsCalendar({
  trips,
  locale,
  selectedDay,
  onSelectDay,
  copy,
}: {
  trips: TripRecord[];
  locale: Locale;
  selectedDay: string | null;
  onSelectDay: (day: string | null) => void;
  copy: ReturnType<typeof useHubCopy>;
}) {
  const [cursor, setCursor] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const byDay = React.useMemo(() => {
    const map = new Map<string, TripRecord[]>();
    for (const trip of trips) {
      const key = dayKey(trip.planned_date);
      if (!key) {
        continue;
      }
      const list = map.get(key) ?? [];
      list.push(trip);
      map.set(key, list);
    }
    return map;
  }, [trips]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(cursor);
  const weekdayNames = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2026, 10, 1 + i)),
  );
  const todayKey = dayKey(new Date().toISOString());

  return (
    <div className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-4 shadow-sm md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="title-card text-[1.25rem]">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="rounded-full"
            aria-label="Previous month"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="rounded-full"
            aria-label="Next month"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
          >
            <ChevronRight className="size-4 rtl:-scale-x-100" aria-hidden />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase tracking-wide text-text-muted">
        {weekdayNames.map((name) => (
          <span key={name} className="py-1">
            {name}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((key, index) => {
          if (!key) {
            return <span key={`empty-${index}`} />;
          }
          const dayTrips = byDay.get(key) ?? [];
          const has = dayTrips.length > 0;
          const isSelected = selectedDay === key;
          const isToday = key === todayKey;
          const dayNumber = Number(key.slice(-2));
          return (
            <button
              key={key}
              type="button"
              disabled={!has}
              aria-pressed={isSelected}
              onClick={() => onSelectDay(isSelected ? null : key)}
              className={cn(
                "grid aspect-square place-content-start gap-1 rounded-control border p-1.5 text-start text-sm transition-colors",
                isSelected
                  ? "border-brand bg-brand text-white"
                  : has
                    ? "border-brand/30 bg-brand-subtle/50 hover:border-brand/60"
                    : "border-transparent text-text-muted",
                focusRing,
              )}
            >
              <span className={cn("tabular-nums", isToday && !isSelected && "font-bold text-brand")}>{dayNumber}</span>
              {has ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-[0.7rem] font-semibold",
                    isSelected ? "text-white" : "text-brand",
                  )}
                >
                  <span className="size-1.5 rounded-full bg-current" aria-hidden />
                  {dayTrips.length}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {selectedDay ? (
        <button
          type="button"
          onClick={() => onSelectDay(null)}
          className={cn("w-fit text-sm font-medium text-brand underline underline-offset-2", focusRing)}
        >
          {copy.allDays}
        </button>
      ) : null}
    </div>
  );
}

export function TripsView() {
  const copy = useHubCopy();
  const { locale } = useLocale();
  const loader = React.useCallback((page: number) => fetchTrips(page), []);
  const { page, data, error, pending, load, setData } = useHubPage(loader);

  const [view, setView] = React.useState<"list" | "calendar">("list");
  const [calTrips, setCalTrips] = React.useState<TripRecord[] | null>(null);
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (view !== "calendar" || calTrips) {
      return;
    }
    let cancelled = false;
    void fetchAllTrips()
      .then((all) => !cancelled && setCalTrips(all.items))
      .catch(() => !cancelled && setCalTrips([]));
    return () => {
      cancelled = true;
    };
  }, [view, calTrips]);

  async function onArchive(trip: TripRecord) {
    const next = await archiveTrip(trip.id);
    setData((current) =>
      current ? { ...current, items: current.items.map((item) => (item.id === next.id ? next : item)) } : current,
    );
    setCalTrips((current) => current?.map((item) => (item.id === next.id ? next : item)) ?? current);
  }

  const activeCount = data?.items.filter((trip) => trip.status !== "archived").length ?? 0;
  const calendarList = (calTrips ?? []).filter((trip) =>
    selectedDay ? dayKey(trip.planned_date) === selectedDay : true,
  );

  return (
    <HubFrame
      current="/trips"
      eyebrow={copy.tripsKicker}
      title={copy.tripsTitle}
      description={copy.tripsBody}
      actions={
        <Button asChild size="lg">
          <LocaleLink href="/plan/start">
            <Plus aria-hidden />
            {copy.newTrip}
          </LocaleLink>
        </Button>
      }
    >
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}

      {data && data.items.length > 0 ? (
        <div
          role="tablist"
          aria-label={copy.viewCalendar}
          className="flex w-fit gap-1 rounded-pill border border-border-subtle bg-surface-sunken p-1"
        >
          {(["list", "calendar"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={view === mode}
              onClick={() => setView(mode)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors",
                view === mode ? "bg-surface-raised shadow-sm" : "text-text-muted hover:text-text",
                focusRing,
              )}
            >
              {mode === "list" ? (
                <List className="size-4" aria-hidden />
              ) : (
                <CalendarDays className="size-4" aria-hidden />
              )}
              {mode === "list" ? copy.viewList : copy.viewCalendar}
            </button>
          ))}
        </div>
      ) : null}

      {pending && !data ? <HubLoading /> : null}

      {data && data.items.length === 0 ? (
        <EmptyState
          icon={<SearchX aria-hidden />}
          title={copy.tripsEmpty}
          description={copy.tripsEmptyHint}
          action={
            <Button asChild size="lg">
              <LocaleLink href="/plan">{copy.planTrip}</LocaleLink>
            </Button>
          }
        />
      ) : null}

      {data && data.items.length > 0 && view === "list" ? (
        <div className="grid gap-6">
          {activeCount > 0 ? (
            <p className="text-sm text-text-muted">
              {activeCount} {activeCount === 1 ? "active tour" : "active tours"} · {data.total} total
            </p>
          ) : null}
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.items.map((trip) => (
              <TripCard key={trip.id} trip={trip} copy={copy} locale={locale} onArchive={(t) => void onArchive(t)} />
            ))}
          </ul>
          <HubPagination page={page} total={data.total} onPage={(next) => void load(next)} />
        </div>
      ) : null}

      {data && data.items.length > 0 && view === "calendar" ? (
        <div className="grid gap-6">
          {calTrips === null ? (
            <HubLoading />
          ) : (
            <>
              <TripsCalendar
                trips={calTrips}
                locale={locale}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                copy={copy}
              />
              {calendarList.length ? (
                <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {calendarList.map((trip) => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      copy={copy}
                      locale={locale}
                      onArchive={(t) => void onArchive(t)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-muted">{copy.noTripsDay}</p>
              )}
            </>
          )}
        </div>
      ) : null}
    </HubFrame>
  );
}
