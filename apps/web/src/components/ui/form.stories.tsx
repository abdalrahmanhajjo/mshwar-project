import type { Meta, StoryObj } from "@storybook/react-vite";
import { Combobox } from "./combobox";
import { DateRangePicker } from "./date-range-picker";
import { Input } from "./input";
import { Label } from "./label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Slider } from "./slider";
import { Textarea } from "./textarea";

export function FormSet() {
  return (
    <form className="flex max-w-md flex-col gap-4 bg-surface p-4 text-text">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Guest name</Label>
        <Input id="name" defaultValue="Mira" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" defaultValue="Window seat if available." />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="city">City</Label>
        <Select defaultValue="beirut">
          <SelectTrigger id="city" aria-label="City">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="beirut">Beirut</SelectItem>
            <SelectItem value="tripoli">Tripoli</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Combobox
        aria-label="Activity"
        options={[
          { value: "hike", label: "Hike" },
          { value: "dine", label: "Dine" },
        ]}
        value="hike"
      />
      <DateRangePicker />
      <Slider defaultValue={[40]} aria-label="Radius" />
    </form>
  );
}

const meta = {
  title: "Primitives/Form",
  component: FormSet,
  parameters: {
    a11y: { test: "error" },
  },
} satisfies Meta<typeof FormSet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LightLtr: Story = { globals: { theme: "light", direction: "ltr" } };
export const LightRtl: Story = { globals: { theme: "light", direction: "rtl" } };
export const DarkLtr: Story = { globals: { theme: "dark", direction: "ltr" } };
export const DarkRtl: Story = { globals: { theme: "dark", direction: "rtl" } };
