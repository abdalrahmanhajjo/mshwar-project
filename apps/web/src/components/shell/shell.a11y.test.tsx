/// <reference types="vitest-axe/extend-expect" />
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { TravellerShell } from "./app-shell";
import { LocaleProvider } from "./locale-provider";
import { ShellPage } from "./shell-page";

async function expectAccessible(container: HTMLElement) {
  expect(await axe(container)).toHaveNoViolations();
}

describe("axe-core on app shells", () => {
  it("traveller shell", async () => {
    const { container } = render(
      <LocaleProvider>
        <TravellerShell currentPath="/">
          <ShellPage title="Discover" description="Home" />
        </TravellerShell>
      </LocaleProvider>,
    );
    await expectAccessible(container);
  });

  it("arabic traveller snapshot", async () => {
    const { container } = render(
      <LocaleProvider initialLocale="ar">
        <TravellerShell currentPath="/">
          <ShellPage title="اكتشف" description="الصفحة الرئيسية" />
        </TravellerShell>
      </LocaleProvider>,
    );
    await expectAccessible(container);
  });
});
