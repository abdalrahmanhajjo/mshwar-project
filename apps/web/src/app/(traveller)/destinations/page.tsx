import type { Metadata } from "next";
import { DestinationsView } from "@/components/browse/destinations-view";
import { loadDestinations } from "@/lib/catalogue-api";

export const metadata: Metadata = {
  title: "Destinations — Where will you wander?",
  description: "Start with a place, then make the day your own.",
};

export default async function DestinationsPage() {
  return <DestinationsView destinations={await loadDestinations()} />;
}
