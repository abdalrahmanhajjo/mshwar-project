import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GroupTripView } from "./group-trip-view";
import { LocaleProvider } from "@/components/shell/locale-provider";

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

describe("guide dashboard", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders the shared itinerary, roster and agreement chips", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.endsWith("/itinerary")) {
          return jsonResponse({
            trip_id: "t1",
            trip_title: "Cedars Tour",
            version_id: "v1",
            window_start: "2026-09-21T09:00:00Z",
            return_by: "2026-09-21T18:00:00Z",
            party_size: 2,
            currency: "USD",
            stops: [
              {
                id: "s1",
                experience_id: "e1",
                position: 1,
                starts_at: "2026-09-21T09:00:00Z",
                ends_at: "2026-09-21T11:00:00Z",
                estimated_minor: 5000,
                price_kind: "estimate",
                locked: false,
                snapshot: { title: "Harbour walk", slug: "slow-day-byblos" },
                slug: "slow-day-byblos",
                title: "Harbour walk",
                image: "",
              },
            ],
            legs: [],
            total_minor: 5000,
          });
        }
        if (u.includes("/participants")) {
          return jsonResponse({ items: [{ display_name: "Ada", role: "owner" }] });
        }
        if (u.includes("/tally")) {
          return jsonResponse({ items: [] });
        }
        if (u.includes("/summary")) {
          return jsonResponse({
            agreement: [{ label: "Harbour walk", yes: 2, no: 0 }],
            disagreement: [],
            tradeoffs: [],
          });
        }
        if (u.includes("/share-links")) {
          return jsonResponse([]);
        }
        // get_group_trip
        return jsonResponse({
          id: "t1",
          title: "Cedars Tour",
          status: "draft",
          role: "owner",
          can_share: true,
          can_lock: true,
          can_vote: true,
        });
      }),
    );
    render(wrap(<GroupTripView tripId="t1" />));
    expect((await screen.findAllByRole("heading", { name: "Cedars Tour" })).length).toBeGreaterThan(0);
    // Itinerary stop shows (there is a heading + an agreement chip with the same label).
    expect((await screen.findAllByText("Harbour walk")).length).toBeGreaterThan(0);
  });
});
