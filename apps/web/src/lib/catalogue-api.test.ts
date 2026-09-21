import { afterEach, describe, expect, it, vi } from "vitest";
import { listingFromApi, loadExperience, loadExperiencePage } from "./catalogue-api";
import { listingCoordinates } from "./listing-coordinates";

describe("catalogue API mapping", () => {
  it("maps a real listing id and price model without inventing slugs", () => {
    const listing = listingFromApi({
      id: "11111111-1111-1111-1111-111111111111",
      slug: "slow-day-byblos",
      title: "A slow day in Byblos",
      body: "Harbour lanes.",
      category: "culture",
      tags: ["Old town"],
      destination_slug: "byblos",
      place_label: "Byblos · Mount Lebanon",
      hours: 3,
      booking_mode: "request",
      kind: "experience",
      available: true,
      image: "https://example.com/byblos.jpg",
      image_alt: "Harbour",
      price: { currency: "USD", type: "estimated", source: "catalogue-seed", amount: 35 },
    });
    expect(listing.slug).toBe("slow-day-byblos");
    expect(listing.priceLabel).toBe("estimated");
    expect(listing.priceFrom).toBe(35);
    expect(listing.destinationSlug).toBe("byblos");
  });
});

describe("catalogue API fallback", () => {
  const originalFetch = globalThis.fetch;
  const listing = {
    id: "1",
    slug: "api-only-listing",
    title: "From the API",
    body: "Real listing.",
    category: "culture",
    tags: [],
    destination_slug: "tyre",
    place_label: "Tyre",
    hours: 2,
    booking_mode: "request",
    kind: "experience",
    available: true,
    lat: 33.27,
    lng: 35.2,
    price: { currency: "USD", type: "from", source: "portal", amount: 20 },
  };

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("never shows sample listings when the API says a listing does not exist", async () => {
    vi.stubEnv("CATALOGUE_SAMPLE_FALLBACK", "true");
    globalThis.fetch = vi.fn(async () => new Response("{}", { status: 404 })) as typeof fetch;
    expect(await loadExperience("slow-day-byblos")).toBeUndefined();
  });

  it("uses sample data only when the API is down and fallback is allowed", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    vi.stubEnv("CATALOGUE_SAMPLE_FALLBACK", "false");
    expect(await loadExperience("slow-day-byblos")).toBeUndefined();
    expect((await loadExperiencePage({})).items).toEqual([]);
    vi.stubEnv("CATALOGUE_SAMPLE_FALLBACK", "true");
    expect((await loadExperience("slow-day-byblos"))?.slug).toBe("slow-day-byblos");
  });

  it("maps paging fields and venue coordinates from the API", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ items: [listing], page: 2, page_size: 6, total: 7, pages: 2 }), {
          status: 200,
        }),
    ) as typeof fetch;
    const page = await loadExperiencePage({ page: 2 });
    expect(page.pageSize).toBe(6);
    expect(listingCoordinates(page.items[0])).toEqual({ lat: 33.27, lng: 35.2 });
  });

  it("has no invented coordinates for unknown destinations", () => {
    const base = listingFromApi({ ...listing, lat: null, lng: null } as Parameters<typeof listingFromApi>[0]);
    expect(listingCoordinates(base)).toBeNull();
    expect(listingCoordinates({ ...base, destinationSlug: "byblos" })).toEqual({ lat: 34.123, lng: 35.6481 });
  });
});
