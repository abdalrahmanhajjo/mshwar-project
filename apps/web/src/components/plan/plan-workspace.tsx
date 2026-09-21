"use client";

import * as React from "react";
import { CloudRain, Lock, MapPin, Route } from "lucide-react";
import { ArrowLink } from "@/components/ui/arrow-link";
import { Notice } from "@/components/ui/notice";
import { SectionHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StartLocationPicker } from "@/components/plan/start-location-picker";
import { WeatherWarningList } from "@/components/plan/weather-warning";
import { ReplanDiff } from "@/components/plan/replan-diff";
import { usePlannerCopy } from "@/lib/planner-copy";
import {
  evaluatePlanWarnings,
  optimizePlan,
  replanPlan,
  samplePlan,
  type OptimizeResult,
  type ReplanResult,
  type StartLocation,
  type WarningResult,
} from "@/lib/planner";
import { fetchProfile } from "@/lib/profile";
import { LEBANON } from "@/lib/geo";

const FALLBACK_START: StartLocation = {
  lat: LEBANON.beirut.lat,
  lng: LEBANON.beirut.lng,
  label: "Beirut",
  source: "manual",
};

export function PlanWorkspace() {
  const copy = usePlannerCopy();
  const [start, setStart] = React.useState<StartLocation>(FALLBACK_START);
  const [optimized, setOptimized] = React.useState<OptimizeResult | null>(null);
  const [warnings, setWarnings] = React.useState<WarningResult | null>(null);
  const [replan, setReplan] = React.useState<ReplanResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void fetchProfile()
      .then((profile) => {
        const saved = profile.preferences.start_location as StartLocation | null | undefined;
        if (saved?.label) {
          setStart(saved);
        }
      })
      .catch(() => undefined);
  }, []);

  const plan = samplePlan(start);

  async function onOptimize() {
    setError(null);
    try {
      const result = await optimizePlan(plan);
      setOptimized(result);
      const nextWarnings = await evaluatePlanWarnings(plan.stops);
      setWarnings(nextWarnings);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.infeasible);
    }
  }

  async function onReplan() {
    setError(null);
    try {
      const result = await replanPlan(plan, ["hike"]);
      setReplan(result);
      if (!result.applied) {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.replanNone);
    }
  }

  return (
    <section aria-labelledby="fine-tune-heading" className="grid gap-8 border-t border-border-subtle pt-12">
      <SectionHeader
        id="fine-tune-heading"
        eyebrow={copy.routeStart}
        title={copy.fineTune}
        action={
          <ArrowLink href="/plan/start" className="font-medium">
            {copy.startTitle}
          </ArrowLink>
        }
      />
      <p className="-mt-4 max-w-2xl text-text-muted">{copy.fineTuneBody}</p>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr] xl:items-start">
        <StartLocationPicker initial={start} onSaved={setStart} />
        <section className="grid gap-5 rounded-card border border-border-subtle bg-surface-raised p-6 shadow-sm md:p-7">
          <header className="grid gap-2">
            <h3 className="title-card">{copy.planTitle}</h3>
            <p className="text-sm leading-relaxed text-text-muted">{copy.planHint}</p>
          </header>
          <p className="inline-flex items-center gap-2 rounded-control bg-surface-sunken px-3.5 py-2.5 text-sm">
            <MapPin className="size-4 shrink-0 text-accent-strong" aria-hidden />
            <span className="font-medium">{start.label}</span>
            <span className="text-text-muted tabular-nums" dir="ltr">
              ({start.lat.toFixed(4)}, {start.lng.toFixed(4)})
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void onOptimize()}>
              <Route aria-hidden />
              {copy.optimize}
            </Button>
            <Button type="button" variant="outline" onClick={() => void onReplan()}>
              <CloudRain aria-hidden />
              {copy.replanAffected}
            </Button>
          </div>
          {optimized && !optimized.feasible ? <Notice tone="danger">{copy.infeasible}</Notice> : null}
          {optimized && !optimized.metrics_available ? (
            <p role="status" className="text-sm text-danger">
              {copy.metricsUnavailable}
            </p>
          ) : null}
          {optimized?.ordered_stops.length ? (
            <ol className="grid gap-2 text-sm">
              {optimized.ordered_stops.map((stop) => (
                <li
                  key={stop.id}
                  className="flex items-center gap-3 rounded-control border border-border-subtle px-3 py-2.5"
                >
                  <span className="grid size-7 place-items-center rounded-full bg-brand-subtle text-xs font-semibold tabular-nums">
                    {stop.position}
                  </span>
                  <span className="font-medium">{stop.label}</span>
                  {stop.locked ? (
                    <span className="ms-auto inline-flex items-center text-text-muted">
                      <Lock className="size-4" aria-hidden />
                      <span className="sr-only">{copy.lock}</span>
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}
          <WeatherWarningList result={warnings} />
          <ReplanDiff result={replan} />
          {error ? (
            <p role="status" className="text-sm text-text-muted">
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </section>
  );
}
