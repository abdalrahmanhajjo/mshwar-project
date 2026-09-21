export type ExperienceCategory = "culture" | "nature" | "coast" | "adventure" | "city";
export type ListingKind = "experience" | "attraction" | "restaurant";

export const LISTING_KINDS: { slug: "all" | ListingKind; label: string }[] = [
  { slug: "all", label: "All" },
  { slug: "experience", label: "Experiences" },
  { slug: "attraction", label: "Attractions" },
  { slug: "restaurant", label: "Restaurants" },
];

export const DEFAULT_PAGE_SIZE = 6;

export const DEFAULT_POLICIES = [
  {
    title: "Cancellation",
    body: "Preview only. Live cancellation terms are stated by the provider before any real booking.",
  },
  {
    title: "Accessibility",
    body: "Access is not verified in this sample. Ask the provider about steps, seating and assistance.",
  },
  {
    title: "What’s included",
    body: "The displayed price is illustrative and excludes transport unless a listing says otherwise.",
  },
];

export type Destination = {
  slug: string;
  name: string;
  region: string;
  country: string;
  blurb: string;
  tags: string[];
  image: string;
  imageAlt: string;
};

export type Experience = {
  slug: string;
  title: string;
  category: ExperienceCategory;
  destinationSlug: string;
  placeLabel: string;
  hours: number;
  priceFrom: number;
  image: string;
  imageAlt: string;
  summary: string;
  body: string;
  tags: string[];
  bookingMode: "instant" | "request" | "inquiry";
  priceLabel: "from" | "estimated" | "quote";
  facts: { title: string; body: string }[];
  kind?: ListingKind;
  distanceKm?: number;
  travelSeconds?: number;
  rating?: number | null;
  groupMin?: number;
  groupMax?: number;
  available?: boolean;
  gallery?: string[];
  /** Venue position when the API provides it. */
  lat?: number;
  lng?: number;
  policies?: { title: string; body: string }[];
  availabilityNote?: string;
};

export type Idea = {
  slug: string;
  kicker: string;
  title: string;
  description: string;
  stops: number;
  priceFrom: number;
  image: string;
  imageAlt: string;
  accent?: boolean;
  experienceSlugs: string[];
};

export const CATEGORIES: { slug: "all" | ExperienceCategory; label: string }[] = [
  { slug: "all", label: "All experiences" },
  { slug: "nature", label: "Nature" },
  { slug: "coast", label: "Coast" },
  { slug: "culture", label: "Culture" },
  { slug: "adventure", label: "Adventure" },
  { slug: "city", label: "City" },
];

export const DESTINATIONS: Destination[] = [
  {
    slug: "byblos",
    name: "Byblos",
    region: "Mount Lebanon",
    country: "Lebanon",
    blurb: "Wander stone lanes, pause by the old harbour, and make time for a long lunch beside the Mediterranean.",
    tags: ["Old town", "By the sea", "Easy walking"],
    image: "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Fishing boats in a stone harbour",
  },
  {
    slug: "batroun",
    name: "Batroun",
    region: "North Lebanon",
    country: "Lebanon",
    blurb: "A friendly coastal town for a slower day by the water.",
    tags: ["Coast", "Friendly", "Relaxed pace"],
    image: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Stone church by the coast",
  },
  {
    slug: "bsharri",
    name: "Bsharri",
    region: "North Lebanon",
    country: "Lebanon",
    blurb: "Mountain air, cedar forest, and a different perspective.",
    tags: ["Forest", "Outdoors", "Mountain air"],
    image: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Cedar tree against a clear sky",
  },
  {
    slug: "qadisha-valley",
    name: "Qadisha Valley",
    region: "North Lebanon",
    country: "Lebanon",
    blurb: "Hike the scenic valley road at your own pace.",
    tags: ["Hiking", "Scenic", "Active"],
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Green mountain valley",
  },
  {
    slug: "baalbek",
    name: "Baalbek",
    region: "Bekaa",
    country: "Lebanon",
    blurb: "Give Lebanon’s history a day of your own.",
    tags: ["Heritage", "Architecture", "History"],
    image: "https://images.unsplash.com/photo-1555993533-2719c56586d4?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Ancient stone columns",
  },
  {
    slug: "beirut",
    name: "Beirut",
    region: "Beirut",
    country: "Lebanon",
    blurb: "City, coffee, and sunset — from street to sea.",
    tags: ["City", "Coffee", "Sunset"],
    image: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Sea rocks at sunset",
  },
];

