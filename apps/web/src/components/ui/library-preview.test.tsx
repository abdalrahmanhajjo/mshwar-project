import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LibraryPreview } from "./library-preview";
import { Combobox } from "./combobox";
import { DateRangePicker } from "./date-range-picker";
import { Rating } from "./rating";

describe("library interactions", () => {
  it("renders the core library in light and dark", () => {
    const { rerender } = render(
      <div className="dark">
        <LibraryPreview />
      </div>,
    );
    expect(screen.getByRole("heading", { name: "Trip details" })).toBeInTheDocument();
    rerender(
      <div dir="rtl">
        <LibraryPreview />
      </div>,
    );
    expect(screen.getByRole("heading", { name: "No trips yet" })).toBeInTheDocument();
  });

  it("opens a toast from the preview", () => {
    render(<LibraryPreview />);
    fireEvent.click(screen.getByRole("button", { name: "Show toast" }));
    expect(screen.getByText("Trip saved")).toBeInTheDocument();
  });

  it("filters combobox options", () => {
    render(
      <Combobox
        aria-label="City"
        options={[
          { value: "beirut", label: "Beirut" },
          { value: "tyre", label: "Tyre" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "City" }));
    fireEvent.change(screen.getByLabelText("Filter options"), { target: { value: "ty" } });
    expect(screen.getByRole("option", { name: "Tyre" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Tyre" }));
    expect(screen.queryByLabelText("Filter options")).not.toBeInTheDocument();
  });

  it("selects a combobox option with the keyboard", () => {
    const onValueChange = vi.fn();
    render(
      <Combobox
        aria-label="City"
        onValueChange={onValueChange}
        options={[
          { value: "beirut", label: "Beirut" },
          { value: "tyre", label: "Tyre" },
        ]}
      />,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "City" }), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByLabelText("Filter options"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByLabelText("Filter options"), { key: "Enter" });
    expect(onValueChange).toHaveBeenCalledWith("tyre");
  });

  it("updates a date range", () => {
    const onValueChange = vi.fn();
    render(<DateRangePicker onValueChange={onValueChange} value={{ start: "", end: "" }} />);
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-10-01" } });
    expect(onValueChange).toHaveBeenCalledWith({ start: "2026-10-01", end: "" });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-10-04" } });
    expect(onValueChange).toHaveBeenCalledWith({ start: "", end: "2026-10-04" });
  });

  it("changes rating with keyboard and click", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<Rating value={2} onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "4 stars" }));
    expect(onValueChange).toHaveBeenCalledWith(4);
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowRight" });
    expect(onValueChange).toHaveBeenCalledWith(3);
    rerender(
      <div dir="rtl">
        <Rating value={2} onValueChange={onValueChange} />
      </div>,
    );
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowRight" });
    expect(onValueChange).toHaveBeenCalledWith(1);
    rerender(<Rating value={2} readOnly />);
    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-readonly", "true");
  });
});
