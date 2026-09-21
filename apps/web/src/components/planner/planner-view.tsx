"use client";

import * as React from "react";
import {
  CalendarDays,
  Car,
  Clock,
  Loader2,
  Lock,
  LockOpen,
  MapPin,
  MessageCircleQuestion,
  RefreshCw,
  Replace,
  Route,
  Sparkles,
  Users,
  Wallet,
  Wand2,
} from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { LocaleLink } from "@/components/shell/locale-link";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/components/shell/locale-provider";
import {
  acceptReplacement,
  cancelReplacement,
  clarifyPlannerSession,
  createPlannerSession,
  fetchAlternatives,
  fetchTripVersions,
  fetchVersion,
  formatMinor,
  lockPlannerStop,
  previewReplacement,
  refinePlannerSession,
  regeneratePlannerSession,
  type PlanDocument,
  type PlannerSession,
} from "@/lib/planner";
import { useHubCopy } from "@/lib/hub-copy";
import { ApiError } from "@/lib/api/client";
import { type PlannerCopy, usePlannerCopy } from "@/lib/planner-copy";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import { DESTINATIONS, getExperience } from "@/lib/catalog";
import { splitSentence } from "@/lib/text";
import { cn, focusRing } from "@/lib/utils";

export function priceKindLabel(kind: string, copy: ReturnType<typeof usePlannerCopy>) {
  if (kind === "quote") {
    return copy.quote;
  }
  if (kind === "fixed") {
    return copy.fromPrice;
  }
  return copy.estimated;
}

/** Limit errors get the traveller's language; anything else keeps the API's message. */
export function plannerErrorMessage(
  caught: unknown,
  copy: Pick<PlannerCopy, "aiQuotaExceeded" | "aiCapacityReached" | "rateLimited" | "updateError">,
): string {
  if (caught instanceof ApiError) {
    if (caught.code === "ai_quota_exceeded") return copy.aiQuotaExceeded;
    if (caught.code === "ai_capacity_reached") return copy.aiCapacityReached;
    if (caught.code === "rate_limited") return copy.rateLimited;
  }
  return caught instanceof Error ? caught.message : copy.updateError;
}

