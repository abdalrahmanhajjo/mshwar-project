import { describe, expect, it } from "vitest";
import {
  DESTINATIONS,
  EXPERIENCES,
  browseExperiences,
  filterExperiences,
  getDestination,
  parseExperienceFilters,
  relatedExperiences,
  serializeExperienceFilters,
} from "./catalog";

describe("Lebanon catalog seed", () => {
  it("covers the six destination cards from the marketing screens", () => {
    expect(DESTINATIONS.map((item) => item.slug)).toEqual([
      "byblos",
      "batroun",
      "bsharri",
      "qadisha-valley",
      "baalbek",
      "beirut",
    ]);
  });

  it("filters experiences from URL state without inventing results", () => {
    const coast = filterExperiences({ category: "coast" });
    expect(coast.every((item) => item.category === "coast")).toBe(true);
    expect(filterExperiences({ q: "Byblos" }).some((item) => item.slug === "slow-day-byblos")).toBe(true);
    expect(filterExperiences({ q: "not-a-real-place" })).toEqual([]);
    const priced = filterExperiences({ sort: "price" });
    expect(priced[0].priceFrom).toBeLessThanOrEqual(priced[priced.length - 1].priceFrom);
  });

  it("keeps related experiences on the same place or category", () => {
    const related = relatedExperiences("slow-day-byblos");
    expect(related.every((item) => item.slug !== "slow-day-byblos")).toBe(true);
    expect(getDestination("byblos")?.name).toBe("Byblos");
    expect(EXPERIENCES.length).toBeGreaterThanOrEqual(10);
  });

  it("applies rail filters and paginates from URL state", () => {
    expect(filterExperiences({ kind: "restaurant" }).every((item) => item.kind === "restaurant")).toBe(true);
    expect(filterExperiences({ available: true }).every((item) => item.available !== false)).toBe(true);
    expect(filterExperiences({ priceMax: 25 }).every((item) => item.priceFrom <= 25)).toBe(true);
    expect(filterExperiences({ distance: 10 }).every((item) => (item.distanceKm ?? 45) <= 10)).toBe(true);
    expect(filterExperiences({ rating: 4.5 }).every((item) => (item.rating ?? 0) >= 4.5)).toBe(true);
    const parsed = parseExperienceFilters({
      category: "coast",
      available: "1",
      priceMax: "40",
      page: "2",
    });
    expect(parsed.available).toBe(true);
    expect(serializeExperienceFilters(parsed)).toContain("category=coast");
    const page = browseExperiences({ page: 2, pageSize: 6 });
    expect(page.page).toBe(2);
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.total).toBe(EXPERIENCES.length);
    const coastImages = filterExperiences({ category: "coast" }).map((item) => item.image);
    expect(new Set(coastImages).size).toBe(coastImages.length);
  });
});