export const EXPERIENCES: Experience[] = [
  {
    slug: "slow-day-byblos",
    title: "A slow day in Byblos",
    category: "culture",
    destinationSlug: "byblos",
    placeLabel: "Byblos · Mount Lebanon",
    hours: 3,
    priceFrom: 35,
    image: "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Harbour boats in Byblos",
    summary: "Byblos. A little closer.",
    body: "Wander stone lanes, pause by the old harbour, and make time for a long lunch beside the Mediterranean. A day for taking the scenic route.",
    tags: ["Old town", "By the sea", "Easy walking"],
    bookingMode: "request",
    priceLabel: "estimated",
    distanceKm: 37,
    rating: 4.8,
    facts: [
      {
        title: "Time to enjoy it",
        body: "Allow around 3 hours for this sample experience.",
      },
      {
        title: "Bring your people",
        body: "Choose your party size and make the day your own.",
      },
      {
        title: "Meet in Byblos",
        body: "Exact meeting details are confirmed by the provider before a real booking.",
      },
      {
        title: "Know before you go",
        body: "Check opening hours, access and local conditions before travelling.",
      },
    ],
  },
  {
    slug: "coastal-escapes-batroun",
    title: "Coastal escapes in Batroun",
    category: "coast",
    destinationSlug: "batroun",
    placeLabel: "Batroun · North Lebanon",
    hours: 4,
    priceFrom: 45,
    image: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Coastal church in Batroun",
    summary: "Salt air and a friendly town.",
    body: "A coastal day with room to linger — swim, walk the old town, and eat when you are ready.",
    tags: ["Coast", "Friendly", "Relaxed pace"],
    bookingMode: "request",
    priceLabel: "from",
    distanceKm: 54,
    rating: 4.4,
    facts: [
      { title: "Time to enjoy it", body: "Allow around 4 hours for this sample experience." },
      { title: "Bring your people", body: "Choose your party size and make the day your own." },
      { title: "Meet in Batroun", body: "Exact meeting details are confirmed by the provider before a real booking." },
      { title: "Know before you go", body: "Hours, access and weather need checking before travel." },
    ],
  },
  {
    slug: "among-ancient-cedars",
    title: "Among the ancient cedars",
    category: "nature",
    destinationSlug: "bsharri",
    placeLabel: "Bsharri · North Lebanon",
    hours: 2,
    priceFrom: 25,
    image: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Cedar tree in mountain light",
    summary: "A day above it all.",
    body: "Cedar forest and a different perspective. Short walks, cooler air, and time to look up.",
    tags: ["Forest", "Outdoors", "Mountain air"],
    bookingMode: "inquiry",
    priceLabel: "from",
    distanceKm: 110,
    rating: 4.9,
    facts: [
      { title: "Time to enjoy it", body: "Allow around 2 hours for this sample experience." },
      { title: "Bring your people", body: "Choose your party size and make the day your own." },
      { title: "Meet in Bsharri", body: "Exact meeting details are confirmed by the provider before a real booking." },
      { title: "Know before you go", body: "Mountain weather changes quickly. Check conditions before you leave." },
    ],
  },
  {
    slug: "take-the-valley-road",
    title: "Take the valley road",
    category: "adventure",
    destinationSlug: "qadisha-valley",
    placeLabel: "Qadisha Valley · North Lebanon",
    hours: 5,
    priceFrom: 40,
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Valley road through the mountains",
    summary: "The scenic route, on purpose.",
    body: "A longer day for people who want the road itself — viewpoints, short walks, and a slower descent.",
    tags: ["Hiking", "Scenic", "Active"],
    bookingMode: "request",
    priceLabel: "from",
    distanceKm: 95,
    rating: 4.6,
    facts: [
      { title: "Time to enjoy it", body: "Allow around 5 hours for this sample experience." },
      { title: "Bring your people", body: "Choose your party size and make the day your own." },
      {
        title: "Meet in Qadisha Valley",
        body: "Exact meeting details are confirmed by the provider before a real booking.",
      },
      { title: "Know before you go", body: "Wear shoes you can walk in. Some paths are uneven." },
    ],
  },
  {
    slug: "journey-through-baalbek",
    title: "A journey through Baalbek",
    category: "culture",
    destinationSlug: "baalbek",
    placeLabel: "Baalbek · Bekaa",
    hours: 3,
    priceFrom: 30,
    image: "https://images.unsplash.com/photo-1555993533-2719c56586d4?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Ancient columns in Baalbek",
    summary: "Following the stories.",
    body: "Give Lebanon’s history a day of your own — columns, courtyards, and time to stand still.",
    tags: ["Heritage", "Architecture", "History"],
    bookingMode: "request",
    priceLabel: "estimated",
    distanceKm: 85,
    rating: 4.7,
    facts: [
      { title: "Time to enjoy it", body: "Allow around 3 hours for this sample experience." },
      { title: "Bring your people", body: "Choose your party size and make the day your own." },
      { title: "Meet in Baalbek", body: "Exact meeting details are confirmed by the provider before a real booking." },
      { title: "Know before you go", body: "There is little shade. Bring water and a hat." },
    ],
  },
  {
    slug: "beirut-street-to-sea",
    title: "Beirut, from street to sea",
    category: "city",
    destinationSlug: "beirut",
    placeLabel: "Beirut · Beirut",
    hours: 3,
    priceFrom: 20,
    image: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Beirut coastline at dusk",
    summary: "Coffee, streets, and sunset.",
    body: "A city day that ends at the water — neighbourhoods, a long walk, and a seat facing the sea.",
    tags: ["City", "Coffee", "Sunset"],
    bookingMode: "inquiry",
    priceLabel: "from",
    facts: [
      { title: "Time to enjoy it", body: "Allow around 3 hours for this sample experience." },
      { title: "Bring your people", body: "Choose your party size and make the day your own." },
      { title: "Meet in Beirut", body: "Exact meeting details are confirmed by the provider before a real booking." },
      { title: "Know before you go", body: "Traffic and timing change. Leave a little room." },
    ],
    distanceKm: 4,
    rating: 4.6,
    groupMax: 10,
  },
  {
    slug: "byblos-harbour-walls",
    title: "Byblos harbour walls",
    category: "culture",
    destinationSlug: "byblos",
    placeLabel: "Byblos · Mount Lebanon",
    hours: 2,
    priceFrom: 15,
    image: "https://images.unsplash.com/photo-1515542621654-7593cbd31345?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Stone walls and an old harbour lane",
    summary: "The old harbour, at walking pace.",
    body: "A short wander along the harbour walls and lanes. Sample attraction details — hours and tickets must be confirmed on the day.",
    tags: ["Harbour", "Heritage", "Easy walking"],
    bookingMode: "inquiry",
    priceLabel: "from",
    kind: "attraction",
    distanceKm: 37,
    rating: 4.7,
    groupMax: 12,
    facts: [
      { title: "Time to enjoy it", body: "Allow around 2 hours, including a pause by the water." },
      { title: "Bring your people", body: "Open-air and easy to join at your own pace." },
      { title: "Meet in Byblos", body: "This is a sample attraction card, not a ticketed offer." },
      { title: "Know before you go", body: "Stone paths can be uneven. Wear shoes you can walk in." },
    ],
  },
  {
    slug: "beirut-souks-wander",
    title: "Beirut Souks wander",
    category: "city",
    destinationSlug: "beirut",
    placeLabel: "Beirut · Beirut",
    hours: 2,
    priceFrom: 0,
    image: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "City lanes and shop fronts",
    summary: "Lanes, coffee, and a little shade.",
    body: "A sample attraction card for a self-guided wander through the central lanes. No named shop is booked here.",
    tags: ["City", "Walking", "Coffee"],
    bookingMode: "inquiry",
    priceLabel: "quote",
    kind: "attraction",
    distanceKm: 2,
    rating: 4.4,
    available: false,
    facts: [
      { title: "Time to enjoy it", body: "Allow around 2 hours if you like to linger." },
      { title: "Bring your people", body: "Suitable for a small group walking together." },
      { title: "Meet in Beirut", body: "Availability is unknown in this preview." },
      { title: "Know before you go", body: "This card is a place to start, not a timed entry." },
    ],
    availabilityNote: "Availability unknown in this preview. Not offered for booking.",
  },
  {
    slug: "harbour-lunch-byblos",
    title: "A harbour lunch in Byblos",
    category: "coast",
    destinationSlug: "byblos",
    placeLabel: "Byblos · Mount Lebanon",
    hours: 2,
    priceFrom: 28,
    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "A long lunch table by a window",
    summary: "A long lunch beside the water.",
    body: "A sample restaurant idea for a harbour lunch. No specific kitchen is named or reserved.",
    tags: ["Lunch", "By the sea", "Relaxed pace"],
    bookingMode: "request",
    priceLabel: "estimated",
    kind: "restaurant",
    distanceKm: 37,
    rating: 4.5,
    groupMax: 6,
    facts: [
      { title: "Time to enjoy it", body: "Allow around 2 hours for a slow lunch." },
      { title: "Bring your people", body: "Best for a small table of two to six." },
      { title: "Meet in Byblos", body: "A real table is never held from this preview." },
      { title: "Know before you go", body: "Dietary needs must be confirmed with a real restaurant." },
    ],
  },
  {
    slug: "coastal-table-batroun",
    title: "A coastal table in Batroun",
    category: "coast",
    destinationSlug: "batroun",
    placeLabel: "Batroun · North Lebanon",
    hours: 2,
    priceFrom: 32,
    image: "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "A simple table set for lunch",
    summary: "Salt air and a simple table.",
    body: "A sample restaurant idea for Batroun. This is not a reservation and does not name a kitchen.",
    tags: ["Lunch", "Coast", "Friendly"],
    bookingMode: "request",
    priceLabel: "from",
    kind: "restaurant",
    distanceKm: 54,
    rating: 4.3,
    groupMax: 8,
    facts: [
      { title: "Time to enjoy it", body: "Allow around 2 hours, longer if the evening stretches." },
      { title: "Bring your people", body: "Works for a small group if a real table is available." },
      { title: "Meet in Batroun", body: "Ask a local restaurant directly before you travel." },
      { title: "Know before you go", body: "Weekend tables fill. This preview cannot hold one." },
    ],
  },
];

