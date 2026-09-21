import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleProvider, useLocale } from "./locale-provider";

function Probe() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div>
      <p>{locale}</p>
      <p>{t("language")}</p>
      <button type="button" onClick={() => setLocale("ar")}>
        To Arabic
      </button>
    </div>
  );
}

describe("LocaleProvider", () => {
  it("persists the guest locale on the mshwar-locale cookie", () => {
    render(
      <LocaleProvider initialLocale="en">
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByText("Language")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "To Arabic" }));
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
    expect(document.cookie).toContain("mshwar-locale=ar");
    expect(window.localStorage.getItem("mshwar-locale")).toBe("ar");
    expect(screen.getByText("اللغة")).toBeInTheDocument();
  });
});
