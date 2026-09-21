import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FavoritesView } from "./favorites-view";
import { TripsView } from "./trips-view";
import { AuthProvider } from "@/components/shell/auth-provider";
import { LocaleProvider } from "@/components/shell/locale-provider";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function wrap(ui: ReactNode) {
  return (
    <LocaleProvider>
      <AuthProvider>{ui}</AuthProvider>
    </LocaleProvider>
  );
}

describe("account hub views", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a trip empty state that links to plan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/auth/me")) {
          return jsonResponse({ id: "1", email: "a@b.com", display_name: "Ada", locale: "en" });
        }
        return jsonResponse({ items: [], page: 1, page_size: 6, total: 0 });
      }),
    );
    render(wrap(<TripsView />));
    expect(await screen.findByRole("heading", { name: "Your trips" })).toBeInTheDocument();
    expect(screen.getByText("No trips yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Plan a trip" })).toHaveAttribute("href", "/plan");
  });

  it("archives a trip from the list", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/auth/me")) {
        return jsonResponse({ id: "1", email: "a@b.com", display_name: "Ada", locale: "en" });
      }
      if (String(url).includes("/archive") && init?.method === "POST") {
        return jsonResponse({
          id: "trip-1",
          name: "Coast",
          status: "archived",
          created_at: "2026-09-01T00:00:00Z",
        });
      }
      return jsonResponse({
        items: [{ id: "trip-1", name: "Coast", status: "draft", created_at: "2026-09-01T00:00:00Z" }],
        page: 1,
        page_size: 6,
        total: 1,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(wrap(<TripsView />));
    expect(await screen.findByText("Coast")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Archive trip" }));
    await waitFor(() => expect(screen.getByText("Archived")).toBeInTheDocument());
  });

  it("shows trips on a calendar and filters by the planned day", async () => {
    const iso = new Date().toISOString();
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/auth/me")) {
        return jsonResponse({ id: "1", email: "a@b.com", display_name: "Ada", locale: "en" });
      }
      return jsonResponse({
        items: [
          { id: "trip-9", name: "Cedars Day", status: "draft", created_at: iso, planned_date: iso, stop_count: 3 },
        ],
        page: 1,
        page_size: 100,
        total: 1,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(wrap(<TripsView />));
    expect(await screen.findByText("Cedars Day")).toBeInTheDocument();

    // Switch to the calendar view.
    fireEvent.click(screen.getByRole("tab", { name: /Calendar/ }));
    // The month label renders and the trip is listed under the calendar.
    const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date());
    expect(await screen.findByText(monthLabel)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("Cedars Day").length).toBeGreaterThan(0));

    // Only days that have trips are enabled; click that day to filter.
    const dayCell = screen
      .getAllByRole("button")
      .find((b) => b.getAttribute("aria-pressed") !== null && !b.hasAttribute("disabled"));
    expect(dayCell).toBeDefined();
    fireEvent.click(dayCell as HTMLElement);
    expect(await screen.findByText("All days")).toBeInTheDocument();
    expect(screen.getAllByText("Cedars Day").length).toBeGreaterThan(0);
  });

  it("shows favorites empty state and unfavorites a card", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/auth/me")) {
        return jsonResponse({ id: "1", email: "a@b.com", display_name: "Ada", locale: "en" });
      }
      if (init?.method === "DELETE") {
        return { ok: true, status: 204, json: async () => ({}) };
      }
      return jsonResponse({
        items: [{ id: "fav-1", listing_slug: "slow-day-byblos", created_at: "2026-09-01T00:00:00Z" }],
        page: 1,
        page_size: 6,
        total: 1,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(wrap(<FavoritesView />));
    expect(await screen.findByRole("heading", { name: "Favorites" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove favorite" }));
    await waitFor(() => expect(fetchMock.mock.calls.some((call) => call[1]?.method === "DELETE")).toBe(true));
  });
});
