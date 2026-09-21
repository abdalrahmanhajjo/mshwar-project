import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleLink } from "./locale-link";
import { LocaleProvider } from "./locale-provider";

describe("LocaleLink", () => {
  it("prefixes internal hrefs for Arabic and French", () => {
    const { unmount } = render(
      <LocaleProvider initialLocale="ar">
        <LocaleLink href="/destinations?sort=name">Go</LocaleLink>
      </LocaleProvider>,
    );
    expect(screen.getByRole("link", { name: "Go" })).toHaveAttribute("href", "/ar/destinations?sort=name");
    unmount();

    render(
      <LocaleProvider initialLocale="fr">
        <LocaleLink href="/experiences">Go</LocaleLink>
      </LocaleProvider>,
    );
    expect(screen.getByRole("link", { name: "Go" })).toHaveAttribute("href", "/fr/experiences");
  });

  it("leaves English unprefixed and ignores external URLs", () => {
    render(
      <LocaleProvider initialLocale="en">
        <LocaleLink href="/destinations">In</LocaleLink>
        <LocaleLink href="https://maps.google.com">Out</LocaleLink>
      </LocaleProvider>,
    );
    expect(screen.getByRole("link", { name: "In" })).toHaveAttribute("href", "/destinations");
    expect(screen.getByRole("link", { name: "Out" })).toHaveAttribute("href", "https://maps.google.com");
  });
});
