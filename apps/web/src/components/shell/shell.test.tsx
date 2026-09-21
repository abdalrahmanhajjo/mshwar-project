import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TravellerShell } from "./app-shell";
import { LocaleProvider } from "./locale-provider";
import { ShellPage } from "./shell-page";

function renderTraveller() {
  return render(
    <LocaleProvider>
      <TravellerShell currentPath="/">
        <ShellPage title="Discover Lebanon" description="Home" />
      </TravellerShell>
    </LocaleProvider>,
  );
}

describe("responsive app shells", () => {
  it("collapses navigation behind a menu control on the mobile pattern", () => {
    renderTraveller();
    const toggle = screen.getByRole("button", { name: "Open menu" });
    expect(toggle.closest("div")).toHaveClass("lg:hidden");
    fireEvent.click(toggle);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("link", { name: "Plan a trip" })).toBeInTheDocument();
  });

  it("flips document direction from the language switcher without a reload", () => {
    const hrefBefore = window.location.href;
    renderTraveller();
    expect(document.documentElement.dir).toBe("ltr");
    fireEvent.click(screen.getAllByRole("button", { name: "العربية" })[0]);
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.getAttribute("data-locale")).toBe("ar");
    expect(screen.getByRole("button", { name: "فتح القائمة" })).toBeInTheDocument();
    expect(window.location.href).toBe(hrefBefore);
  });

  it("keeps the shell inside 390px and 1440px frames without overflow classes", () => {
    const { container } = renderTraveller();
    const shell = container.querySelector("[data-shell='traveller']");
    expect(shell).toHaveClass("max-w-full", "min-w-0");
    expect(container.querySelector(".shell-frame")).toBeTruthy();
  });
});
