import { apiRequest } from "@/lib/api/client";

export const HUB_PAGE_SIZE = 6;

export type HubPage<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};

export type TripRecord = {
  id: string;
  name: string;
  status: "draft" | "locked" | "archived" | string;
  created_at: string;
  planned_date?: string | null;
  stop_count?: number;
};

export type FavoriteRecord = {
  id: string;
  listing_slug: string;
  created_at: string;
};

export type BookingRecord = {
  id: string;
  listing_slug: string;
  business_id: number | null;
  status: string;
  policy_summary: string;
  reason: string | null;
  created_at: string;
};

export type NotificationRecord = {
  id: string;
  title: string;
  body: string;
  category: string;
  read_at: string | null;
  created_at: string;
  deep_link?: string | null;
  event_type?: string | null;
  locale?: string | null;
};

function listUrl(path: string, page: number, pageSize: number = HUB_PAGE_SIZE): string {
  return `${path}?page=${page}&page_size=${pageSize}`;
}

const request = apiRequest;

export function fetchTrips(page = 1) {
  return request<HubPage<TripRecord>>(listUrl("/api/v1/trips", page));
}

export async function fetchAllTrips(): Promise<HubPage<TripRecord>> {
  // The API caps page_size at 24, so page through until every trip is collected.
  const size = 24;
  const first = await request<HubPage<TripRecord>>(listUrl("/api/v1/trips", 1, size));
  const items = [...first.items];
  const totalPages = Math.min(Math.ceil((first.total || 0) / size), 40);
  for (let pageNumber = 2; pageNumber <= totalPages; pageNumber += 1) {
    const next = await request<HubPage<TripRecord>>(listUrl("/api/v1/trips", pageNumber, size));
    items.push(...next.items);
  }
  return { ...first, items };
}

export function archiveTrip(id: string) {
  return request<TripRecord>(`/api/v1/trips/${id}/archive`, { method: "POST" });
}

export function fetchFavorites(page = 1) {
  return request<HubPage<FavoriteRecord>>(listUrl("/api/v1/favorites", page));
}

export function addFavorite(listingSlug: string) {
  return request<FavoriteRecord>("/api/v1/favorites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listing_slug: listingSlug }),
  });
}

export function toggleFavorite(listingSlug: string) {
  return request<FavoriteRecord & { saved: boolean }>("/api/v1/favorites/toggle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listing_slug: listingSlug }),
  });
}

export function mergeFavorites(listingSlugs: string[]) {
  return request<{ merged: number }>("/api/v1/favorites/merge", {
    method: "POST",
    body: JSON.stringify({ listing_slugs: listingSlugs }),
  });
}

export function removeFavorite(id: string) {
  return request<void>(`/api/v1/favorites/${id}`, { method: "DELETE" });
}

export function fetchBookings(page = 1) {
  return request<HubPage<BookingRecord>>(listUrl("/api/v1/bookings", page));
}

export function cancelBooking(id: string, reason: string) {
  return request<BookingRecord>(`/api/v1/bookings/${id}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

export function fetchNotifications(page = 1) {
  return request<HubPage<NotificationRecord>>(listUrl("/api/v1/notifications", page));
}

export function markNotificationRead(id: string) {
  return request<NotificationRecord>(`/api/v1/notifications/${id}/read`, { method: "POST" });
}
