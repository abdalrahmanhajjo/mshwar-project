import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StartLocationPicker } from "./start-location-picker";
import { WeatherWarningList } from "./weather-warning";
import { ReplanDiff } from "./replan-diff";
import { LocaleProvider } from "@/components/shell/locale-provider";

describe("start location picker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps manual entry after geolocation denial", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (_ok: unknown, err: (error: { code: number }) => void) => err({ code: 1 }),
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).includes("/autocomplete")) {
          return {
            ok: true,
            json: async () => [
              { label: "Hamra, Beirut", lat: 33.89, lng: 35.48, source: "catalog", place_id: "hamra" },
            ],
          };
        }
        if (String(url).includes("/locations/start") && init?.method === "POST") {
          const body = JSON.parse(String(init.body)) as { label: string; source: string };
          return {
            ok: true,
            json: async () => ({
              preferences: { start_location: { lat: 33.89, lng: 35.48, label: body.label, source: body.source } },
            }),
          };
        }
        return { ok: true, json: async () => ({}) };
      }),
    );
    render(
      <LocaleProvider>
        <StartLocationPicker />
      </LocaleProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Location permission was denied");
    fireEvent.change(screen.getByLabelText("Type a label and coordinates"), { target: { value: "Hamra studio" } });
    fireEvent.click(screen.getByRole("button", { name: "Save as default start" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved to your profile"));
  });

  it("applies a search hit and a dropped pin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).includes("/autocomplete")) {
          return {
            ok: true,
            json: async () => [
              { label: "Byblos (Jbeil)", lat: 34.12, lng: 35.65, source: "catalog", place_id: "byblos" },
            ],
          };
        }
        if (String(url).includes("/reverse")) {
          return {
            ok: true,
            json: async () => ({
              label: "Downtown Beirut",
              lat: 33.896,
              lng: 35.506,
              source: "reverse-catalog",
              place_id: "downtown",
            }),
          };
        }
        if (String(url).includes("/locations/start") && init?.method === "POST") {
          const body = JSON.parse(String(init.body)) as { label: string; source: string };
          return {
            ok: true,
            json: async () => ({
              preferences: { start_location: { lat: 33.896, lng: 35.506, label: body.label, source: body.source } },
            }),
          };
        }
        return { ok: true, json: async () => ({}) };
      }),
    );
    render(
      <LocaleProvider>
        <StartLocationPicker />
      </LocaleProvider>,
    );
    fireEvent.change(screen.getByLabelText("Search a place"), { target: { value: "byb" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Byblos (Jbeil)" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Byblos (Jbeil)" }));
    fireEvent.click(screen.getByRole("application", { name: "Drop a pin on the map" }));
    await waitFor(() => expect(screen.getByLabelText("Type a label and coordinates")).toHaveValue("Downtown Beirut"));
  });
});

describe("weather warning", () => {
  it("does not warn when the forecast is unavailable", () => {
    render(
      <LocaleProvider>
        <WeatherWarningList
          result={{
            warnings: [],
            forecast_unavailable: true,
            bookings_mutated: false,
            booking_statuses: { "bk-1": "confirmed" },
          }}
        />
      </LocaleProvider>,
    );
    expect(screen.getByText(/Forecast unavailable/)).toBeInTheDocument();
  });

  it("names the stop and forecast source timestamp", () => {
    render(
      <LocaleProvider>
        <WeatherWarningList
          result={{
            warnings: [
              {
                stop_id: "hike",
                stop_label: "Cedars walk",
                severity: "warning",
                reasons: ["Precipitation 12.4 mm meets the 2.0 mm threshold"],
                source: "open-meteo",
                fetched_at: "2026-09-14T06:00:00+00:00",
                forecast_date: "2026-09-14",
              },
            ],
            forecast_unavailable: false,
            bookings_mutated: false,
            booking_statuses: { "bk-1": "confirmed" },
          }}
        />
      </LocaleProvider>,
    );
    expect(screen.getByText("Cedars walk · open-meteo · 2026-09-14T06:00:00+00:00")).toBeInTheDocument();
    expect(screen.getByText(/Precipitation 12.4/)).toBeInTheDocument();
  });
});

describe("replan diff", () => {
  it("shows a plain message when no feasible alternative exists", () => {
    render(
      <LocaleProvider>
        <ReplanDiff
          result={{
            feasible: false,
            applied: false,
            message: "No feasible alternative keeps locked stops and return-by. The current plan was left unchanged.",
            before: null,
            after: null,
            diff: null,
            bookings_mutated: false,
          }}
        />
      </LocaleProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("No feasible alternative");
  });
});
