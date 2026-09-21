import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthForm } from "./auth-form";
import { AuthProvider } from "@/components/shell/auth-provider";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { LEGAL_VERSIONS } from "@/lib/legal/types";

function renderSignIn() {
  return render(
    <LocaleProvider>
      <AuthProvider>
        <AuthForm mode="signin" />
      </AuthProvider>
    </LocaleProvider>,
  );
}

describe("auth form", () => {
  it("submits sign-in and does not include plaintext password in the heading", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url).includes("/me")) {
        return { ok: false, json: async () => ({}) };
      }
      return {
        ok: true,
        json: async () => ({ id: "1", email: "a@b.com", display_name: "Ada", locale: "en" }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    renderSignIn();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "long-enough-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const signInCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/signin"));
    expect(signInCall?.[1]).toMatchObject({ credentials: "include" });
    expect(screen.queryByText("long-enough-secret")).not.toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it("links guests to sign-up and forgot-password", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    renderSignIn();
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup?next=%2F");
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
    vi.unstubAllGlobals();
  });
});

describe("sign-up consent (MSHWAR-113)", () => {
  function renderSignUp() {
    return render(
      <LocaleProvider>
        <AuthProvider>
          <AuthForm mode="signup" />
        </AuthProvider>
      </LocaleProvider>,
    );
  }

  function fillSignUp() {
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Password", { exact: false }), { target: { value: "long-enough-secret" } });
  }

  it("needs the terms box ticked and never pre-ticks optional consent", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetchMock);
    renderSignUp();
    const terms = screen.getByRole("checkbox", { name: /I agree to the/ });
    expect(terms).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /personalise plans/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /travel ideas and offers/ })).not.toBeChecked();
    expect(screen.getByRole("link", { name: "terms of service" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "privacy policy" })).toHaveAttribute("href", "/privacy");

    fillSignUp();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please accept the terms of service");
    expect(terms).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock.mock.calls.some((call) => String((call as unknown[])[0]).includes("/register"))).toBe(false);
    vi.unstubAllGlobals();
  });

  it("sends the accepted versions and each optional choice separately", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url).includes("/me")) {
        return { ok: false, status: 401, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 201,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ id: "1", email: "ada@example.com", display_name: "Ada", locale: "en" }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    renderSignUp();
    fillSignUp();
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree to the/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /personalise plans/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/register"))).toBe(true));
    const call = fetchMock.mock.calls.find((entry) => String(entry[0]).includes("/register"));
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      accept_terms: true,
      policy_versions: { terms: LEGAL_VERSIONS.terms, privacy: LEGAL_VERSIONS.privacy },
      personalisation_consent: true,
      marketing_consent: false,
    });
    vi.unstubAllGlobals();
  });
});
