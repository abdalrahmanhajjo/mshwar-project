import type { Meta, StoryObj } from "@storybook/react-vite";
import { Compass } from "lucide-react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { EmptyState } from "./empty-state";
import { Price } from "./price";
import { Rating } from "./rating";

export function ContentSet() {
  return (
    <div className="flex max-w-md flex-col gap-4 bg-surface p-4 text-text">
      <Card>
        <CardHeader>
          <CardTitle>Byblos harbour</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge>Available</Badge>
            <Badge variant="warning">Pending</Badge>
            <Badge variant="danger">Cancelled</Badge>
          </div>
          <Rating value={5} readOnly label="Guest rating" />
          <Price amount={42} estimate period="night" />
        </CardContent>
      </Card>
      <EmptyState
        icon={<Compass className="size-8" aria-hidden />}
        title="Nothing saved"
        description="Saved places will appear here."
        action={<Button>Browse places</Button>}
      />
    </div>
  );
}

const meta = {
  title: "Primitives/Content",
  component: ContentSet,
  parameters: {
    a11y: { test: "error" },
  },
} satisfies Meta<typeof ContentSet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LightLtr: Story = { globals: { theme: "light", direction: "ltr" } };
export const LightRtl: Story = { globals: { theme: "light", direction: "rtl" } };
export const DarkLtr: Story = { globals: { theme: "dark", direction: "ltr" } };
export const DarkRtl: Story = { globals: { theme: "dark", direction: "rtl" } };
