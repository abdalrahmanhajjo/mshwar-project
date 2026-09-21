import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanFlow } from "./plan-flow";
import { LocaleProvider } from "@/components/shell/locale-provider";
import type { Destination } from "@/lib/catalog";

const destinations: Destination[] = [
  {
    slug: "byblos",
    name: "Byblos",
    region: "Mount Lebanon",
    country: "Lebanon",
    blurb: "Old harbour",
    tags: [],
    image: "",
    imageAlt: "",
  },
];

function apiItem(slug: string, title: string) {
  return {
    slug,
    title,
    category: "culture",
    destination_slug: "byblos",
    place_label: "Byblos",
    hours: 2,
    body: "A nice place",
    summary: "A nice place",
    tags: [],
    booking_mode: "request",
    price: { type: "from", amount: 20, amount_minor: 2000, currency: "USD", unit: "person" },
  };
}

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

describe("plan flow (manual mode)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("switches to manual, picks a destination, loads places and reaches Save", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ items: [apiItem("harbour-walk", "Harbour walk")] }),
      })),
    );
    render(wrap(<PlanFlow destinations={destinations} />));

    fireEvent.click(screen.getByRole("tab", { name: /Build it myself/ }));
    expect(screen.getByText("Where do you want to go?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Byblos/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Manual mode loads real places for the destination.
    expect(await screen.findByText("Harbour walk")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    // Continue to details -> Save.
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Trip details")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate itinerary|Save itinerary/ })).toBeInTheDocument();
  });
});
