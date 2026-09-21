import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlannerView, plannerErrorMessage } from "./planner-view";
import { ApiError } from "@/lib/api/client";
import { plannerCopy } from "@/lib/planner-copy";
import { LocaleProvider } from "@/components/shell/locale-provider";

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  };
}

const planned = {
  session_id: "sess-1",
  status: "planned",
  degraded: false,
  degraded_message: null,
  constraints: {},
  assumed_defaults: [{ field: "party_size", value: 2, label: "Party size 2" }],
  clarifications: [],
  plan: {
    trip_id: "trip-1",
    trip_title: "Plan · byblos",
    version_id: "ver-1",
    version: 1,
    origin: "ai",
    sealed_at: "2026-09-15T00:00:00Z",
    window_start: "2026-09-15T06:00:00Z",
    return_by: "2026-09-15T15:00:00Z",
    party_size: 2,
    budget_minor: 20000,
    currency: "USD",
    strict_budget: false,
    constraints: {},
    validation: {},
    stops: [
      {
        id: "stop-1",
        experience_id: "exp-1",
        position: 1,
        starts_at: "2026-09-15T07:00:00Z",
        ends_at: "2026-09-15T10:00:00Z",
        estimated_minor: 7000,
        price_kind: "estimate",
        locked: false,
        snapshot: {
          title: "A slow day in Byblos",
          explanation: "Included because it matches a relaxed pace.",
          flags: ["estimated_price"],
          price_source: "catalogue-seed",
        },
        title: "A slow day in Byblos",
        booking_mode: "request",
      },
    ],
    legs: [
      {
        position: 0,
        provider: "stub",
        distance_m: 1200,
        duration_seconds: 600,
        estimated_minor: 0,
        status: "available",
      },
    ],
    cost_items: [],
    total_minor: 7000,
  },
  llm_never_sets_totals: true,
};

describe("planner view", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clarifies then shows assumptions, timeline, cost and lock", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const path = String(url);
      if (path.endsWith("/planner/sessions") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { text: string };
        if (body.text.includes("something nice")) {
          return jsonResponse({
            session_id: "sess-1",
            status: "clarifying",
            degraded: false,
            degraded_message: null,
            constraints: {},
            assumed_defaults: [{ field: "party_size", value: 2, label: "Party size 2" }],
            clarifications: [{ field: "intent_anchor", prompt: "Which region or kind of day?", required: true }],
            plan: null,
          });
        }
      }
      if (path.includes("/clarify")) {
        return jsonResponse(planned);
      }
      if (path.includes("/versions")) {
        return jsonResponse([
          {
            version_id: "ver-1",
            version: 1,
            origin: "ai",
            sealed_at: "2026-09-15T00:00:00Z",
            created_at: "2026-09-15T00:00:00Z",
          },
        ]);
      }
      if (path.includes("/lock")) {
        const locked = structuredClone(planned);
        locked.plan.stops[0].locked = true;
        return jsonResponse(locked);
      }
      if (path.includes("/alternatives")) {
        return jsonResponse([
          {
            experience_id: "exp-2",
            slug: "harbour-lunch-byblos",
            title: "Harbour lunch",
            why_fit: ["preference=1.00"],
            sponsored: false,
          },
        ]);
      }
      if (path.includes("/replace/preview")) {
        return jsonResponse({
          preview_id: "pre-1",
          why_fit: ["preference=1.00"],
          title: "Harbour lunch",
          delta_cost_minor: -400,
          delta_minutes: -30,
          new_total_minor: 6600,
        });
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <LocaleProvider>
        <PlannerView />
      </LocaleProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText(/slow day in Byblos/i), {
      target: { value: "something nice maybe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Build plan" }));
    expect(await screen.findByText("Which region or kind of day?")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Answer and continue"), { target: { value: "Byblos" } });
    fireEvent.click(screen.getByRole("button", { name: "Answer and continue" }));
    expect(await screen.findByText("Assumed defaults")).toBeInTheDocument();
    expect(screen.getByText("Party size 2")).toBeInTheDocument();
    expect(screen.getByText("A slow day in Byblos")).toBeInTheDocument();
    expect(screen.getByText("Plan total")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lock stop" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it("shows degraded messaging", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/versions")) {
          return jsonResponse([]);
        }
        return jsonResponse({
          ...planned,
          degraded: true,
          degraded_message: "Natural-language planning is unavailable. This plan used structured filters only.",
        });
      }),
    );
    render(
      <LocaleProvider>
        <PlannerView />
      </LocaleProvider>,
    );
    fireEvent.change(screen.getByPlaceholderText(/slow day in Byblos/i), {
      target: { value: "a slow day in Byblos for two" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Build plan" }));
    expect(await screen.findByText(/Natural-language planning is unavailable/)).toBeInTheDocument();
  });
});

describe("planner limit messages", () => {
  it("translates quota and rate-limit errors", () => {
    const quota = new ApiError("x", 429, { code: "ai_quota_exceeded" });
    const busy = new ApiError("x", 429, { code: "ai_capacity_reached" });
    const fast = new ApiError("x", 429, { code: "rate_limited" });
    expect(plannerErrorMessage(quota, plannerCopy.ar)).toBe(plannerCopy.ar.aiQuotaExceeded);
    expect(plannerErrorMessage(busy, plannerCopy.fr)).toBe(plannerCopy.fr.aiCapacityReached);
    expect(plannerErrorMessage(fast, plannerCopy.en)).toBe(plannerCopy.en.rateLimited);
    expect(plannerErrorMessage(new ApiError("Stop not found", 404, {}), plannerCopy.en)).toBe("Stop not found");
    expect(plannerErrorMessage("boom", plannerCopy.en)).toBe(plannerCopy.en.updateError);
  });
});
