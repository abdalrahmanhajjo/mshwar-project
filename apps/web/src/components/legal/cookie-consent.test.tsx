/// <reference types="vitest-axe/extend-expect" />
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { CookieConsent, CookieConsentProvider, CookieSettingsButton } from "./cookie-consent";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { CONSENT_COOKIE, readCookieChoices } from "@/lib/cookie-consent";

afterEach(() => {
  document.cookie = `${CONSENT_COOKIE}=; Path=/; Max-Age=0`;
});

function renderBanner(initial: string | null = null) {
  return render(
    <LocaleProvider>
      <CookieConsentProvider initial={initial}>
        <CookieSettingsButton />
        <CookieConsent />
      </CookieConsentProvider>
    </LocaleProvider>,
  );
}

describe("cookie banner (MSHWAR-113)", () => {
  it("asks first, offers refusal as prominently as acceptance, and saves essential only", async () => {
    const { container } = renderBanner();
    const banner = screen.getByRole("region", { name: "Cookies on Mshwar" });
    expect(banner).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    const refuse = screen.getByRole("button", { name: "Essential only" });
    const accept = screen.getByRole("button", { name: "Allow all" });
    expect(refuse.className).toBe(accept.className);
    fireEvent.click(refuse);
    expect(readCookieChoices()).toEqual({ errors: false, maps: false });
    expect(screen.queryByRole("region", { name: "Cookies on Mshwar" })).not.toBeInTheDocument();
  });

  it("lets people pick categories, and reopens from Cookie settings", async () => {
    renderBanner();
    fireEvent.click(screen.getByRole("button", { name: "Choose" }));
    expect(screen.getByRole("switch", { name: "Essential" })).toBeDisabled();
    const maps = screen.getByRole("switch", { name: "Maps and embedded content" });
    expect(maps).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Error reporting" })).not.toBeChecked();
    fireEvent.click(maps);
    fireEvent.click(screen.getByRole("button", { name: "Save choices" }));
    expect(readCookieChoices()).toEqual({ errors: false, maps: true });
    expect(screen.queryByRole("region", { name: "Cookies on Mshwar" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cookie settings" }));
    expect(await screen.findByRole("switch", { name: "Maps and embedded content" })).toBeChecked();
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it("stays hidden when the visitor has already chosen", () => {
    document.cookie = `${CONSENT_COOKIE}=v1.e0.m0; Path=/`;
    renderBanner("v1.e0.m0");
    expect(screen.queryByRole("region", { name: "Cookies on Mshwar" })).not.toBeInTheDocument();
  });
});
