import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { EmptyState } from "./empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Price } from "./price";
import { Progress } from "./progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Separator } from "./separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./sheet";
import { Skeleton } from "./skeleton";
import { Slider } from "./slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Textarea } from "./textarea";
import { Toaster } from "./toaster";
import { useToast } from "@/hooks/use-toast";

function ToastProbe() {
  const { toast, dismiss, toasts } = useToast();
  return (
    <div>
      <button type="button" onClick={() => toast({ title: "Saved", description: "Stored.", variant: "danger" })}>
        Notify
      </button>
      {toasts.map((item) => (
        <button key={item.id} type="button" onClick={() => dismiss(item.id)}>
          Dismiss {item.title}
        </button>
      ))}
    </div>
  );
}

describe("content and overlay primitives", () => {
  it("renders button variants and asChild", () => {
    render(
      <div>
        <Button variant="accent">Accent</Button>
        <Button variant="ghost" size="sm">
          Ghost
        </Button>
        <Button asChild>
          <a href="#plan">As link</a>
        </Button>
      </div>,
    );
    expect(screen.getByRole("button", { name: "Accent" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "As link" })).toHaveAttribute("href", "#plan");
  });

  it("renders card, badge, price, empty state, and skeleton", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Stay</CardTitle>
          <CardDescription>Guesthouse</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="success">Open</Badge>
          <Badge variant="outline">Cash</Badge>
          <Price amount={12} />
          <EmptyState title="None" />
          <Skeleton data-testid="skeleton" />
          <Separator />
        </CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );
    expect(screen.getByText("$12.00")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "None" })).toBeInTheDocument();
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("opens a dialog", () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm</DialogTitle>
            <DialogDescription>Estimate only.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));
    expect(screen.getByRole("heading", { name: "Confirm" })).toBeInTheDocument();
  });

  it("fills progress from inline-start so RTL mirrors the bar", () => {
    render(<Progress value={40} label="Day stops" />);
    const bar = screen.getByRole("progressbar", { name: "Day stops" });
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar.firstElementChild).toHaveClass("start-0");
  });

  it("opens a sheet from inline-start", () => {
    render(
      <Sheet>
        <SheetTrigger asChild>
          <Button>Open sheet</Button>
        </SheetTrigger>
        <SheetContent side="start">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Narrow results.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open sheet" }));
    expect(screen.getByRole("heading", { name: "Filters" })).toBeInTheDocument();
  });

  it("opens a popover", () => {
    render(
      <Popover>
        <PopoverTrigger asChild>
          <Button>Open popover</Button>
        </PopoverTrigger>
        <PopoverContent>Hint</PopoverContent>
      </Popover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open popover" }));
    expect(screen.getByText("Hint")).toBeInTheDocument();
  });

  it("changes tabs and keeps labelled controls", () => {
    render(
      <div>
        <Tabs defaultValue="stay">
          <TabsList aria-label="Trip sections">
            <TabsTrigger value="stay">Stay</TabsTrigger>
            <TabsTrigger value="food">Food</TabsTrigger>
          </TabsList>
          <TabsContent value="stay">Hotels</TabsContent>
          <TabsContent value="food">Meals</TabsContent>
        </Tabs>
        <Select defaultValue="beirut">
          <SelectTrigger aria-label="Region">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="beirut">Beirut</SelectItem>
            <SelectItem value="south">South</SelectItem>
          </SelectContent>
        </Select>
        <Textarea aria-label="Notes" defaultValue="Hello" />
        <Slider defaultValue={[10, 40]} aria-label="Range" />
      </div>,
    );
    expect(screen.getByRole("tab", { name: "Stay" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Hotels")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue("Hello");
    expect(screen.getByRole("slider", { name: "Range handle 1" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Range handle 2" })).toBeInTheDocument();
  });

  it("shows and dismisses a toast", () => {
    render(
      <Toaster>
        <ToastProbe />
      </Toaster>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Notify" }));
    expect(screen.getByText("Saved")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss Saved" }));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("no-ops toast helpers outside a provider", () => {
    function Orphan() {
      const { toast, dismiss } = useToast();
      toast({ title: "Nope" });
      dismiss("missing");
      return <span>orphan</span>;
    }
    render(<Orphan />);
    expect(screen.getByText("orphan")).toBeInTheDocument();
  });
});
