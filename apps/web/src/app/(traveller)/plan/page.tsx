import { PlanFlow } from "@/components/plan/plan-flow";
import { ShellMain } from "@/components/shell/app-shell";
import { loadCollection, loadDestinations } from "@/lib/catalogue-api";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const collectionSlug = typeof params.collection === "string" ? params.collection : "";
  const tripId = typeof params.trip === "string" ? params.trip : "";
  const addSlug = typeof params.add === "string" ? params.add : "";
  const addDestination = typeof params.destination === "string" ? params.destination : "";
  const [destinations, collection] = await Promise.all([
    loadDestinations(),
    collectionSlug ? loadCollection(collectionSlug) : Promise.resolve(undefined),
  ]);

  return (
    <ShellMain>
      <PlanFlow
        destinations={destinations}
        initialTripId={tripId || undefined}
        collectionTitle={collection?.title}
        addSlug={addSlug || undefined}
        addDestination={addDestination || undefined}
      />
    </ShellMain>
  );
}
