import { apiRequest } from "@/lib/api/client";

export const GROUP_POLL_MS = 4000;

export type GroupRole = "owner" | "edit" | "vote" | "view";

export type GroupTrip = {
  id: string;
  title: string;
  status: string;
  role: GroupRole | string;
  locked_at?: string | null;
  locked_by?: string | null;
  locked_by_name?: string | null;
  can_share?: boolean;
  can_vote?: boolean;
  can_edit?: boolean;
  can_lock?: boolean;
};

export type ShareLink = {
  id: string;
  role: string;
  allow_guest: boolean;
  expires_at?: string | null;
  revoked_at?: string | null;
  token?: string;
  join_path?: string;
};

export type GroupParticipant = {
  kind: string;
  user_id?: string | null;
  guest_id?: string | null;
  display_name: string;
  role: string;
  joined_at?: string;
};

export type VoteTally = {
  trip_id: string;
  status: string;
  locked_at?: string | null;
  locked_by_name?: string | null;
  polled?: boolean;
  items: {
    experience_id?: string | null;
    term_id?: string | null;
    kind: string;
    label: string;
    yes: number;
    no: number;
    abstain: number;
  }[];
};

export type GroupSummary = {
  sources: string[];
  agreement: { label: string; yes: number; no: number }[];
  disagreement: { label: string; yes: number; no: number }[];
  tradeoffs: { note?: string; keep?: { label: string }[]; drop?: { label: string }[] }[];
  shared_preferences: { user_id: string; preferences: Record<string, unknown> }[];
};

const request = apiRequest;

export type GroupItinerary = {
  trip_id: string;
  trip_title: string;
  trip_status?: string;
  version_id: string | null;
  version?: number;
  origin?: string;
  sealed_at?: string | null;
  window_start?: string;
  return_by?: string;
  party_size?: number;
  budget_minor?: number;
  currency?: string;
  stops: import("@/lib/planner").PlanStop[];
  legs: import("@/lib/planner").PlanLeg[];
  total_minor: number;
};

export function fetchGroupItinerary(tripId: string) {
  return request<GroupItinerary>(`/api/v1/groups/trips/${tripId}/itinerary`);
}

export function fetchGroupTrip(tripId: string) {
  return request<GroupTrip>(`/api/v1/groups/trips/${tripId}`);
}

export function fetchParticipants(tripId: string) {
  return request<{ items: GroupParticipant[] }>(`/api/v1/groups/trips/${tripId}/participants`);
}

export function createShareLink(tripId: string, role: string, allowGuest: boolean) {
  return request<ShareLink>(`/api/v1/groups/trips/${tripId}/share-links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, allow_guest: allowGuest }),
  });
}

export function fetchShareLinks(tripId: string) {
  return request<ShareLink[]>(`/api/v1/groups/trips/${tripId}/share-links`);
}

export function revokeShareLink(linkId: string) {
  return request<ShareLink>(`/api/v1/groups/share-links/${linkId}/revoke`, { method: "POST" });
}

export function peekJoin(token: string) {
  return request<{
    trip_id: string;
    title: string;
    role: string;
    allow_guest: boolean;
    joinable: boolean;
    expired: boolean;
    revoked: boolean;
  }>(`/api/v1/groups/join/${token}`);
}

export function joinShare(token: string, displayName: string) {
  return request<{ trip_id: string; role: string; actor: string }>(`/api/v1/groups/join/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: displayName }),
  });
}

export function fetchSuggestions(tripId: string) {
  return request<
    {
      id: string;
      experience_id?: string | null;
      term_id?: string | null;
      kind: string;
      experience_title?: string | null;
      term_label?: string | null;
    }[]
  >(`/api/v1/groups/trips/${tripId}/suggestions`);
}

export function addSuggestion(tripId: string, input: { experience_id?: string; term_id?: string }) {
  return request(`/api/v1/groups/trips/${tripId}/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function castVote(tripId: string, input: { experience_id?: string; term_id?: string; value: number }) {
  return request<VoteTally>(`/api/v1/groups/trips/${tripId}/votes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function fetchTally(tripId: string) {
  return request<VoteTally>(`/api/v1/groups/trips/${tripId}/tally`);
}

export function lockTrip(tripId: string) {
  return request<{ status: string; locked_at: string; locked_by_name?: string }>(
    `/api/v1/groups/trips/${tripId}/lock`,
    { method: "POST" },
  );
}

export function fetchSummary(tripId: string) {
  return request<GroupSummary>(`/api/v1/groups/trips/${tripId}/summary`);
}

export function summaryLeaksSecret(summary: GroupSummary, secret: string): boolean {
  return JSON.stringify(summary).includes(secret);
}
