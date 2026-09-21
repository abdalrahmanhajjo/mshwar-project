import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./sheet";
import { Toaster } from "./toaster";
import { useToast } from "@/hooks/use-toast";

export function OverlaySet() {
  const { toast } = useToast();
  return (
    <Toaster>
      <div className="flex flex-wrap gap-2 bg-surface p-4">
        <Dialog>
          <DialogTrigger asChild>
            <Button>Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Booking note</DialogTitle>
              <DialogDescription>Status is written in text, not colour alone.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary">Sheet</Button>
          </SheetTrigger>
          <SheetContent side="start">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription>Opens from inline-start in both LTR and RTL.</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">Popover</Button>
          </PopoverTrigger>
          <PopoverContent>Helpful context next to the control.</PopoverContent>
        </Popover>
        <Button onClick={() => toast({ title: "Saved", description: "Estimate stored." })}>Toast</Button>
      </div>
    </Toaster>
  );
}

const meta = {
  title: "Primitives/Overlays",
  component: OverlaySet,
  parameters: {
    a11y: { test: "error" },
  },
} satisfies Meta<typeof OverlaySet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LightLtr: Story = { globals: { theme: "light", direction: "ltr" } };
export const LightRtl: Story = { globals: { theme: "light", direction: "rtl" } };
export const DarkLtr: Story = { globals: { theme: "dark", direction: "ltr" } };
export const DarkRtl: Story = { globals: { theme: "dark", direction: "rtl" } };
