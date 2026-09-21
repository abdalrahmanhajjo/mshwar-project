import { describe, expect, it } from "vitest";
import { samplePlan } from "@/lib/planner";
import { LEBANON } from "@/lib/geo";

describe("planner client helpers", () => {
  it("builds a demo plan from the chosen start without inventing inventory", () => {
    const plan = samplePlan({
      lat: LEBANON.beirut.lat,
      lng: LEBANON.beirut.lng,
      label: "Hamra, Beirut",
      source: "search",
    });
    expect(plan.start.label).toBe("Hamra, Beirut");
    expect(plan.stops.map((stop) => stop.id)).toEqual(["downtown", "hike", "cafe"]);
    expect(plan.stops[0].locked).toBe(true);
  });
});
