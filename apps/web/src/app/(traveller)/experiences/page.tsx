import type { Metadata } from "next";
import { Suspense } from "react";
import { ExperiencesSkeleton } from "@/components/browse/experiences-skeleton";
import { ExperiencesView } from "@/components/browse/experiences-view";
import { loadExperiencePage, loadMapListings } from "@/lib/catalogue-api";
import { parseExperienceFilters } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Experiences — A whole country. Your next discovery.",
  description: "Big adventures, little escapes, and everything in between.",
};

export default async function ExperiencesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseExperienceFilters(params);
  const page = await loadExperiencePage(filters);
  const mapItems = filters.view === "map" ? await loadMapListings(filters) : page.items;

  return (
    <Suspense fallback={<ExperiencesSkeleton />}>
      <ExperiencesView filters={filters} page={page} mapItems={mapItems} />
    </Suspense>
  );
}
