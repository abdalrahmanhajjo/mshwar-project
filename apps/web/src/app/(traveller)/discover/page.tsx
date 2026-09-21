import type { Metadata } from "next";
import { DiscoverView } from "@/components/browse/discover-view";

export const metadata: Metadata = {
  title: "Discover — Find your kind of somewhere.",
  description: "Destinations, experiences, attractions, restaurants and a few ready-made days.",
};

export default function DiscoverPage() {
  return <DiscoverView />;
}
