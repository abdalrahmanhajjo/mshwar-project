"use client";

import * as React from "react";
import {
  CalendarDays,
  Link2,
  Lock,
  MapPin,
  Printer,
  Route,
  Share2,
  ThumbsDown,
  ThumbsUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { Avatar } from "@/components/shell/auth-status";
import { LocaleLink } from "@/components/shell/locale-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { CostPanel, Timeline } from "@/components/planner/planner-view";
import { cn } from "@/lib/utils";
import { useGroupCopy } from "@/lib/group-copy";
import { usePlannerCopy } from "@/lib/planner-copy";
import { formatMinor, type PlanDocument } from "@/lib/planner";
import {
  GROUP_POLL_MS,
  castVote,
  createShareLink,
  fetchGroupItinerary,
  fetchGroupTrip,
  fetchParticipants,
  fetchShareLinks,
  fetchSummary,
  fetchTally,
  lockTrip,
  revokeShareLink,
  type GroupItinerary,
  type GroupSummary,
  type GroupTrip,
  type ShareLink,
  type VoteTally,
} from "@/lib/groups";

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 rounded-card border border-border-subtle bg-surface-raised p-4">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
        {icon}
        {label}
      </span>
      <span className="title-card text-[1.5rem] tabular-nums">{value}</span>
    </div>
  );
}

function toPlanDocument(itinerary: GroupItinerary | null): PlanDocument | null {
  if (!itinerary || !itinerary.version_id || !itinerary.stops?.length) {
    return null;
  }
  return {
    trip_id: itinerary.trip_id,
    trip_title: itinerary.trip_title,
    version_id: itinerary.version_id,
    version: itinerary.version ?? 1,
    origin: itinerary.origin ?? "",
    sealed_at: itinerary.sealed_at ?? null,
    window_start: itinerary.window_start ?? "",
    return_by: itinerary.return_by ?? "",
    party_size: itinerary.party_size ?? 2,
    budget_minor: itinerary.budget_minor ?? 0,
    currency: itinerary.currency ?? "USD",
    strict_budget: false,
    constraints: {},
    validation: {},
    stops: itinerary.stops,
    legs: itinerary.legs ?? [],
    cost_items: [],
    total_minor: itinerary.total_minor ?? 0,
  };
}

function SummaryChips({
  items,
  titleToSlug,
  tone,
}: {
  items: { label: string }[];
  titleToSlug: Map<string, string>;
  tone: "success" | "danger";
}) {
  if (!items.length) {
    return <p className="text-text-muted">—</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const slug = titleToSlug.get(item.label);
        const chip = cn(
          "inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-medium",
          tone === "success" ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
        );
        return slug ? (
          <LocaleLink key={item.label} href={`/experiences/${slug}`} target="_blank" rel="noopener" className={chip}>
            {item.label}
          </LocaleLink>
        ) : (
          <span key={item.label} className={chip}>
            {item.label}
          </span>
        );
      })}
    </div>
  );
}

