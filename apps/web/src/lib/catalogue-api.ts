import {
  DESTINATIONS,
  IDEAS,
  browseExperiences,
  getExperience,
  relatedExperiences as seedRelated,
  type Destination,
  type Experience,
  type ExperienceFilters,
  type ExperiencePage,
  type Idea,
} from "@/lib/catalog";
import { sampleFallbackEnabled } from "@/lib/server-env";

const API_ROOT = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const REVALIDATE_SECONDS = 60;

type ApiResult<T> = { status: "ok"; data: T } | { status: "missing" } | { status: "unavailable" };

type ApiPrice = {
  currency: string;
  type: string;
  source: string;
  amount: number;
};

type ApiListing = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  body: string;
  category: string;
  tags: string[];
  destination_slug: string;
  place_label: string;
  hours: number;
  booking_mode: "instant" | "request" | "inquiry";
  kind: "experience" | "attraction" | "restaurant";
  available: boolean;
  weather_sensitivity?: string;
  group_min?: number;
  group_max?: number;
  facts?: { title: string; body: string }[];
  rating?: number | null;
  lat?: number | null;
  lng?: number | null;
  distance_km?: number | null;
  travel_seconds?: number | null;
  image?: string | null;
  image_alt?: string | null;
  gallery?: string[];
  price: ApiPrice;
};

type ApiPage = {
  items: ApiListing[];
  page: number;
  page_size: number;
  total: number;
  pages: number;
};

type ApiDestination = {
  slug: string;
  name: string;
  region: string;
  country?: string;
  blurb: string;
  image?: string | null;
  image_alt?: string | null;
  tags: string[];
};

type ApiCollection = {
  slug: string;
  title: string;
  description: string;
  kicker: string;
  image?: string | null;
  image_alt?: string | null;
  accent?: boolean;
  stops: number;
  experience_slugs: string[];
  price_from: number;
};

export type SearchRelaxation = { drop: string; label: string };

function priceLabel(type: string): Experience["priceLabel"] {
  if (type === "estimated") {
    return "estimated";
  }
  if (type === "quote-required") {
    return "quote";
  }
  return "from";
}

export function listingFromApi(item: ApiListing): Experience {
  return {
    slug: item.slug,
    title: item.title,
    category: item.category as Experience["category"],
    destinationSlug: item.destination_slug,
    placeLabel: item.place_label,
    hours: item.hours,
    priceFrom: item.price?.amount ?? 0,
    image: item.image ?? "",
    imageAlt: item.image_alt ?? item.title,
    summary: item.summary ?? item.body,
    body: item.body,
    tags: item.tags ?? [],
    lat: item.lat ?? undefined,
    lng: item.lng ?? undefined,
    bookingMode: item.booking_mode,
    priceLabel: priceLabel(item.price?.type ?? "from"),
    facts: item.facts ?? [],
    kind: item.kind,
    distanceKm: item.distance_km ?? undefined,
    travelSeconds: item.travel_seconds ?? undefined,
    rating: item.rating ?? null,
    groupMin: item.group_min,
    groupMax: item.group_max,
    available: item.available,
    gallery: item.gallery,
  };
}

function destinationFromApi(item: ApiDestination): Destination {
  return {
    slug: item.slug,
    name: item.name,
    region: item.region,
    country: item.country ?? "Lebanon",
    blurb: item.blurb,
    tags: item.tags ?? [],
    image: item.image ?? "",
    imageAlt: item.image_alt ?? item.name,
  };
}

function ideaFromApi(item: ApiCollection): Idea {
  return {
    slug: item.slug,
    kicker: item.kicker,
    title: item.title,
    description: item.description,
    stops: item.stops,
    priceFrom: item.price_from,
    image: item.image ?? "",
    imageAlt: item.image_alt ?? item.title,
    accent: item.accent,
    experienceSlugs: item.experience_slugs,
  };
}

async function readJson<T>(path: string): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${API_ROOT}${path}`, { next: { revalidate: REVALIDATE_SECONDS } });
    if (response.status === 404) {
      return { status: "missing" };
    }
    if (!response.ok) {
      return { status: "unavailable" };
    }
    return { status: "ok", data: (await response.json()) as T };
  } catch {
    return { status: "unavailable" };
  }
}

/** Real data when the API answers; sample data only when it is down and fallback is allowed. */
function resolve<T, R>(result: ApiResult<T>, map: (data: T) => R, sample: () => R, empty: R): R {
  if (result.status === "ok") {
    return map(result.data);
  }
  if (result.status === "unavailable" && sampleFallbackEnabled()) {
    return sample();
  }
  return empty;
}

export async function loadDestinations(): Promise<Destination[]> {
  const result = await readJson<ApiDestination[]>("/api/v1/catalogue/destinations");
  return resolve(
    result,
    (rows) => rows.map(destinationFromApi),
    () => DESTINATIONS,
    [],
  );
}

export async function loadDestination(slug: string): Promise<Destination | undefined> {
  const destinations = await loadDestinations();
  return destinations.find((item) => item.slug === slug);
}

export async function loadExperiencePage(filters: ExperienceFilters): Promise<ExperiencePage> {
  const search = new URLSearchParams();
  if (filters.q) search.set("q", filters.q);
  if (filters.category && filters.category !== "all") search.set("category", filters.category);
  if (filters.destination) search.set("destination", filters.destination);
  if (filters.kind && filters.kind !== "all") search.set("kind", filters.kind);
  if (filters.sort) search.set("sort", filters.sort);
  if (filters.priceMax) search.set("priceMax", String(filters.priceMax));
  if (filters.party) search.set("party", String(filters.party));
  if (filters.available) search.set("available", "true");
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 6;
  search.set("page", String(page));
  search.set("pageSize", String(pageSize));
  const result = await readJson<ApiPage>(`/api/v1/catalogue/experiences?${search}`);
  return resolve(
    result,
    (data) => ({
      items: data.items.map(listingFromApi),
      page: data.page,
      pageSize: data.page_size,
      total: data.total,
      pages: data.pages,
    }),
    () => browseExperiences(filters),
    { items: [], page, pageSize, total: 0, pages: 1 },
  );
}

export async function loadExperience(slug: string): Promise<Experience | undefined> {
  const result = await readJson<ApiListing>(`/api/v1/catalogue/experiences/${encodeURIComponent(slug)}`);
  return resolve(result, listingFromApi, () => getExperience(slug), undefined);
}

export async function loadRelated(slug: string): Promise<Experience[]> {
  const result = await readJson<ApiListing[]>(`/api/v1/catalogue/experiences/${encodeURIComponent(slug)}/related`);
  return resolve(
    result,
    (rows) => rows.map(listingFromApi),
    () => seedRelated(slug),
    [],
  );
}

export async function loadCollections(): Promise<Idea[]> {
  const result = await readJson<ApiCollection[]>("/api/v1/catalogue/collections");
  return resolve(
    result,
    (rows) => rows.map(ideaFromApi),
    () => IDEAS,
    [],
  );
}

export async function loadCollection(slug: string): Promise<Idea | undefined> {
  const result = await readJson<ApiCollection>(`/api/v1/catalogue/collections/${encodeURIComponent(slug)}`);
  return resolve(result, ideaFromApi, () => IDEAS.find((item) => item.slug === slug), undefined);
}

export async function loadMapListings(filters: ExperienceFilters): Promise<Experience[]> {
  const page = await loadExperiencePage({ ...filters, page: 1, pageSize: 48 });
  return page.items;
}
