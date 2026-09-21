import type { Meta, StoryObj } from "@storybook/react-vite";
import { LibraryPreview } from "./library-preview";

const meta = {
  title: "Library/Core primitives",
  component: LibraryPreview,
  parameters: {
    layout: "fullscreen",
    a11y: { test: "error" },
  },
} satisfies Meta<typeof LibraryPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LightLtr: Story = {
  globals: { theme: "light", direction: "ltr" },
};

export const LightRtl: Story = {
  globals: { theme: "light", direction: "rtl" },
};

export const DarkLtr: Story = {
  globals: { theme: "dark", direction: "ltr" },
};

export const DarkRtl: Story = {
  globals: { theme: "dark", direction: "rtl" },
};
