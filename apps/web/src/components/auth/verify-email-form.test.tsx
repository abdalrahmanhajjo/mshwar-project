import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VerifyEmailForm } from "./verify-email-form";
import { AuthProvider } from "@/components/shell/auth-provider";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { navigationMocks } from "@/test-mocks/next-navigation";

function renderForm() {
  return render(
    <LocaleProvider>
      <AuthProvider>
        <VerifyEmailForm />
      </AuthProvider>
    </LocaleProvider>,
  );
}

describe("verify email form", () => {
  afterEach(() => {
    navigationMocks.search = "";
  });

  it("confirms a token from the query string", async () => {
    navigationMocks.search = "token=verify-token-value";
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url).includes("/me")) {
        return { ok: false, json: async () => ({}) };
      }
      return {
        ok: true,
        json: async () => ({
          id: "1",
          email: "a@b.com",
          display_name: "Ada",
          locale: "en",
          email_verified: true,
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Your email is verified"));
    const verifyCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/verify-email"));
    expect(String(verifyCall?.[1]?.body)).toContain("verify-token-value");
    vi.unstubAllGlobals();
  });

  it("resends verification with the same success copy", async () => {
    navigationMocks.search = "";
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url).includes("/me")) {
        return { ok: false, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "If this address still needs verification, a new link has been sent.",
      ),
    );
    vi.unstubAllGlobals();
  });
});