export const IDEAS: Idea[] = [
  {
    slug: "coast-calling",
    kicker: "Idea 01 · 2 stops",
    title: "The coast is calling.",
    description: "Harbour lanes, old streets and a little sea air.",
    stops: 2,
    priceFrom: 80,
    image: "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Harbour boats along the coast",
    experienceSlugs: ["slow-day-byblos", "coastal-escapes-batroun"],
  },
  {
    slug: "day-above",
    kicker: "Idea 02 · 2 stops",
    title: "A day above it all.",
    description: "Cedar forests and a different perspective.",
    stops: 2,
    priceFrom: 65,
    image: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Cedar forest in mountain light",
    accent: true,
    experienceSlugs: ["among-ancient-cedars", "take-the-valley-road"],
  },
  {
    slug: "following-stories",
    kicker: "Idea 03 · 1 stop",
    title: "Following the stories.",
    description: "Give Lebanon’s history a day of your own.",
    stops: 1,
    priceFrom: 30,
    image: "https://images.unsplash.com/photo-1555993533-2719c56586d4?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Ancient columns",
    experienceSlugs: ["journey-through-baalbek"],
  },
];

export const HOME_HERO_IMAGE =
  "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=2000&q=80";

export type ExperienceFilters = {
  q?: string;
  category?: string;
  destination?: string;
  sort?: string;
  kind?: string;
  date?: string;
  dateEnd?: string;
  priceMax?: number;
  distance?: number;
  party?: number;
  rating?: number;
  available?: boolean;
  view?: string;
  page?: number;
  pageSize?: number;
};