export function PlannerView({ initialTripId }: { initialTripId?: string }) {
  const copy = usePlannerCopy();
  const { locale } = useLocale();
  const [text, setText] = React.useState("");
  const [answer, setAnswer] = React.useState("");
  const [refine, setRefine] = React.useState("");
  const [session, setSession] = React.useState<PlannerSession | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
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
  const [interpretation, setInterpretation] = React.useState<string | null>(null);
  const [versions, setVersions] = React.useState<{ version: number; origin: string; sealed_at: string | null }[]>([]);
  const [replaceStopId, setReplaceStopId] = React.useState<string | null>(null);
  const [tripChecked, setTripChecked] = React.useState(false);

  async function run(task: () => Promise<PlannerSession>) {
    setPending(true);
    setError(null);
    try {
      const next = await task();
      setSession(next);
      if (next.plan?.trip_id) {
        const history = await fetchTripVersions(next.plan.trip_id);
        setVersions(history);
      }
    } catch (caught) {
      setError(plannerErrorMessage(caught, copy));
    } finally {
      setPending(false);
    }
  }

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
      })
      .finally(() => {
        if (!cancelled) {
          setTripChecked(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialTripId, copy]);

  const plan = session?.plan ?? null;
  const suggestions = [copy.suggestion1, copy.suggestion2, copy.suggestion3];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-start lg:gap-12">
      <div className="grid gap-6 lg:sticky lg:top-24">
        <section
          aria-labelledby="planner-heading"
          className="grid gap-6 rounded-card border border-border-subtle bg-surface-raised p-6 shadow-sm md:p-7"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full border border-border-subtle text-sm font-medium tabular-nums">
              01
            </span>
            <h2 id="planner-heading" className="title-card text-[1.55rem]">
              {copy.title}
            </h2>
          </div>
          {session?.degraded ? (
            <Notice tone="warning" role="status">
              {session.degraded_message || copy.degraded}
            </Notice>
          ) : null}
          <div className="grid gap-2.5">
            <Label htmlFor="planner-intent">{copy.moodLabel}</Label>
            <Textarea
              id="planner-intent"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={copy.placeholder}
              rows={5}
              className="text-[0.9375rem]"
            />
            <div role="group" className="flex flex-wrap gap-2 pt-1" aria-label={copy.suggestionsLabel}>
              {suggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setText(item)}
                  className={cn(
                    "rounded-pill border border-border-subtle bg-surface px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-brand/40 hover:text-text",
                    focusRing,
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={pending || text.trim().length < 2}
            onClick={() =>
              void run(() =>
                createPlannerSession({
                  text,
                  locale,
                  session_id: session?.session_id,
                }),
              )
            }
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
            {copy.build}
          </Button>
          {session?.clarifications?.length ? (
            <div className="grid gap-3 rounded-control border border-accent/30 bg-accent-subtle/60 p-4">
              {session.clarifications.map((item) => (
                <p key={item.field} className="flex items-start gap-2 text-sm font-medium">
                  <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden />
                  {item.prompt}
                </p>
              ))}
              <Input value={answer} onChange={(event) => setAnswer(event.target.value)} aria-label={copy.clarify} />
              <Button
                type="button"
                variant="default"
                disabled={pending || !session.session_id}
                onClick={() =>
                  void run(() =>
                    clarifyPlannerSession(session.session_id, {
                      text,
                      locale,
                      answers: { intent_anchor: answer },
                    }),
                  )
                }
              >
                {copy.clarify}
              </Button>
            </div>
          ) : null}
          {error ? (
            <Notice tone="danger" role="alert">
              {error}
            </Notice>
          ) : null}
          <p className="text-xs leading-relaxed text-text-muted">{copy.body}</p>
        </section>

        {session?.assumed_defaults?.length ? (
          <section className="grid gap-3 rounded-card border border-border-subtle bg-surface-sunken/60 p-5">
            <h3 className="text-sm font-semibold">{copy.assumptions}</h3>
            <ul className="flex flex-wrap gap-2 text-sm">
              {session.assumed_defaults.map((item) => (
                <li key={item.field} className="rounded-pill bg-surface-raised px-3 py-1 text-text-muted shadow-sm">
                  {item.label}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-6">
        {session?.budget_warning ? (
          <Notice tone="warning" role="status">
            {session.budget_warning}
          </Notice>
        ) : null}

        {session?.forced_lock_changes?.length ? (
          <Notice role="status">{session.forced_lock_changes.join(" ")}</Notice>
        ) : null}

        {plan && initialTripId && !session?.session_id ? <Notice role="status">{copy.savedPlanNote}</Notice> : null}
        {!plan && initialTripId && tripChecked ? <Notice role="status">{copy.noSavedPlan}</Notice> : null}

        {plan ? (
          <Timeline plan={plan} copy={copy} sessionId={session?.session_id} onLock={run} onReplace={setReplaceStopId} />
        ) : (
          <EmptyPlan copy={copy} pending={pending} />
        )}
        {plan ? <CostPanel plan={plan} copy={copy} /> : null}

        {plan && session?.session_id ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => void run(() => regeneratePlannerSession(session.session_id))}
            >
              <RefreshCw aria-hidden />
              {copy.regenerate}
            </Button>
          </div>
        ) : null}

        {replaceStopId && session?.session_id ? (
          <ReplacePanel
            sessionId={session.session_id}
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
            onAccept={(id) => void run(() => acceptReplacement(session.session_id, id))}
            onCancel={() => void cancelReplacement(session.session_id).then(() => setPreview(null))}
          />
        ) : null}

        {session?.session_id ? (
          <Card>
            <CardHeader>
              <CardTitle>{copy.refine}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Textarea value={refine} onChange={(event) => setRefine(event.target.value)} rows={3} />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => {
                    void refinePlannerSession(session.session_id, refine, false).then((result) => {
                      setInterpretation(result.summary || result.clarification || null);
                    });
                  }}
                >
                  <Wand2 aria-hidden />
                  {copy.refine}
                </Button>
                {interpretation && !interpretation.toLowerCase().includes("could not") ? (
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() => void run(() => refinePlannerSession(session.session_id, refine, true))}
                  >
                    {copy.apply}
                  </Button>
                ) : null}
              </div>
              {interpretation ? <Notice>{interpretation}</Notice> : null}
            </CardContent>
          </Card>
        ) : null}

        {versions.length ? (
          <Card>
            <CardHeader>
              <CardTitle>{copy.versions}</CardTitle>
              {initialTripId ? (
                <CardDescription>{interpolate(copy.tripLabel, { id: initialTripId })}</CardDescription>
              ) : null}
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
      </div>
    </div>
  );
}

function EmptyPlan({ copy, pending }: { copy: ReturnType<typeof usePlannerCopy>; pending: boolean }) {
  const [lead, tail] = splitSentence(copy.emptyTitle);
  return (
    <section aria-label={copy.emptyHeading} className="grid gap-5">
      <div className="grid gap-3">
        <p className="eyebrow">{copy.emptyKicker}</p>
        <p className="title-section">{copy.emptyHeading}</p>
      </div>
      <div className="relative isolate grid min-h-[26rem] place-items-center overflow-hidden rounded-[1.5rem] bg-brand p-8 text-center text-white md:min-h-[32rem]">
        <CatalogImage src={DESTINATIONS[1].image} alt="" className="absolute inset-0 -z-10" />
        <div className="photo-tint-strong absolute inset-0 -z-10" />
        <div className="grid max-w-md justify-items-center gap-4">
          <span className="grid size-12 place-items-center rounded-full bg-white/15 backdrop-blur">
            {pending ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Route className="size-5" aria-hidden />
            )}
          </span>
          <p className="title-section text-balance">
            {lead}
            {tail ? <span className="block">{tail}</span> : null}
          </p>
          <p className="text-sm text-white/80">{copy.emptyBody}</p>
        </div>
      </div>
      <p className="text-xs text-text-muted">{copy.previewNote}</p>
    </section>
  );
}

export function Timeline({
  plan,
  copy,
  sessionId,
  onLock,
  onReplace,
}: {
  plan: PlanDocument;
  copy: ReturnType<typeof usePlannerCopy>;
  sessionId?: string;
  onLock: (task: () => Promise<PlannerSession>) => Promise<void>;
  onReplace: (stopId: string) => void;
}) {
  const { locale } = useLocale();
  const hub = useHubCopy();
  const legsByPosition = new Map(plan.legs.map((leg) => [leg.position, leg]));
  const time = (value: string) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <section aria-labelledby="timeline-heading" className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-3">
          <p className="eyebrow">{copy.takingShape}</p>
          <h2 id="timeline-heading" className="title-section">
            {plan.trip_title}
          </h2>
        </div>
        <Badge variant="secondary" className="text-sm">
          {plan.stops.length} {copy.stopsLabel}
        </Badge>
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-muted">
        <li className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-4" aria-hidden />
          {formatDate(locale, plan.window_start)}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <Users className="size-4" aria-hidden />
          {plan.party_size} {copy.partyLabel}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <Wallet className="size-4" aria-hidden />
          {formatMinor(plan.total_minor, plan.currency)} {copy.estimated.toLowerCase()}
        </li>
      </ul>
      <Notice>{copy.editableNote}</Notice>
      <ol className="relative grid gap-4" aria-label={copy.timeline}>
        {plan.stops.map((stop, index) => {
          const leg = legsByPosition.get(index);
          const slug = stop.snapshot.slug ?? stop.slug;
          const listing = slug ? getExperience(slug) : undefined;
          const imageSrc = stop.image || listing?.image || "";
          const imageAlt = stop.image_alt || listing?.imageAlt || stop.snapshot.title || stop.title || "";
          const detailHref = slug ? `/experiences/${slug}` : undefined;
          return (
            <li key={stop.id} className="grid gap-3">
              {leg ? (
                <p className="inline-flex items-center gap-2 ps-14 text-xs font-medium uppercase tracking-[0.14em] text-text-muted">
                  <Car className="size-3.5" aria-hidden />
                  {copy.travel} · {Math.round((leg.duration_seconds || 0) / 60)} min · {leg.provider}
                </p>
              ) : null}
              <div className="grid grid-cols-[2.5rem_1fr] gap-4">
                <div className="flex flex-col items-center">
                  <span className="grid size-10 place-items-center rounded-full border border-border-subtle bg-surface-raised text-sm font-medium tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {index < plan.stops.length - 1 ? (
                    <span className="mt-2 w-px flex-1 bg-border-subtle" aria-hidden />
                  ) : null}
                </div>
                <article
                  className={cn(
                    "grid gap-4 rounded-card border bg-surface-raised p-4 shadow-sm sm:grid-cols-[7rem_1fr_auto] sm:items-center md:p-5",
                    stop.locked ? "border-brand/50" : "border-border-subtle",
                  )}
                >
                  <div className="aspect-[4/3] overflow-hidden rounded-[0.9rem] bg-brand-subtle sm:aspect-square">
                    {imageSrc ? (
                      detailHref ? (
                        <LocaleLink href={detailHref} target="_blank" rel="noopener" aria-label={imageAlt}>
                          <CatalogImage src={imageSrc} alt={imageAlt} />
                        </LocaleLink>
                      ) : (
                        <CatalogImage src={imageSrc} alt={imageAlt} />
                      )
                    ) : (
                      <div className="grid h-full place-items-center text-text-muted">
                        <MapPin className="size-6" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="grid min-w-0 gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {stop.snapshot.sponsored ? (
                        <Badge variant="accent">{stop.snapshot.sponsored_label || copy.sponsored}</Badge>
                      ) : null}
                      <Badge variant="outline">{priceKindLabel(stop.price_kind, copy)}</Badge>
                      {stop.locked ? (
                        <Badge variant="secondary">
                          <Lock className="size-3" aria-hidden />
                          {hub.locked}
                        </Badge>
                      ) : null}
                    </div>
                    <h3 className="title-card text-[1.3rem]">
                      {detailHref ? (
                        <LocaleLink
                          href={detailHref}
                          target="_blank"
                          rel="noopener"
                          className="transition-colors hover:text-brand"
                        >
                          {stop.snapshot.title || stop.title}
                        </LocaleLink>
                      ) : (
                        stop.snapshot.title || stop.title
                      )}
                    </h3>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5" aria-hidden />
                        {time(stop.starts_at)} – {time(stop.ends_at)}
                      </span>
                      <span className="font-medium text-text">{formatMinor(stop.estimated_minor, plan.currency)}</span>
                      <span>
                        {copy.booking}: {stop.booking_mode || "request"}
                      </span>
                    </p>
                    {stop.snapshot.explanation ? (
                      <p className="text-sm text-text-muted">
                        <span className="font-medium text-text">{copy.why}:</span> {stop.snapshot.explanation}
                      </p>
                    ) : null}
                  </div>
                  {sessionId ? (
                    <div className="flex gap-1 sm:flex-col">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="rounded-full"
                        aria-pressed={stop.locked}
                        aria-label={stop.locked ? copy.unlock : copy.lock}
                        title={stop.locked ? copy.unlock : copy.lock}
                        onClick={() => void onLock(() => lockPlannerStop(sessionId, stop.id, !stop.locked))}
                      >
                        {stop.locked ? <Lock aria-hidden /> : <LockOpen aria-hidden />}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="rounded-full"
                        aria-label={copy.replace}
                        title={copy.replace}
                        onClick={() => onReplace(stop.id)}
                      >
                        <Replace aria-hidden />
                      </Button>
                    </div>
                  ) : null}
                </article>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function CostPanel({ plan, copy }: { plan: PlanDocument; copy: ReturnType<typeof usePlannerCopy> }) {
  return (
    <section
      aria-labelledby="cost-heading"
      className="grid gap-5 rounded-card border border-border-subtle bg-surface-raised p-6 shadow-sm md:p-7"
    >
      <h3 id="cost-heading" className="title-card">
        {copy.cost}
      </h3>
      <dl className="grid gap-2.5 text-sm">
        {plan.stops.map((stop) => (
          <div key={stop.id} className="flex justify-between gap-3">
            <dt className="text-text-muted">
              {stop.snapshot.title || stop.title} · {priceKindLabel(stop.price_kind, copy)}
              {stop.snapshot.price_source ? ` · ${stop.snapshot.price_source}` : ""}
            </dt>
            <dd className="tabular-nums">{formatMinor(stop.estimated_minor, plan.currency)}</dd>
          </div>
        ))}
        {plan.cost_items.map((item) => (
          <div key={item.label} className="flex justify-between gap-3">
            <dt className="text-text-muted">{item.label}</dt>
            <dd className="tabular-nums">{formatMinor(item.amount_minor, plan.currency)}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border-subtle pt-5">
        <div className="grid gap-1">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
            {copy.estimateLabel}
          </p>
          <p className="flex flex-wrap items-baseline gap-2">
            <span className="text-[2.2rem] font-semibold leading-none tracking-[-0.03em] tabular-nums">
              {formatMinor(plan.total_minor, plan.currency)}
            </span>
            {plan.budget_minor ? (
              <span className="text-sm text-text-muted">
                {interpolate(copy.ofBudget, { budget: formatMinor(plan.budget_minor, plan.currency) })}
              </span>
            ) : null}
          </p>
        </div>
        <p className="text-sm font-semibold">{copy.total}</p>
      </div>
    </section>
  );
}

export function ReplacePanel({
  sessionId,
  stopId,
  copy,
  alts,
  preview,
  onAlts,
  onPreview,
  onClose,
  onAccept,
  onCancel,
}: {
  sessionId: string;
  stopId: string;
  copy: ReturnType<typeof usePlannerCopy>;
  alts: { experience_id: string; title: string; why_fit: string[]; sponsored: boolean }[];
  preview: {
    preview_id: string;
    title: string;
    delta_cost_minor: number;
    delta_minutes: number;
    why_fit: string[];
  } | null;
  onAlts: (rows: { experience_id: string; title: string; why_fit: string[]; sponsored: boolean }[]) => void;
  onPreview: (row: {
    preview_id: string;
    title: string;
    delta_cost_minor: number;
    delta_minutes: number;
    why_fit: string[];
  }) => void;
  onClose: () => void;
  onAccept: (previewId: string) => void;
  onCancel: () => void;
}) {
  React.useEffect(() => {
    let current = true;
    void fetchAlternatives(sessionId, stopId)
      .then((found) => current && onAlts(found))
      .catch(() => current && onAlts([]));
    return () => {
      current = false;
    };
  }, [sessionId, stopId, onAlts]);

  return (
    <Card className="border-accent/30">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>{copy.replace}</CardTitle>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {copy.cancel}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        {alts.map((item) => (
          <div
            key={item.experience_id}
            className="flex flex-col gap-3 rounded-control border border-border-subtle p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="grid gap-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{item.title}</p>
                {item.sponsored ? <Badge variant="accent">{copy.sponsored}</Badge> : null}
              </div>
              <p className="text-xs text-text-muted">{item.why_fit.join(" · ")}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                void previewReplacement(sessionId, stopId, item.experience_id).then((row) =>
                  onPreview({
                    preview_id: row.preview_id,
                    title: row.title,
                    delta_cost_minor: row.delta_cost_minor,
                    delta_minutes: row.delta_minutes,
                    why_fit: row.why_fit,
                  }),
                )
              }
            >
              {copy.previewAction}
            </Button>
          </div>
        ))}
        {preview ? (
          <div className="grid gap-3 rounded-control bg-brand-subtle/60 p-4 text-sm">
            <p>
              <span className="font-semibold">{preview.title}</span>: {preview.delta_minutes} min,{" "}
              {formatMinor(preview.delta_cost_minor)}
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => onAccept(preview.preview_id)}>
                {copy.accept}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onCancel}>
                {copy.cancel}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
