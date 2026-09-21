/// <reference types="vitest-axe/extend-expect" />
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { AuthForm } from "@/components/auth/auth-form";
import { PlanView } from "@/components/browse/plan-view";
import { PlannerView } from "@/components/planner/planner-view";
import { LocalizedShellPage } from "@/components/shell/localized-shell-page";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { AuthProvider } from "@/components/shell/auth-provider";
import { TravellerShell } from "@/components/shell/app-shell";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

afterEach(() => {
  vi.unstubAllGlobals();
});

async function expectAccessible(container: HTMLElement) {
  expect(await axe(container)).toHaveNoViolations();
}

describe("MSHWAR-107 axe-core on MVP pages", () => {
  it("plan, contact and sign-in stay accessible", async () => {
    const plan = render(
      <LocaleProvider>
        <TravellerShell currentPath="/plan">
          <PlanView />
          <PlannerView />
        </TravellerShell>
      </LocaleProvider>,
    );
    await expectAccessible(plan.container);
    plan.unmount();

    const contact = render(
      <LocaleProvider>
        <LocalizedShellPage titleKey="contactTitle" descriptionKey="contactBody" />
      </LocaleProvider>,
    );
    await expectAccessible(contact.container);
    contact.unmount();

    vi.stubGlobal("fetch", async () => ({ ok: false, json: async () => ({}) }));
    const signIn = render(
      <LocaleProvider>
        <AuthProvider>
          <AuthForm mode="signin" />
        </AuthProvider>
      </LocaleProvider>,
    );
    await expectAccessible(signIn.container);
  });

  it("associates field errors and keeps a visible focus target", async () => {
    const { container } = render(
      <LocaleProvider>
        <Field id="cancel-reason" label="Why are you cancelling?" error="This field is required.">
          <Input />
        </Field>
      </LocaleProvider>,
    );
    const input = screen.getByLabelText("Why are you cancelling?");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "cancel-reason-error");
    expect(screen.getByRole("alert")).toHaveTextContent("This field is required.");
    await expectAccessible(container);
  });

  it("keeps skip link and menu in tab order", () => {
    render(
      <LocaleProvider>
        <TravellerShell currentPath="/">
          <p>Page</p>
        </TravellerShell>
      </LocaleProvider>,
    );
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(skip).toHaveAttribute("href", "#main");
    expect(skip).not.toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("button", { name: "Open menu" })).not.toHaveAttribute("tabindex", "-1");
  });
});