export function GroupTripView({ tripId }: { tripId: string }) {
  const copy = useGroupCopy();
  const plannerCopy = usePlannerCopy();
  const [trip, setTrip] = React.useState<GroupTrip | null>(null);
  const [participants, setParticipants] = React.useState<{ display_name: string; role: string }[]>([]);
  const [itinerary, setItinerary] = React.useState<GroupItinerary | null>(null);
  const [links, setLinks] = React.useState<ShareLink[]>([]);
  const [tally, setTally] = React.useState<VoteTally | null>(null);
  const [summary, setSummary] = React.useState<GroupSummary | null>(null);
  const [role, setRole] = React.useState("vote");
  const [allowGuest, setAllowGuest] = React.useState(true);
  const [createdPath, setCreatedPath] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    const [nextTrip, people, nextTally, nextSummary] = await Promise.all([
      fetchGroupTrip(tripId),
      fetchParticipants(tripId),
      fetchTally(tripId),
      fetchSummary(tripId),
    ]);
    setTrip(nextTrip);
    setParticipants(people.items ?? []);
    setTally(nextTally);
    setSummary(nextSummary);
    if (nextTrip.can_share) {
      setLinks(await fetchShareLinks(tripId));
    }
  }, [tripId]);

  React.useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetchGroupTrip(tripId),
      fetchParticipants(tripId),
      fetchTally(tripId),
      fetchSummary(tripId),
      fetchGroupItinerary(tripId).catch(() => null),
    ])
      .then(async ([nextTrip, people, nextTally, nextSummary, nextItinerary]) => {
        if (cancelled) {
          return;
        }
        setTrip(nextTrip);
        setParticipants(people.items ?? []);
        setTally(nextTally);
        setSummary(nextSummary);
        setItinerary(nextItinerary);
        if (nextTrip.can_share) {
          const nextLinks = await fetchShareLinks(tripId);
          if (!cancelled) {
            setLinks(nextLinks);
          }
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      });
    const timer = window.setInterval(() => {
      void fetchTally(tripId)
        .then((next) => !cancelled && setTally(next))
        .catch(() => undefined);
      void fetchSummary(tripId)
        .then((next) => !cancelled && setSummary(next))
        .catch(() => undefined);
    }, GROUP_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [tripId]);

  const totalVotes = (item: { yes: number; no: number }) => Math.max(1, item.yes + item.no);
  const planDoc = toPlanDocument(itinerary);
  const titleToSlug = new Map<string, string>();
  for (const stop of itinerary?.stops ?? []) {
    const label = stop.snapshot?.title || stop.title;
    const slug = stop.snapshot?.slug || stop.slug;
    if (label && slug) {
      titleToSlug.set(label, slug);
    }
  }
  const isOwner = trip?.role === "owner";
  const locked = trip?.status === "locked";
  const perPerson =
    planDoc && planDoc.party_size > 0
      ? Math.round(planDoc.total_minor / planDoc.party_size)
      : (planDoc?.total_minor ?? 0);
  const statusLabel = locked ? copy.statusLocked : trip?.status === "archived" ? copy.statusArchived : copy.statusDraft;

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={copy.guideKicker}
        icon={<Users aria-hidden />}
        title={trip?.title ?? copy.guideTitle}
        description={copy.guideBody}
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            {planDoc ? (
              <Button type="button" variant="outline" onClick={() => window.print()}>
                <Printer aria-hidden />
                {copy.printSheet}
              </Button>
            ) : null}
            {isOwner ? (
              <Button asChild variant="outline">
                <LocaleLink href={`/plan?trip=${tripId}`}>
                  <Route aria-hidden />
                  {copy.openPlanner}
                </LocaleLink>
              </Button>
            ) : null}
            {trip?.can_lock ? (
              <Button type="button" onClick={() => void lockTrip(tripId).then(() => reload())}>
                <Lock aria-hidden />
                {copy.finalize}
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}

      {locked ? (
        <Notice tone="success" role="status">
          <span className="inline-flex flex-wrap items-center gap-2">
            <Lock className="size-4" aria-hidden />
            {copy.finalized}
            {trip?.locked_by_name ? ` · ${copy.lockedBy} ${trip.locked_by_name}` : ""}
            {trip?.locked_at ? ` · ${new Date(trip.locked_at).toLocaleString()}` : ""}
          </span>
        </Notice>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={<Users className="size-3.5" aria-hidden />}
          label={copy.headcount}
          value={participants.length}
        />
        <StatTile
          icon={<MapPin className="size-3.5" aria-hidden />}
          label={copy.stopsLabel}
          value={planDoc ? planDoc.stops.length : "—"}
        />
        <StatTile
          icon={<Wallet className="size-3.5" aria-hidden />}
          label={copy.dayTotal}
          value={planDoc ? formatMinor(perPerson, planDoc.currency) : "—"}
        />
        <StatTile
          icon={<CalendarDays className="size-3.5" aria-hidden />}
          label={copy.roleLabel}
          value={<Badge variant={locked ? "warning" : "secondary"}>{statusLabel}</Badge>}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{copy.itinerary}</CardTitle>
              <CardDescription>{copy.itineraryHint}</CardDescription>
            </CardHeader>
            <CardContent>
              {planDoc ? (
                <div className="grid gap-6">
                  <Timeline
                    plan={planDoc}
                    copy={plannerCopy}
                    onLock={async () => undefined}
                    onReplace={() => undefined}
                  />
                  <CostPanel plan={planDoc} copy={plannerCopy} />
                </div>
              ) : (
                <EmptyState
                  icon={<Route aria-hidden />}
                  title={copy.noItinerary}
                  description={copy.noItineraryHint}
                  action={
                    isOwner ? (
                      <Button asChild>
                        <LocaleLink href={`/plan?trip=${tripId}`}>{copy.openPlanner}</LocaleLink>
                      </Button>
                    ) : undefined
                  }
                />
              )}
            </CardContent>
          </Card>

          <Card className="print:hidden">
            <CardHeader>
              <CardTitle as="h2">{copy.voting}</CardTitle>
              <CardDescription>{copy.votingHint}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {(tally?.items ?? []).length ? (
                (tally?.items ?? []).map((item) => {
                  const yesShare = Math.round((item.yes / totalVotes(item)) * 100);
                  return (
                    <div
                      key={`${item.kind}-${item.label}`}
                      className="grid gap-3 rounded-control border border-border-subtle p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                    >
                      <div className="grid gap-2">
                        <p className="font-semibold">{item.label}</p>
                        <div className="h-1.5 overflow-hidden rounded-pill bg-danger-subtle" aria-hidden data-rtl-chart>
                          <div className="h-full rounded-pill bg-success" style={{ width: `${yesShare}%` }} />
                        </div>
                        <p className="text-sm text-text-muted">
                          {copy.yes} {item.yes} · {copy.no} {item.no}
                        </p>
                      </div>
                      {trip?.can_vote ? (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              void castVote(tripId, {
                                experience_id: item.experience_id ?? undefined,
                                term_id: item.term_id ?? undefined,
                                value: 1,
                              }).then(setTally)
                            }
                          >
                            <ThumbsUp aria-hidden />
                            {copy.yes}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void castVote(tripId, {
                                experience_id: item.experience_id ?? undefined,
                                term_id: item.term_id ?? undefined,
                                value: -1,
                              }).then(setTally)
                            }
                          >
                            <ThumbsDown aria-hidden />
                            {copy.no}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-text-muted">{copy.proposeHint}</p>
              )}
            </CardContent>
          </Card>

          <Card className="print:hidden">
            <CardHeader>
              <CardTitle as="h2">{copy.summary}</CardTitle>
              <CardDescription>{copy.summaryHint}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
              <section className="grid content-start gap-2 rounded-control bg-success-subtle/60 p-4">
                <h3 className="font-semibold text-success">{copy.agreement}</h3>
                <SummaryChips items={summary?.agreement ?? []} titleToSlug={titleToSlug} tone="success" />
              </section>
              <section className="grid content-start gap-2 rounded-control bg-danger-subtle/60 p-4">
                <h3 className="font-semibold text-danger">{copy.disagreement}</h3>
                <SummaryChips items={summary?.disagreement ?? []} titleToSlug={titleToSlug} tone="danger" />
              </section>
              <section className="grid content-start gap-2 rounded-control bg-surface-sunken p-4">
                <h3 className="font-semibold">{copy.tradeoffs}</h3>
                <p>{summary?.tradeoffs?.[0]?.note ?? "—"}</p>
              </section>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{copy.travelers}</CardTitle>
              <CardDescription>{copy.travelersHint}</CardDescription>
            </CardHeader>
            <CardContent>
              {participants.length ? (
                <ul className="grid gap-3">
                  {participants.map((person) => (
                    <li key={`${person.display_name}-${person.role}`} className="flex items-center gap-3 text-sm">
                      <Avatar name={person.display_name} className="size-9 text-xs" />
                      <span className="font-medium">{person.display_name}</span>
                      <Badge variant={person.role === "owner" ? "secondary" : "outline"} className="ms-auto">
                        {person.role === "owner" ? copy.guide : person.role}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-muted">{copy.travelersHint}</p>
              )}
            </CardContent>
          </Card>

          {trip?.can_share ? (
            <Card className="print:hidden">
              <CardHeader>
                <CardTitle as="h2">{copy.invite}</CardTitle>
                <CardDescription>{copy.joinHint}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <label className="grid gap-2 text-sm font-medium">
                  {copy.roleLabel}
                  <NativeSelect
                    aria-label={copy.roleLabel}
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                  >
                    <option value="view">view</option>
                    <option value="vote">vote</option>
                    <option value="edit">edit</option>
                  </NativeSelect>
                </label>
                <label className="flex items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={allowGuest}
                    onChange={(event) => setAllowGuest(event.target.checked)}
                  />
                  {copy.allowGuest}
                </label>
                <Button
                  type="button"
                  onClick={() =>
                    void createShareLink(tripId, role, allowGuest)
                      .then((link) => {
                        setCreatedPath(link.join_path ?? null);
                        return reload();
                      })
                      .catch((err: Error) => setError(err.message))
                  }
                >
                  <UserPlus aria-hidden />
                  {copy.createLink}
                </Button>
                {createdPath ? (
                  <p className="flex items-center gap-2 break-all rounded-control bg-surface-sunken px-3.5 py-2.5 font-mono text-xs">
                    <Share2 className="size-3.5 shrink-0" aria-hidden />
                    {createdPath}
                  </p>
                ) : null}
                <ul className="grid gap-2">
                  {links.map((link) => (
                    <li
                      key={link.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border-subtle px-3.5 py-2.5 text-sm"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Link2 className="size-3.5 text-text-muted" aria-hidden />
                        {link.role} {link.allow_guest ? "· guest" : ""} {link.revoked_at ? `· ${copy.revoked}` : ""}
                      </span>
                      {link.revoked_at ? null : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void revokeShareLink(link.id).then(reload)}
                        >
                          Revoke
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function JoinTripView({ token }: { token: string }) {
  const copy = useGroupCopy();
  const [name, setName] = React.useState("Guest");
  const [tripId, setTripId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (tripId) {
    return <GroupTripView tripId={tripId} />;
  }

  return (
    <div className="mx-auto grid w-full max-w-lg gap-6 rounded-[1.75rem] border border-border-subtle bg-surface-raised p-7 shadow-lg md:p-10">
      <span className="grid size-12 place-items-center rounded-full bg-brand-subtle">
        <Users className="size-5" aria-hidden />
      </span>
      <div className="grid gap-2">
        <h1 className="title-page text-[2.4rem]">{copy.join}</h1>
        <p className="text-sm text-text-muted">{copy.joinHint}</p>
      </div>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <label className="grid gap-2 text-sm font-medium">
        {copy.displayName}
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <Button
        type="button"
        size="lg"
        onClick={() =>
          void import("@/lib/groups")
            .then(({ joinShare }) => joinShare(token, name))
            .then((joined) => setTripId(joined.trip_id))
            .catch((err: Error) => setError(err.message))
        }
      >
        {copy.guestJoin}
      </Button>
    </div>
  );
}
