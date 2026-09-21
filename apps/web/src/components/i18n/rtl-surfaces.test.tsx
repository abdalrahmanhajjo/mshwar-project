/// <reference types="vitest-axe/extend-expect" />
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlanView } from "@/components/browse/plan-view";
import { PlannerView } from "@/components/planner/planner-view";
import { ExperiencesMap } from "@/components/browse/experiences-map";
import { LocalizedShellPage } from "@/components/shell/localized-shell-page";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { TravellerShell } from "@/components/shell/app-shell";
import { Carousel } from "@/components/ui/carousel";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Progress } from "@/components/ui/progress";
import { EXPERIENCES } from "@/lib/catalog";

function wrap(ui: ReactNode, width: number) {
  document.documentElement.dir = "rtl";
  document.documentElement.lang = "ar";
  return (
    <div data-viewport={width} style={{ width }}>
      <LocaleProvider initialLocale="ar">{ui}</LocaleProvider>
    </div>
  );
}

describe("MSHWAR-105 Arabic RTL surfaces", () => {
  it.each([390, 1440] as const)("shell, plan and legal pages stay RTL at %ipx", (width) => {
    const { container } = render(
      wrap(
        <TravellerShell currentPath="/plan">
          <PlanView collectionTitle="Coast calling" stopCount={3} tripId="trip-1" />
          <PlannerView initialTripId="trip-1" />
          <LocalizedShellPage titleKey="contactTitle" descriptionKey="contactBody" />
        </TravellerShell>,
        width,
      ),
    );
    expect(container.querySelector("[data-shell='traveller']")).toHaveAttribute("dir", "rtl");
    expect(screen.getByText(/Coast calling/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "منشئ الرحلة" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "تواصل" })).toBeInTheDocument();
    expect(container.querySelector("[data-viewport]")?.getAttribute("data-viewport")).toBe(String(width));
  });

  it("mirrors progress, carousel and date pickers in RTL", () => {
    const { container } = render(
      wrap(
        <>
          <Progress value={40} label="تقدم" />
          <Carousel label="أيام" previousLabel="السابق" nextLabel="التالي">
            <div>واحد</div>
            <div>اثنان</div>
          </Carousel>
          <DateRangePicker startLabel="بداية" endLabel="نهاية" legend="تواريخ" />
        </>,
        390,
      ),
    );
    expect(container.querySelector("[role='progressbar']")?.firstElementChild).toHaveClass("start-0");
    expect(container.querySelector("[data-rtl-datepicker]")).toHaveAttribute("dir", "inherit");
    expect(screen.getByRole("button", { name: "السابق" })).toBeInTheDocument();
    expect(screen.getByLabelText("بداية")).toBeInTheDocument();
  });

  it("keeps map pins logical and isolates Latin place names", () => {
    const { container } = render(
      wrap(<ExperiencesMap items={EXPERIENCES.slice(0, 2)} onSearchArea={() => undefined} />, 1440),
    );
    expect(container.querySelector(".text-start")).toBeTruthy();
    expect(container.querySelector("[dir='ltr']")).toBeTruthy();
  });
});
