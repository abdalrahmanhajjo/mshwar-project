/// <reference types="vitest-axe/extend-expect" />
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { CancellationPolicyView, CommunityGuidelinesView, PrivacyPolicyView, TermsView } from "./legal-views";
import { PolicyUpdateBanner } from "./policy-update-banner";
import { AuthProvider } from "@/components/shell/auth-provider";
import { LocaleProvider } from "@/components/shell/locale-provider";
import type { Locale } from "@/lib/locale";
import { LEGAL_VERSIONS, type LegalKind } from "@/lib/legal/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderIn(locale: Locale, view: React.ReactNode) {
  return render(<LocaleProvider initialLocale={locale}>{view}</LocaleProvider>);
}

describe("trust document pages (MSHWAR-113)", () => {
  it.each([
    ["terms", <TermsView key="t" />, "Terms of service"],
    ["privacy", <PrivacyPolicyView key="p" />, "Privacy policy"],
    ["cancellation", <CancellationPolicyView key="c" />, "Cancellation policy"],
    ["community", <CommunityGuidelinesView key="g" />, "Community guidelines"],
  ])("%s shows its version, a review notice and filled-in text", async (kind, view, title) => {
    const { container } = renderIn("en", view);
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText(/Draft pending legal review/)).toBeInTheDocument();
    expect(container.querySelector("time")?.getAttribute("dateTime")).toBe(LEGAL_VERSIONS[kind as LegalKind]);
    expect(container.textContent).not.toMatch(/\{(entity|address|contact)\}/);
    const related = screen.getByRole("navigation", { name: "Related documents" });
    expect(within(related).getAllByRole("link")).toHaveLength(3);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders Arabic and French text", () => {
    const ar = renderIn("ar", <CancellationPolicyView />);
    expect(screen.getByRole("heading", { level: 1, name: "سياسة الإلغاء" })).toBeInTheDocument();
    ar.unmount();
    renderIn("fr", <TermsView />);
    expect(screen.getByRole("heading", { level: 1, name: "Conditions d’utilisation" })).toBeInTheDocument();
  });

  it("privacy policy links to data controls and cookie settings, and lists every cookie", () => {
    renderIn("en", <PrivacyPolicyView />);
    expect(screen.getByRole("link", { name: /Manage your data/ })).toHaveAttribute("href", "/settings#privacy");
    expect(screen.getByRole("button", { name: "Cookie settings" })).toBeInTheDocument();
    for (const cookie of ["mshwar_session", "mshwar_guest", "mshwar-locale", "mshwar-consent"]) {
      expect(screen.getByText(new RegExp(cookie))).toBeInTheDocument();
    }
  });
});

describe("policy update banner", () => {
  function stubApi(policies: string[]) {
    let pending = policies;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/auth/me")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "1",
            email: "a@b.com",
            display_name: "Ada",
            locale: "en",
            policies_to_accept: pending,
          }),
        };
      }
      if (String(url).includes("/policies/accept")) {
        expect(JSON.parse(String(init?.body))).toEqual({
          versions: Object.fromEntries(policies.map((kind) => [kind, LEGAL_VERSIONS[kind as "terms"]])),
        });
        pending = [];
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({}),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("asks for acceptance of the exact versions shown and then goes away", async () => {
    const fetchMock = stubApi(["privacy", "terms"]);
    render(
      <LocaleProvider>
        <AuthProvider>
          <PolicyUpdateBanner />
        </AuthProvider>
      </LocaleProvider>,
    );
    const banner = await screen.findByRole("region", { name: /updated our terms/ });
    expect(within(banner).getByRole("link", { name: "terms of service" })).toHaveAttribute("href", "/terms");
    fireEvent.click(within(banner).getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: /updated our terms/ })).not.toBeInTheDocument());
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/policies/accept"))).toBe(true);
  });

  it("stays hidden when nothing is waiting", async () => {
    const fetchMock = stubApi([]);
    render(
      <LocaleProvider>
        <AuthProvider>
          <PolicyUpdateBanner />
        </AuthProvider>
      </LocaleProvider>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});
