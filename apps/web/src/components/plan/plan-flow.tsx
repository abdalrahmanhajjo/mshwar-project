"use client";

import * as React from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
  Wallet,
  Wand2,
} from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { PlanWorkspace } from "@/components/plan/plan-workspace";
import { CostPanel, ReplacePanel, Timeline, plannerErrorMessage } from "@/components/planner/planner-view";
import {
  acceptReplacement,
  cancelReplacement,
  createManualPlan,
  createPlannerSession,
  fetchTripVersions,
  fetchVersion,
  refinePlannerSession,
  regeneratePlannerSession,
  type PlannerSession,
} from "@/lib/planner";
import { apiRequest } from "@/lib/api/client";
import { listingFromApi } from "@/lib/catalogue-api";
import type { Destination, Experience } from "@/lib/catalog";
import { usePlannerCopy } from "@/lib/planner-copy";
import { useCheckoutCopy } from "@/lib/checkout-copy";
import { interpolate } from "@/i18n/catalogues";
import { splitSentence } from "@/lib/text";
import { cn, focusRing } from "@/lib/utils";

type ApiListingItem = Parameters<typeof listingFromApi>[0];

type Mode = "ai" | "manual";
type Step = "destination" | "places" | "details" | "review";

function stepsFor(mode: Mode): Step[] {
  return mode === "manual" ? ["destination", "places", "details", "review"] : ["destination", "details", "review"];
}

