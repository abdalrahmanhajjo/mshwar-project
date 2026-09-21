import type { Experience } from "@/lib/catalog";

const DESTINATION_CENTRES: Record<string, { lat: number; lng: number }> = {
  byblos: { lat: 34.123, lng: 35.6481 },
  batroun: { lat: 34.2553, lng: 35.6581 },
  bsharri: { lat: 34.2508, lng: 36.0106 },
  "qadisha-valley": { lat: 34.245, lng: 35.952 },
  baalbek: { lat: 34.0069, lng: 36.2042 },
  beirut: { lat: 33.8938, lng: 35.5018 },
};

/** Listing position for the map: the venue itself, else its destination centre, else unknown. */
export function listingCoordinates(item: Experience): { lat: number; lng: number } | null {
  if (typeof item.lat === "number" && typeof item.lng === "number") {
    return { lat: item.lat, lng: item.lng };
  }
  return DESTINATION_CENTRES[item.destinationSlug] ?? null;
}
