import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RouteError from "./error";
import { LocaleProvider } from "@/components/shell/locale-provider";

describe("route error boundary", () => {
  it("explains the failure and retries", () => {
    const retry = vi.fn();
    render(
      <LocaleProvider>
        <RouteError error={Object.assign(new Error("boom"), { digest: "abc123" })} retry={retry} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This page could not load.");
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