function tomorrowIso() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function PlanFlow({
  destinations,
  initialTripId,
  collectionTitle,
  addSlug,
  addDestination,
}: {
  destinations: Destination[];
  initialTripId?: string;
  collectionTitle?: string;
  addSlug?: string;
  addDestination?: string;
}) {
  const copy = usePlannerCopy();
  const checkout = useCheckoutCopy();
  const { locale } = useLocale();
  const [lead, tail] = splitSentence(copy.pageTitle);

  const [mode, setMode] = React.useState<Mode>("ai");
  const [step, setStep] = React.useState<Step>(() => (initialTripId ? "review" : "destination"));
  const [destSlug, setDestSlug] = React.useState<string | null>(null);
  const [date, setDate] = React.useState<string>(tomorrowIso);
  const [party, setParty] = React.useState<number>(2);
  const [budget, setBudget] = React.useState<number>(200);
  const [strict, setStrict] = React.useState<boolean>(false);
  const [vibe, setVibe] = React.useState<string>("");

  // Manual mode
  const [placeOptions, setPlaceOptions] = React.useState<Experience[]>([]);
  const [loadingPlaces, setLoadingPlaces] = React.useState(false);
  const [picks, setPicks] = React.useState<Experience[]>([]);
  const [manualTripId, setManualTripId] = React.useState<string | undefined>(undefined);

  const [session, setSession] = React.useState<PlannerSession | null>(null);
  const [versions, setVersions] = React.useState<{ version: number; origin: string; sealed_at: string | null }[]>([]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [refine, setRefine] = React.useState("");
  const [replaceStopId, setReplaceStopId] = React.useState<string | null>(null);
  const [alts, setAlts] = React.useState<
    { experience_id: string; title: string; why_fit: string[]; sponsored: boolean }[]
  >([]);
  const [preview, setPreview] = React.useState<{
    preview_id: string;
    title: string;
    delta_cost_minor: number;
    delta_minutes: number;
    why_fit: string[];
  } | null>(null);

  const plan = session?.plan ?? null;
  const sessionId = session?.session_id || undefined;
  const selectedDestination = destinations.find((item) => item.slug === destSlug) ?? null;
  const pickedSlugs = new Set(picks.map((item) => item.slug));

  // Reopening a saved trip: load its latest version read-only and jump to review.
  React.useEffect(() => {
    if (!initialTripId) {
      return;
    }
    let cancelled = false;
    void fetchTripVersions(initialTripId)
      .then(async (history) => {
        if (cancelled) {
          return;
        }
        setVersions(history);
        if (!history.length) {
          return;
        }
        const latest = history.reduce((best, item) => (item.version > best.version ? item : best));
        const doc = await fetchVersion(latest.version_id);
        if (cancelled) {
          return;
        }
        setSession({
          session_id: "",
          status: "loaded",
          degraded: false,
          degraded_message: null,
          constraints: doc.constraints ?? {},
          assumed_defaults: [],
          clarifications: [],
          plan: doc,
        });
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(plannerErrorMessage(caught, copy));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialTripId, copy]);

  // Deep-link from a place: pre-load it into a manual plan (opened in this tab).
  React.useEffect(() => {
    if (!addSlug || initialTripId) {
      return;
    }
    let cancelled = false;
    type ApiListingItem = Parameters<typeof listingFromApi>[0];
    void apiRequest<ApiListingItem>(`/api/v1/catalogue/experiences/${encodeURIComponent(addSlug)}`)
      .then(async (row) => {
        if (cancelled) {
          return;
        }
        const exp = listingFromApi(row);
        const destination = addDestination || exp.destinationSlug;
        setMode("manual");
        setDestSlug(destination);
        setPicks([exp]);
        setStep("places");
        if (destination) {
          setLoadingPlaces(true);
          try {
            const search = new URLSearchParams({ destination, page: "1", pageSize: "48" });
            const data = await apiRequest<{ items: ApiListingItem[] }>(`/api/v1/catalogue/experiences?${search}`);
            if (!cancelled) {
              setPlaceOptions(data.items.map(listingFromApi));
            }
          } catch {
            if (!cancelled) {
              setPlaceOptions([]);
            }
          } finally {
            if (!cancelled) {
              setLoadingPlaces(false);
            }
          }
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [addSlug, addDestination, initialTripId]);

  async function run(task: () => Promise<PlannerSession>) {
    setPending(true);
    setError(null);
    try {
      const next = await task();
      setSession(next);
      if (next.plan?.trip_id) {
        setManualTripId(next.plan.trip_id);
        setVersions(await fetchTripVersions(next.plan.trip_id));
      }
    } catch (caught) {
      setError(plannerErrorMessage(caught, copy));
    } finally {
      setPending(false);
    }
  }

  async function generate() {
    if (!selectedDestination) {
      return;
    }
    const answers: Record<string, unknown> = {
      intent_anchor: selectedDestination.slug,
      party_size: party,
      window_start: `${date}T09:00:00`,
      budget_minor: Math.round(budget * 100),
      strict_budget: strict,
    };
    const text = vibe.trim() || `A day in ${selectedDestination.name}`;
    setStep("review");
    await run(() => createPlannerSession({ text, locale, answers }));
  }

  async function saveManual() {
    if (!picks.length) {
      return;
    }
    const destinationSlugs = Array.from(new Set(picks.map((item) => item.destinationSlug)));
    setStep("review");
    await run(() =>
      createManualPlan({
        experience_slugs: picks.map((item) => item.slug),
        destination_slugs: destinationSlugs,
        party_size: party,
        window_start: `${date}T09:00:00`,
        budget_minor: Math.round(budget * 100),
        strict_budget: strict,
        currency: "USD",
        trip_id: manualTripId,
        locale,
      }),
    );
  }

  async function editManually() {
    if (!plan) {
      return;
    }
    const slugs = plan.stops
      .map((stop) => stop.snapshot.slug ?? stop.slug)
      .filter((slug): slug is string => Boolean(slug));
    if (!slugs.length) {
      return;
    }
    setPending(true);
    type ApiListingItem = Parameters<typeof listingFromApi>[0];
    try {
      const resolved = await Promise.all(
        slugs.map((slug) =>
          apiRequest<ApiListingItem>(`/api/v1/catalogue/experiences/${encodeURIComponent(slug)}`)
            .then(listingFromApi)
            .catch(() => null),
        ),
      );
      const picksResolved = resolved.filter((item): item is Experience => item !== null);
      if (!picksResolved.length) {
        return;
      }
      setPicks(picksResolved);
      setMode("manual");
      setManualTripId(plan.trip_id);
      const destination = picksResolved[0]?.destinationSlug;
      if (destination) {
        setDestSlug(destination);
      }
      setPlaceOptions([]);
      setStep("places");
      if (destination) {
        setLoadingPlaces(true);
        try {
          const search = new URLSearchParams({ destination, page: "1", pageSize: "48" });
          const data = await apiRequest<{ items: ApiListingItem[] }>(`/api/v1/catalogue/experiences?${search}`);
          setPlaceOptions(data.items.map(listingFromApi));
        } catch {
          setPlaceOptions([]);
        } finally {
          setLoadingPlaces(false);
        }
      }
    } finally {
      setPending(false);
    }
  }

  async function openPlaces() {
    setStep("places");
    if (!selectedDestination) {
      return;
    }
    setLoadingPlaces(true);
    try {
      const search = new URLSearchParams({ destination: selectedDestination.slug, page: "1", pageSize: "48" });
      const data = await apiRequest<{ items: ApiListingItem[] }>(`/api/v1/catalogue/experiences?${search}`);
      setPlaceOptions(data.items.map(listingFromApi));
    } catch {
      setPlaceOptions([]);
    } finally {
      setLoadingPlaces(false);
    }
  }

  function togglePick(exp: Experience) {
    setPicks((current) =>
      current.some((item) => item.slug === exp.slug)
        ? current.filter((item) => item.slug !== exp.slug)
        : [...current, exp],
    );
  }

  function movePick(index: number, direction: -1 | 1) {
    setPicks((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) {
        return current;
      }
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function startOver() {
    setSession(null);
    setVersions([]);
    setError(null);
    setReplaceStopId(null);
    setPreview(null);
    setAlts([]);
    setRefine("");
    setPicks([]);
    setPlaceOptions([]);
    setManualTripId(undefined);
    setStep("destination");
  }

  function switchMode(next: Mode) {
    if (next === mode) {
      return;
    }
    setMode(next);
    setSession(null);
    setPicks([]);
    setManualTripId(undefined);
    setError(null);
    setStep("destination");
  }

  const order = stepsFor(mode);
  const activeIndex = order.indexOf(step);
  const stepLabel = (item: Step) =>
    item === "destination"
      ? copy.flowStepDestination
      : item === "places"
        ? copy.flowStepPlaces
        : item === "details"
          ? copy.flowStepDetails
          : copy.flowStepReview;

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={copy.plannerKicker}
        icon={<Sparkles aria-hidden />}
        title={lead}
        accent={tail || undefined}
        description={copy.pageBody}
      />

      {!initialTripId ? (
        <div className="grid gap-6">
          <div
            role="tablist"
            aria-label={copy.flowStepReview}
            className="grid grid-cols-2 gap-2 rounded-card border border-border-subtle bg-surface-sunken p-1.5 sm:max-w-md"
          >
            {(["ai", "manual"] as Mode[]).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={mode === item}
                onClick={() => switchMode(item)}
                className={cn(
                  "grid gap-0.5 rounded-control px-4 py-2.5 text-start transition-colors",
                  mode === item ? "bg-surface-raised shadow-sm" : "hover:bg-surface-raised/60",
                  focusRing,
                )}
              >
                <span className="flex items-center gap-2 font-semibold">
                  {item === "ai" ? (
                    <Sparkles className="size-4" aria-hidden />
                  ) : (
                    <Pencil className="size-4" aria-hidden />
                  )}
                  {item === "ai" ? copy.modeAi : copy.modeManual}
                </span>
                <span className="text-xs text-text-muted">{item === "ai" ? copy.modeAiHint : copy.modeManualHint}</span>
              </button>
            ))}
          </div>

          <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label={copy.flowStepReview}>
            {order.map((item, index) => {
              const done = index < activeIndex;
              const current = index === activeIndex;
              return (
                <li key={item} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 font-medium",
                      current
                        ? "border-brand bg-brand text-white"
                        : done
                          ? "border-brand/40 bg-brand-subtle text-brand"
                          : "border-border-subtle bg-surface text-text-muted",
                    )}
                  >
                    <span className="grid size-5 place-items-center rounded-full bg-white/20 text-xs tabular-nums">
                      {done ? <Check className="size-3.5" aria-hidden /> : index + 1}
                    </span>
                    {stepLabel(item)}
                  </span>
                  {index < order.length - 1 ? <span className="h-px w-5 bg-border-subtle" aria-hidden /> : null}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}

      {addSlug ? (
        <Notice role="status">
          <span className="flex flex-wrap items-center justify-between gap-3">
            {collectionTitle ?? addSlug}
            <Button asChild size="sm" variant="accent">
              <LocaleLink href={`/checkout?listing=${addSlug}&source=itinerary`}>
                {checkout.bookThisStop}
                <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
              </LocaleLink>
            </Button>
          </span>
        </Notice>
      ) : null}

      {step === "destination" && !initialTripId ? (
        <section aria-labelledby="pf-dest" className="grid gap-6">
          <div className="grid gap-2">
            <h2 id="pf-dest" className="title-section">
              {copy.flowChooseTitle}
            </h2>
            <p className="max-w-2xl text-text-muted">{copy.flowChooseHint}</p>
          </div>
          {destinations.length ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {destinations.map((item) => {
                  const active = item.slug === destSlug;
                  return (
                    <button
                      key={item.slug}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setDestSlug(item.slug)}
                      className={cn(
                        "group relative grid overflow-hidden rounded-card border bg-surface-raised text-start shadow-sm transition-all hover:shadow-md",
                        active ? "border-brand ring-2 ring-brand/40" : "border-border-subtle",
                        focusRing,
                      )}
                    >
                      <span className="relative block aspect-[16/10] overflow-hidden">
                        <CatalogImage src={item.image} alt={item.imageAlt} />
                        {active ? (
                          <span className="absolute end-3 top-3 grid size-7 place-items-center rounded-full bg-brand text-white shadow">
                            <Check className="size-4" aria-hidden />
                          </span>
                        ) : null}
                      </span>
                      <span className="grid gap-1 p-4">
                        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
                          <MapPin className="size-3.5" aria-hidden />
                          {item.region}
                        </span>
                        <span className="title-card text-[1.15rem]">{item.name}</span>
                        <span className="line-clamp-2 text-sm text-text-muted">{item.blurb}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="lg"
                  disabled={!destSlug}
                  onClick={() => (mode === "manual" ? void openPlaces() : setStep("details"))}
                >
                  {copy.flowContinue}
                </Button>
              </div>
            </>
          ) : (
            <Notice role="status">{copy.flowNoDestinations}</Notice>
          )}
        </section>
      ) : null}

      {step === "places" && mode === "manual" && !initialTripId ? (
        <section aria-labelledby="pf-places" className="grid gap-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-2">
              <h2 id="pf-places" className="title-section">
                {copy.flowPickTitle}
              </h2>
              <p className="max-w-2xl text-text-muted">{copy.flowPickHint}</p>
            </div>
            <Badge variant="secondary" className="text-sm">
              {interpolate(copy.flowSelectedCount, { n: picks.length })}
            </Badge>
          </div>

          {picks.length ? (
            <div className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-4 md:p-5">
              <p className="text-sm text-text-muted">{copy.flowReorderHint}</p>
              <p className="text-xs text-text-muted">{copy.flowNoOverlap}</p>
              <ol className="grid gap-2">
                {picks.map((item, index) => (
                  <li
                    key={item.slug}
                    className="flex items-center gap-3 rounded-control border border-border-subtle bg-surface px-3 py-2.5"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-subtle text-xs font-semibold tabular-nums text-brand">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                    <span className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 rounded-full"
                        aria-label={copy.flowMoveUp}
                        disabled={index === 0}
                        onClick={() => movePick(index, -1)}
                      >
                        <ChevronUp className="size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 rounded-full"
                        aria-label={copy.flowMoveDown}
                        disabled={index === picks.length - 1}
                        onClick={() => movePick(index, 1)}
                      >
                        <ChevronDown className="size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 rounded-full text-danger"
                        aria-label={copy.flowRemove}
                        onClick={() => togglePick(item)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <Notice role="status">{copy.flowManualNeedPicks}</Notice>
          )}

          {loadingPlaces ? (
            <div className="grid place-items-center gap-2 py-10 text-text-muted">
              <Loader2 className="size-6 animate-spin" aria-hidden />
            </div>
          ) : placeOptions.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {placeOptions.map((item) => {
                const added = pickedSlugs.has(item.slug);
                return (
                  <div
                    key={item.slug}
                    className={cn(
                      "grid overflow-hidden rounded-card border bg-surface-raised shadow-sm transition-colors",
                      added ? "border-brand" : "border-border-subtle",
                    )}
                  >
                    <span className="relative block aspect-[16/10] overflow-hidden">
                      <CatalogImage src={item.image} alt={item.imageAlt} />
                    </span>
                    <div className="grid gap-2 p-4">
                      <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
                        <MapPin className="size-3.5" aria-hidden />
                        {item.placeLabel}
                      </span>
                      <span className="title-card text-[1.1rem] leading-snug">{item.title}</span>
                      <span className="line-clamp-2 text-sm text-text-muted">{item.summary}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant={added ? "outline" : "default"}
                        className="mt-1 w-fit"
                        onClick={() => togglePick(item)}
                      >
                        {added ? (
                          <>
                            <Check aria-hidden />
                            {copy.flowPickAdded}
                          </>
                        ) : (
                          <>
                            <Plus aria-hidden />
                            {copy.flowPickAdd}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Notice role="status">{copy.flowPickEmpty}</Notice>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="ghost" onClick={() => setStep("destination")}>
              <ChevronLeft className="rtl:-scale-x-100" aria-hidden />
              {copy.flowBack}
            </Button>
            <Button type="button" size="lg" disabled={!picks.length} onClick={() => setStep("details")}>
              {copy.flowContinue}
            </Button>
          </div>
        </section>
      ) : null}

      {step === "details" && !initialTripId ? (
        <section aria-labelledby="pf-details" className="grid max-w-2xl gap-6">
          <div className="grid gap-2">
            <h2 id="pf-details" className="title-section">
              {copy.flowDetailsTitle}
            </h2>
            <p className="text-text-muted">{copy.flowDetailsHint}</p>
          </div>
          {selectedDestination ? (
            <p className="inline-flex w-fit items-center gap-2 rounded-control bg-surface-sunken px-3.5 py-2.5 text-sm">
              <MapPin className="size-4 text-accent-strong" aria-hidden />
              <span className="font-medium">{selectedDestination.name}</span>
              {mode === "manual" ? (
                <span className="text-text-muted">· {interpolate(copy.flowSelectedCount, { n: picks.length })}</span>
              ) : null}
            </p>
          ) : null}
          <div className="grid gap-5 rounded-card border border-border-subtle bg-surface-raised p-6 shadow-sm md:p-7">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4" aria-hidden />
                  {copy.flowDateLabel}
                </span>
                <Input type="date" value={date} min={tomorrowIso()} onChange={(event) => setDate(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4" aria-hidden />
                  {copy.flowPartyLabel}
                </span>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={party}
                  onChange={(event) => setParty(Math.min(20, Math.max(1, Number(event.target.value) || 1)))}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <Wallet className="size-4" aria-hidden />
                  {copy.flowBudgetLabel}
                </span>
                <Input
                  type="number"
                  min={0}
                  step={10}
                  value={budget}
                  onChange={(event) => setBudget(Math.max(0, Number(event.target.value) || 0))}
                />
              </label>
              <label className="flex items-center gap-2.5 self-end pb-2.5 text-sm">
                <input type="checkbox" checked={strict} onChange={(event) => setStrict(event.target.checked)} />
                {copy.flowStrictLabel}
              </label>
            </div>
            {mode === "ai" ? (
              <div className="grid gap-2">
                <Label htmlFor="pf-vibe">{copy.flowVibeLabel}</Label>
                <Textarea
                  id="pf-vibe"
                  rows={3}
                  value={vibe}
                  placeholder={copy.flowVibePlaceholder}
                  onChange={(event) => setVibe(event.target.value)}
                />
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => (mode === "manual" ? setStep("places") : setStep("destination"))}
            >
              <ChevronLeft className="rtl:-scale-x-100" aria-hidden />
              {copy.flowBack}
            </Button>
            {mode === "ai" ? (
              <Button type="button" size="lg" disabled={pending} onClick={() => void generate()}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
                {pending ? copy.flowGenerating : copy.flowGenerate}
              </Button>
            ) : (
              <Button type="button" size="lg" disabled={pending || !picks.length} onClick={() => void saveManual()}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                {pending ? copy.flowSaving : copy.flowSave}
              </Button>
            )}
          </div>
        </section>
      ) : null}

      {step === "review" ? (
        <section aria-labelledby="pf-review" className="grid gap-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-2">
              <h2 id="pf-review" className="title-section">
                {copy.flowReviewTitle}
              </h2>
              <p className="max-w-2xl text-text-muted">
                {sessionId
                  ? copy.flowReviewHint
                  : initialTripId
                    ? copy.savedPlanNote
                    : mode === "manual"
                      ? copy.flowManualReviewHint
                      : copy.flowReviewHint}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {plan && mode === "manual" && !initialTripId ? (
                <Button type="button" variant="outline" onClick={() => setStep("places")}>
                  <Pencil aria-hidden />
                  {copy.flowAddMore}
                </Button>
              ) : null}
              {plan && mode === "ai" ? (
                <Button type="button" variant="outline" disabled={pending} onClick={() => void editManually()}>
                  <Pencil aria-hidden />
                  {copy.flowEditManual}
                </Button>
              ) : null}
              {!initialTripId ? (
                <Button type="button" variant="outline" onClick={startOver}>
                  <RefreshCw aria-hidden />
                  {copy.flowStartOver}
                </Button>
              ) : null}
            </div>
          </div>

          {pending && !plan ? (
            <div className="grid place-items-center gap-3 rounded-card border border-border-subtle bg-surface-raised p-12 text-center">
              <Loader2 className="size-8 animate-spin text-brand" aria-hidden />
              <p className="font-medium">{mode === "manual" ? copy.flowSaving : copy.flowGenerating}</p>
            </div>
          ) : null}

          {plan ? (
            <>
              <Timeline plan={plan} copy={copy} sessionId={sessionId} onLock={run} onReplace={setReplaceStopId} />
              <CostPanel plan={plan} copy={copy} />

              {sessionId ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => void run(() => regeneratePlannerSession(sessionId))}
                  >
                    <RefreshCw aria-hidden />
                    {pending ? copy.flowRegenerating : copy.regenerate}
                  </Button>
                </div>
              ) : null}

              {replaceStopId && sessionId ? (
                <ReplacePanel
                  sessionId={sessionId}
                  stopId={replaceStopId}
                  copy={copy}
                  alts={alts}
                  preview={preview}
                  onAlts={setAlts}
                  onPreview={setPreview}
                  onClose={() => {
                    setReplaceStopId(null);
                    setPreview(null);
                    setAlts([]);
                  }}
                  onAccept={(id) => void run(() => acceptReplacement(sessionId, id))}
                  onCancel={() => void cancelReplacement(sessionId).then(() => setPreview(null))}
                />
              ) : null}

              {sessionId ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{copy.refine}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <Textarea value={refine} onChange={(event) => setRefine(event.target.value)} rows={3} />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={pending || !refine.trim()}
                        onClick={() =>
                          void run(() => refinePlannerSession(sessionId, refine, true)).then(() => setRefine(""))
                        }
                      >
                        <Wand2 aria-hidden />
                        {copy.apply}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {versions.length ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{copy.versions}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="grid gap-2 text-sm">
                      {versions.map((item) => (
                        <li
                          key={item.version}
                          className="flex items-center justify-between gap-3 rounded-control bg-surface-sunken px-3.5 py-2.5"
                        >
                          <span className="font-medium">
                            v{item.version} · {item.origin}
                          </span>
                          {item.sealed_at ? <Badge variant="secondary">{copy.sealed}</Badge> : null}
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              ) : null}

              <details className="group rounded-card border border-border-subtle bg-surface-raised">
                <summary
                  className={cn(
                    "flex cursor-pointer list-none items-center justify-between gap-3 p-5 font-medium",
                    focusRing,
                  )}
                >
                  <span className="grid gap-1">
                    <span className="title-card text-[1.15rem]">{copy.flowAdvancedTitle}</span>
                    <span className="text-sm font-normal text-text-muted">{copy.flowAdvancedHint}</span>
                  </span>
                  <ChevronDown className="size-5 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="grid gap-8 border-t border-border-subtle p-5 md:p-6">
                  {plan.trip_id ? (
                    <Button asChild variant="outline" className="w-fit">
                      <LocaleLink href={`/trips/${plan.trip_id}`}>
                        <Users aria-hidden />
                        {copy.flowOpenGroup}
                      </LocaleLink>
                    </Button>
                  ) : null}
                  <PlanWorkspace />
                </div>
              </details>
            </>
          ) : !pending && initialTripId ? (
            <Notice role="status">{copy.noSavedPlan}</Notice>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
