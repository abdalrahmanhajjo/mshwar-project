/// <reference types="vitest-axe/extend-expect" />
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Compass } from "lucide-react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Combobox } from "./combobox";
import { DateRangePicker } from "./date-range-picker";
import { EmptyState } from "./empty-state";
import { Input } from "./input";
import { Label } from "./label";
import { LibraryPreview } from "./library-preview";
import { Price } from "./price";
import { Rating } from "./rating";
import { Slider } from "./slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Textarea } from "./textarea";

async function expectAccessible(container: HTMLElement) {
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}

describe("axe-core on core primitives", () => {
  it("library preview", async () => {
    const { container } = render(<LibraryPreview />);
    await expectAccessible(container);
  });

  it("button", async () => {
    const { container } = render(<Button>Plan trip</Button>);
    await expectAccessible(container);
  });

  it("labelled input and textarea", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="guest">Guest</Label>
        <Input id="guest" />
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" />
      </div>,
    );
    await expectAccessible(container);
  });

  it("combobox", async () => {
    const { container } = render(
      <Combobox aria-label="City" options={[{ value: "beirut", label: "Beirut" }]} value="beirut" />,
    );
    await expectAccessible(container);
  });

  it("date range", async () => {
    const { container } = render(<DateRangePicker />);
    await expectAccessible(container);
  });

  it("slider", async () => {
    const { container } = render(<Slider defaultValue={[20]} aria-label="Budget" />);
    await expectAccessible(container);
  });

  it("tabs", async () => {
    const { container } = render(
      <Tabs defaultValue="one">
        <TabsList aria-label="Sections">
          <TabsTrigger value="one">One</TabsTrigger>
        </TabsList>
        <TabsContent value="one">Panel</TabsContent>
      </Tabs>,
    );
    await expectAccessible(container);
  });

  it("content primitives", async () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Stay</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge>Available</Badge>
          <Rating value={4} readOnly label="Score" />
          <Price amount={20} estimate />
          <EmptyState icon={<Compass aria-hidden />} title="Empty" description="Nothing here." />
        </CardContent>
      </Card>,
    );
    await expectAccessible(container);
  });
});
