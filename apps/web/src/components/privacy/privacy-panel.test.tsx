import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrivacyPanel } from "./privacy-panel";
import { AuthProvider } from "@/components/shell/auth-provider";
import { LocaleProvider } from "@/components/shell/locale-provider";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    blob: async () => new Blob([JSON.stringify(body)], { type: "application/json" }),
  };
}

describe("privacy panel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exports data and requires DELETE before anonymising", async () => {
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:export",
      revokeObjectURL: () => undefined,
    });

    let consent = false;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/auth/me")) {
        return jsonResponse({ id: "1", email: "a@b.com", display_name: "Ada", locale: "en" });
      }
      if (String(url).includes("/privacy/export")) {
        return jsonResponse({ profile: { email: "a@b.com" }, trips: [], favorites: [], reviews: [], bookings: [] });
      }
      if (String(url).includes("/privacy/consents")) {
        const body = init?.body ? (JSON.parse(String(init.body)) as { personalisation?: boolean }) : {};
        consent = body.personalisation ?? consent;
        return jsonResponse({
          personalisation: consent,
          marketing_email: false,
          marketing_in_app: false,
          policies: {},
          history: [],
        });
      }
      if (String(url).includes("/privacy/reset-personalisation")) {
        consent = false;
        return jsonResponse({ ok: true, identity_kept: true, bookings_kept: true, preferences: {} });
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <LocaleProvider>
        <AuthProvider>
          <PrivacyPanel />
        </AuthProvider>
      </LocaleProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Your data" })).toBeInTheDocument();
    expect(screen.getByText(/Bookings and payments are never silently deleted/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download my data" }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/privacy/export"))).toBe(true),
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset personalisation" }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/reset-personalisation"))).toBe(true),
    );

    const personalise = await screen.findByRole("switch", { name: "Personalise my plans" });
    expect(personalise).not.toBeChecked();
    fireEvent.click(personalise);
    expect(await screen.findByText("Personalisation is on.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("switch", { name: "Personalise my plans" })).toBeChecked());

    const deleteButton = screen.getByRole("button", { name: "Anonymise my account" });
    expect(deleteButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), { target: { value: "DELETE" } });
    expect(deleteButton).toBeEnabled();
  });
});
