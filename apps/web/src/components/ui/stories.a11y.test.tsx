/// <reference types="vitest-axe/extend-expect" />
import type { ComponentType } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Button } from "./button";
import { ContentSet } from "./content.stories";
import { FormSet } from "./form.stories";
import { LibraryPreview } from "./library-preview";
import { OverlaySet } from "./overlay.stories";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { TravellerShell } from "@/components/shell/app-shell";
import { ShellPage } from "@/components/shell/shell-page";

const snapshots = [
  { theme: "light", direction: "ltr" },
  { theme: "light", direction: "rtl" },
  { theme: "dark", direction: "ltr" },
  { theme: "dark", direction: "rtl" },
] as const;

const stories: Array<[string, ComponentType]> = [
  ["Primitives/Button", () => <Button>Plan trip</Button>],
  ["Primitives/Form", FormSet],
  ["Primitives/Overlays", OverlaySet],
  ["Primitives/Content", ContentSet],
  ["Library/Core primitives", LibraryPreview],
  [
    "Shell/Traveller",
    () => (
      <LocaleProvider>
        <TravellerShell currentPath="/">
          <ShellPage title="Discover" description="Home" />
        </TravellerShell>
      </LocaleProvider>
    ),
  ],
];

describe("axe-core on every story snapshot", () => {
  for (const [name, Story] of stories) {
    for (const snapshot of snapshots) {
      it(`${name} ${snapshot.theme} ${snapshot.direction}`, async () => {
        document.documentElement.classList.toggle("dark", snapshot.theme === "dark");
        document.documentElement.dir = snapshot.direction;
        const { container } = render(
          <div className={snapshot.theme === "dark" ? "dark" : undefined} dir={snapshot.direction}>
            <Story />
          </div>,
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });
    }
  }
});
