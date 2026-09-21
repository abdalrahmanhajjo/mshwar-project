import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";

const meta = {
  title: "Primitives/Button",
  component: Button,
  parameters: {
    a11y: { test: "error" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LightLtr: Story = {
  args: { children: "Plan trip" },
  globals: { theme: "light", direction: "ltr" },
};
export const LightRtl: Story = {
  args: { children: "خطط الرحلة" },
  globals: { theme: "light", direction: "rtl" },
};
export const DarkLtr: Story = {
  args: { children: "Plan trip", variant: "accent" },
  globals: { theme: "dark", direction: "ltr" },
};
export const DarkRtl: Story = {
  args: { children: "إلغاء الحجز", variant: "destructive" },
  globals: { theme: "dark", direction: "rtl" },
};
export const Outline: Story = { args: { children: "Outline", variant: "outline" } };
