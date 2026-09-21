import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./auth-provider";
import { LocaleProvider } from "./locale-provider";
import { SignedInLocaleSync } from "./locale-sync";
import { navigationMocks } from "@/test-mocks/next-navigation";

describe("SignedInLocaleSync", () => {
  it("prefixes an unprefixed visit from the signed-in profile locale", async () => {
    navigationMocks.pathname = "/settings";
    navigationMocks.replace = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "1", email: "a@b.com", display_name: "Ada", locale: "ar" }),
      }),
    );

    render(
      <LocaleProvider initialLocale="en">
        <AuthProvider>
          <SignedInLocaleSync />
        </AuthProvider>
      </LocaleProvider>,
    );

    await waitFor(() => expect(navigationMocks.replace).toHaveBeenCalledWith("/ar/settings"));
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.cookie).toContain("mshwar-locale=ar");

    vi.unstubAllGlobals();
    navigationMocks.pathname = "/";
  });

  it("does not override a shareable prefixed URL", async () => {
    navigationMocks.pathname = "/fr/destinations";
    navigationMocks.replace = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "1", email: "a@b.com", display_name: "Ada", locale: "ar" }),
      }),
    );

    render(
      <LocaleProvider initialLocale="fr">
        <AuthProvider>
          <SignedInLocaleSync />
        </AuthProvider>
      </LocaleProvider>,
    );

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(navigationMocks.replace).not.toHaveBeenCalled();
    expect(document.documentElement.lang).toBe("fr");

    vi.unstubAllGlobals();
    navigationMocks.pathname = "/";
  });
});
