import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookingGate } from "./booking-gate";
import { AuthProvider } from "@/components/shell/auth-provider";
import { LocaleProvider } from "@/components/shell/locale-provider";

function renderGate() {
  return render(
    <LocaleProvider>
      <AuthProvider>
        <BookingGate />
      </AuthProvider>
    </LocaleProvider>,
  );
}

describe("booking gate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("locks booking until the signed-in account is verified", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "1",
          email: "ada@example.com",
          display_name: "Ada",
          locale: "en",
          email_verified: false,
        }),
      }),
    );
    renderGate();
    await waitFor(() => {
      expect(screen.getByText("Unverified accounts can browse but cannot book.")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "Verify email" })).toHaveAttribute("href", "/verify-email");
  });
});
