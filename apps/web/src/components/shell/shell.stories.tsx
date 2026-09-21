/**
 * MSHWAR-184: Visual compare against Figma 390px / 1440px frames is a later
 * manual designer step — this repo has no Figma API access. These stories lock
 * both breakpoints for browser QA (no horizontal scroll, mobile nav collapse).
 */
import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { TravellerShell } from "./app-shell";
import { LocaleProvider } from "./locale-provider";
import { ShellPage } from "./shell-page";

const VIEWPORTS = {
  mobile390: { name: "390px", styles: { width: "390px", height: "844px" } },
  desktop1440: { name: "1440px", styles: { width: "1440px", height: "900px" } },
};

function Frame({ children }: { children: ReactNode }) {
  return <LocaleProvider initialLocale="en">{children}</LocaleProvider>;
}

const meta = {
  title: "Shell/App surfaces",
  parameters: {
    layout: "fullscreen",
    a11y: { test: "error" },
    viewport: { options: VIEWPORTS },
    docs: {
      description: {
        component:
          "Traveller, business and admin shells share primitives. Figma frame compare at 390/1440 remains manual.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Traveller390: Story = {
  name: "Traveller 390",
  globals: { theme: "light", direction: "ltr" },
  parameters: { viewport: { defaultViewport: "mobile390" } },
  render: () => (
    <Frame>
      <TravellerShell currentPath="/">
        <ShellPage title="Discover Lebanon" description="Mobile traveller shell at 390px." />
      </TravellerShell>
    </Frame>
  ),
};

export const Traveller1440: Story = {
  name: "Traveller 1440",
  globals: { theme: "light", direction: "ltr" },
  parameters: { viewport: { defaultViewport: "desktop1440" } },
  render: () => (
    <Frame>
      <TravellerShell currentPath="/">
        <ShellPage title="Discover Lebanon" description="Desktop traveller shell at 1440px." />
      </TravellerShell>
    </Frame>
  ),
};

export const TravellerRtl390: Story = {
  name: "Traveller RTL 390",
  globals: { theme: "light", direction: "rtl" },
  parameters: { viewport: { defaultViewport: "mobile390" } },
  render: () => (
    <LocaleProvider initialLocale="ar">
      <TravellerShell currentPath="/">
        <ShellPage title="اكتشف لبنان" description="الغلاف المسافر بعرض 390px." />
      </TravellerShell>
    </LocaleProvider>
  ),
};
