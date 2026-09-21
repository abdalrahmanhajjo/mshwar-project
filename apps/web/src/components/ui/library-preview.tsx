"use client";

import * as React from "react";
import { Compass } from "lucide-react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";
import { Combobox } from "./combobox";
import { DateRangePicker } from "./date-range-picker";
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
import { Input } from "./input";
import { Label } from "./label";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Price } from "./price";
import { Rating } from "./rating";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./sheet";
import { Slider } from "./slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Toaster } from "./toaster";
import { useToast } from "@/hooks/use-toast";

const destinations = [
  { value: "beirut", label: "Beirut" },
  { value: "byblos", label: "Byblos" },
  { value: "tyre", label: "Tyre" },
];

function ToastDemo() {
  const { toast } = useToast();
  return (
    <Button
      onClick={() =>
        toast({
          title: "Trip saved",
          description: "Your Lebanon itinerary estimate is ready.",
        })
      }
    >
      Show toast
    </Button>
  );
}

export function LibraryPreview() {
  const [rating, setRating] = React.useState(4);
  const [range, setRange] = React.useState({ start: "2026-09-20", end: "2026-09-24" });
  const [place, setPlace] = React.useState("beirut");
  const [budget, setBudget] = React.useState([120]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 bg-surface p-6 text-text">
      <section className="flex flex-wrap gap-2">
        <Button>Plan trip</Button>
        <Button variant="accent">Accent</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="destructive">Cancel booking</Button>
        <Badge>Confirmed</Badge>
        <Badge variant="warning">Pending</Badge>
        <Badge variant="danger">Cancelled</Badge>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Trip details</CardTitle>
          <CardDescription>Form primitives used across discovery and booking.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="party">Party size</Label>
            <Input id="party" defaultValue="2 adults" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="region">Region</Label>
            <Select defaultValue="beirut">
              <SelectTrigger id="region" aria-label="Region">
                <SelectValue placeholder="Choose a region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beirut">Beirut</SelectItem>
                <SelectItem value="north">North</SelectItem>
                <SelectItem value="south">South</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="destination">Destination</Label>
            <Combobox id="destination" options={destinations} value={place} onValueChange={setPlace} />
          </div>
          <DateRangePicker value={range} onValueChange={setRange} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="budget">Budget</Label>
            <Slider id="budget" max={400} step={10} value={budget} onValueChange={setBudget} aria-label="Budget" />
          </div>
          <Rating value={rating} onValueChange={setRating} label="Place rating" />
          <Price amount={86} currency="USD" estimate period="day" />
        </CardContent>
        <CardFooter>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm estimate</DialogTitle>
                <DialogDescription>This is an estimate, not a confirmed booking.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline">Keep editing</Button>
                <Button>Continue</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary">Open sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription>Narrow results without leaving the page.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost">Open popover</Button>
            </PopoverTrigger>
            <PopoverContent>Dates stay estimates until booked.</PopoverContent>
          </Popover>
        </CardFooter>
      </Card>

      <Tabs defaultValue="stay">
        <TabsList aria-label="Trip sections">
          <TabsTrigger value="stay">Stay</TabsTrigger>
          <TabsTrigger value="food">Food</TabsTrigger>
        </TabsList>
        <TabsContent value="stay">Hotel and guesthouse options.</TabsContent>
        <TabsContent value="food">Restaurants from the structured inventory.</TabsContent>
      </Tabs>

      <EmptyState
        icon={<Compass className="size-8" aria-hidden />}
        title="No trips yet"
        description="Start from a destination, dates and party size. We will not invent businesses."
        action={<Button>Create a trip</Button>}
      />

      <Toaster>
        <ToastDemo />
      </Toaster>
    </div>
  );
}