export type ExperiencePage = {
  items: Experience[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function optionalNumber(value: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function listingKind(item: Experience): ListingKind {
  return item.kind ?? "experience";
}

export function listingDistance(item: Experience): number {
  return item.distanceKm ?? 45;
}

export function listingRating(item: Experience): number | null {
  return item.rating ?? null;
}

export function listingGroupMin(item: Experience): number {
  return item.groupMin ?? 1;
}

export function listingGroupMax(item: Experience): number {
  return item.groupMax ?? 8;
}

export function listingAvailable(item: Experience): boolean {
  return item.available !== false;
}

export function listingGallery(item: Experience): string[] {
  if (item.gallery?.length) {
    return item.gallery;
  }
  const dest = getDestination(item.destinationSlug);
  if (dest && dest.image !== item.image) {
    return [item.image, dest.image];
  }
  return [item.image];
}

export function listingPolicies(item: Experience): { title: string; body: string }[] {
  return item.policies?.length ? item.policies : DEFAULT_POLICIES;
}

export function listingAvailabilityNote(item: Experience): string {
  if (item.availabilityNote) {
    return item.availabilityNote;
  }
  if (!listingAvailable(item)) {
    return "Availability unknown in this preview. Not offered for booking.";
  }
  return "Sample preview. Live dates and remaining places are confirmed by the provider before any real booking.";
}

export function parseExperienceFilters(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
): ExperienceFilters {
  const read = (key: string) => (input instanceof URLSearchParams ? (input.get(key) ?? "") : firstParam(input[key]));
  const availableValue = read("available");
  return {
    q: read("q") || undefined,
    category: read("category") || undefined,
    destination: read("destination") || undefined,
    sort: read("sort") || undefined,
    kind: read("kind") || undefined,
    date: read("date") || undefined,
    dateEnd: read("dateEnd") || undefined,
    priceMax: optionalNumber(read("priceMax")),
    distance: optionalNumber(read("distance")),
    party: optionalNumber(read("party") || read("group")),
    rating: optionalNumber(read("rating")),
    available: availableValue === "1" || availableValue === "true" ? true : undefined,
    view: read("view") || undefined,
    page: optionalNumber(read("page")),
    pageSize: optionalNumber(read("pageSize")),
  };
}

export function serializeExperienceFilters(filters: ExperienceFilters): string {
  const search = new URLSearchParams();
  const set = (key: string, value: string | number | boolean | undefined) => {
    if (value === undefined || value === "" || value === false) {
      return;
    }
    search.set(key, String(value));
  };
  set("q", filters.q);
  if (filters.category && filters.category !== "all") {
    set("category", filters.category);
  }
  set("destination", filters.destination);
  if (filters.sort && filters.sort !== "recommended") {
    set("sort", filters.sort);
  }
  if (filters.kind && filters.kind !== "all") {
    set("kind", filters.kind);
  }
  set("date", filters.date);
  set("dateEnd", filters.dateEnd);
  set("priceMax", filters.priceMax);
  set("distance", filters.distance);
  set("party", filters.party);
  set("rating", filters.rating);
  if (filters.available) {
    search.set("available", "1");
  }
  if (filters.view === "map") {
    search.set("view", "map");
  }
  if (filters.page && filters.page > 1) {
    set("page", filters.page);
  }
  if (filters.pageSize && filters.pageSize !== DEFAULT_PAGE_SIZE) {
    set("pageSize", filters.pageSize);
  }
  return search.toString();
}

export function paginateExperiences(rows: Experience[], page = 1, pageSize = DEFAULT_PAGE_SIZE): ExperiencePage {
  const size = pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * size;
  return {
    items: rows.slice(start, start + size),
    total: rows.length,
    page: current,
    pageSize: size,
    pages,
  };
}

export function getDestination(slug: string): Destination | undefined {
  return DESTINATIONS.find((item) => item.slug === slug);
}

export function getExperience(slug: string): Experience | undefined {
  return EXPERIENCES.find((item) => item.slug === slug);
}

export function experiencesForDestination(slug: string): Experience[] {
  return EXPERIENCES.filter((item) => item.destinationSlug === slug);
}

export function relatedExperiences(slug: string, limit = 3): Experience[] {
  const current = getExperience(slug);
  if (!current) {
    return EXPERIENCES.slice(0, limit);
  }
  const related = EXPERIENCES.filter(
    (item) =>
      item.slug !== slug && (item.destinationSlug === current.destinationSlug || item.category === current.category),
  );
  return (related.length ? related : EXPERIENCES.filter((item) => item.slug !== slug)).slice(0, limit);
}

export function filterExperiences(filters: ExperienceFilters): Experience[] {
  const q = filters.q?.trim().toLowerCase() ?? "";
  const category = filters.category && filters.category !== "all" ? filters.category : "";
  const destination = filters.destination?.trim() ?? "";
  const kind = filters.kind && filters.kind !== "all" ? filters.kind : "";
  let rows = EXPERIENCES.filter((item) => {
    if (kind && listingKind(item) !== kind) {
      return false;
    }
    if (category && item.category !== category) {
      return false;
    }
    if (destination && item.destinationSlug !== destination) {
      return false;
    }
    if (filters.priceMax !== undefined && item.priceFrom > filters.priceMax) {
      return false;
    }
    if (filters.distance !== undefined && listingDistance(item) > filters.distance) {
      return false;
    }
    if (filters.party !== undefined) {
      if (filters.party < listingGroupMin(item) || filters.party > listingGroupMax(item)) {
        return false;
      }
    }
    if (filters.rating !== undefined) {
      const rating = listingRating(item);
      if (rating === null || rating < filters.rating) {
        return false;
      }
    }
    if ((filters.available || filters.date) && !listingAvailable(item)) {
      return false;
    }
    if (!q) {
      return true;
    }
    const hay =
      `${item.title} ${item.placeLabel} ${item.tags.join(" ")} ${item.body} ${listingKind(item)}`.toLowerCase();
    return hay.includes(q);
  });
  if (filters.sort === "price") {
    rows = [...rows].sort((a, b) => a.priceFrom - b.priceFrom);
  } else if (filters.sort === "duration") {
    rows = [...rows].sort((a, b) => a.hours - b.hours);
  } else if (filters.sort === "rating") {
    rows = [...rows].sort((a, b) => (listingRating(b) ?? 0) - (listingRating(a) ?? 0));
  }
  return rows;
}

export function browseExperiences(filters: ExperienceFilters): ExperiencePage {
  return paginateExperiences(filterExperiences(filters), filters.page, filters.pageSize ?? DEFAULT_PAGE_SIZE);
}

export function bookingModeLabel(mode: Experience["bookingMode"]): string {
  if (mode === "instant") {
    return "Instant confirm";
  }
  if (mode === "inquiry") {
    return "Inquiry";
  }
  return "Request to book";
}

export function priceKindLabel(label: Experience["priceLabel"]): string {
  if (label === "estimated") {
    return "Estimated from";
  }
  if (label === "quote") {
    return "Quote required";
  }
  return "From";
}
