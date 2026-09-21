import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RequireAuth } from "./require-auth";
import { AuthProvider } from "@/components/shell/auth-provider";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { navigationMocks } from "@/test-mocks/next-navigation";

describe("RequireAuth", () => {
  it("redirects guests to sign-in with a safe next path", async () => {
    navigationMocks.pathname = "/plan";
    navigationMocks.replace = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    render(
      <LocaleProvider>
        <AuthProvider>
          <RequireAuth>
            <p>Protected itinerary</p>
          </RequireAuth>
        </AuthProvider>
      </LocaleProvider>,
    );

    expect(screen.queryByText("Protected itinerary")).not.toBeInTheDocument();
    await waitFor(() => expect(navigationMocks.replace).toHaveBeenCalledWith("/signin?next=%2Fplan"));

    vi.unstubAllGlobals();
    navigationMocks.pathname = "/";
  });

  it("keeps the locale prefix on the sign-in redirect", async () => {
    navigationMocks.pathname = "/plan";
    navigationMocks.replace = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    render(
      <LocaleProvider initialLocale="ar">
        <AuthProvider>
          <RequireAuth>
            <p>Protected itinerary</p>
          </RequireAuth>
        </AuthProvider>
      </LocaleProvider>,
    );

    await waitFor(() => expect(navigationMocks.replace).toHaveBeenCalledWith("/ar/signin?next=%2Fplan"));

    vi.unstubAllGlobals();
    navigationMocks.pathname = "/";
  });

  it("renders children once a session is confirmed", async () => {
    navigationMocks.replace = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "1", email: "a@b.com", display_name: "Ada", locale: "en" }),
      }),
    );

    render(
      <LocaleProvider>
        <AuthProvider>
          <RequireAuth>
            <p>Protected itinerary</p>
          </RequireAuth>
        </AuthProvider>
      </LocaleProvider>,
    );

    expect(await screen.findByText("Protected itinerary")).toBeInTheDocument();
    expect(navigationMocks.replace).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
