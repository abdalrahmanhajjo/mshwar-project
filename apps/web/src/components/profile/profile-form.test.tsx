import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "./profile-form";
import { AuthProvider } from "@/components/shell/auth-provider";
import { LocaleProvider } from "@/components/shell/locale-provider";

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  };
}

describe("profile form", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves explicit preferences the user chose", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/auth/me")) {
        return jsonResponse({ id: "1", email: "a@b.com", display_name: "Ada", locale: "en" });
      }
      if (String(url).includes("/vocabularies")) {
        return jsonResponse({
          dietary: [{ kind: "dietary", slug: "vegetarian", label: "Vegetarian" }],
          accessibility: [],
          interest: [
            { kind: "interest", slug: "food", label: "Food" },
            { kind: "interest", slug: "heritage", label: "Heritage" },
          ],
          activity_intensity: [{ kind: "activity_intensity", slug: "moderate", label: "Moderate" }],
        });
      }
      if (String(url).includes("/locations/areas")) {
        return jsonResponse({
          source: "catalog",
          picker: "map",
          replace_with: "none",
          areas: [{ id: "area-1", slug: "beirut", name: "Beirut", country_code: "LB" }],
        });
      }
      if (String(url).includes("/profile") && init?.method === "PUT") {
        return jsonResponse({
          id: "1",
          email: "a@b.com",
          display_name: "Ada Lovelace",
          locale: "en",
          preferences: JSON.parse(String(init.body)).preferences,
          home_area: { id: "area-1", slug: "beirut", name: "Beirut", country_code: "LB" },
        });
      }
      return jsonResponse({
        id: "1",
        email: "a@b.com",
        display_name: "Ada",
        locale: "en",
        preferences: {
          source: "explicit",
          home_area_id: null,
          default_group_size: null,
          activity_intensity: null,
          dietary: [],
          accessibility: [],
          interests: [],
          start_location: null,
        },
        home_area: null,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <LocaleProvider>
        <AuthProvider>
          <ProfileForm />
        </AuthProvider>
      </LocaleProvider>,
    );

    await waitFor(() => expect(screen.getByLabelText("Display name")).toHaveValue("Ada"));
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Ada Lovelace" } });
    fireEvent.change(screen.getByLabelText("Default group size"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Vegetarian" }));
    fireEvent.click(screen.getByRole("button", { name: "Heritage" }));
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved. The next plan will use these defaults."),
    );
    const putCall = fetchMock.mock.calls.find((call) => call[1]?.method === "PUT");
    const payload = JSON.parse(String(putCall?.[1]?.body));
    expect(payload.display_name).toBe("Ada Lovelace");
    expect(payload.preferences.source).toBe("explicit");
    expect(payload.preferences.dietary).toEqual(["vegetarian"]);
    expect(payload.preferences.interests).toEqual(["heritage"]);
    expect(payload.preferences.default_group_size).toBe(3);
  });

  it("shows the saved home area after the catalog loads", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/auth/me")) {
        return jsonResponse({ id: "1", email: "a@b.com", display_name: "Ada", locale: "en" });
      }
      if (String(url).includes("/vocabularies")) {
        return jsonResponse({
          dietary: [],
          accessibility: [],
          interest: [],
          activity_intensity: [{ kind: "activity_intensity", slug: "moderate", label: "Moderate" }],
        });
      }
      if (String(url).includes("/locations/areas")) {
        return jsonResponse({
          source: "catalog",
          picker: "map",
          replace_with: "none",
          areas: [{ id: "area-1", slug: "beirut", name: "Beirut", country_code: "LB" }],
        });
      }
      return jsonResponse({
        id: "1",
        email: "a@b.com",
        display_name: "Ada",
        locale: "en",
        preferences: {
          source: "explicit",
          home_area_id: "area-1",
          default_group_size: 4,
          activity_intensity: "moderate",
          dietary: [],
          accessibility: [],
          interests: [],
          start_location: null,
        },
        home_area: { id: "area-1", slug: "beirut", name: "Beirut", country_code: "LB" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <LocaleProvider>
        <AuthProvider>
          <ProfileForm />
        </AuthProvider>
      </LocaleProvider>,
    );

    await waitFor(() => expect(screen.getByLabelText("Home or start area")).toHaveTextContent("Beirut"));
    expect(screen.getByLabelText("Default group size")).toHaveValue(4);
    expect(screen.getByLabelText("Activity intensity")).toHaveTextContent("Moderate");
  });
});
