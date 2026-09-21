import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecoveryForm } from "./recovery-form";
import { AuthProvider } from "@/components/shell/auth-provider";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { navigationMocks } from "@/test-mocks/next-navigation";

function renderForgot() {
  return render(
    <LocaleProvider>
      <AuthProvider>
        <RecoveryForm mode="forgot" />
      </AuthProvider>
    </LocaleProvider>,
  );
}

function renderReset() {
  return render(
    <LocaleProvider>
      <AuthProvider>
        <RecoveryForm mode="reset" />
      </AuthProvider>
    </LocaleProvider>,
  );
}

describe("recovery form", () => {
  afterEach(() => {
    navigationMocks.search = "";
  });

  it("sends the same success copy after forgot-password", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url).includes("/me")) {
        return { ok: false, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    renderForgot();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "If an account exists for this address, a reset link has been sent.",
      ),
    );
    const forgotCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/forgot-password"));
    expect(forgotCall?.[1]).toMatchObject({ credentials: "include" });

    vi.unstubAllGlobals();
  });

  it("submits a reset token without rendering the new password", async () => {
    navigationMocks.search = "token=reset-token-value";
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

    renderReset();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "replacement-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/reset-password"))).toBe(true),
    );
    expect(screen.queryByText("replacement-secret")).not.toBeInTheDocument();
    const resetCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/reset-password"));
    const body = JSON.parse(String(resetCall?.[1]?.body)) as { token: string; password: string };
    expect(body.token).toBe("reset-token-value");
    expect(body).toHaveProperty("password");

    navigationMocks.search = "";
    vi.unstubAllGlobals();
  });

  it("shows an invalid state when the reset token is missing", () => {
    navigationMocks.search = "";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    renderReset();
    expect(screen.getByText("This reset link is invalid or has expired.")).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
