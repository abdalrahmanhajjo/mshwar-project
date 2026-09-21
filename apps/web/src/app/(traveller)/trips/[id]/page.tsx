import { GroupTripView } from "@/components/groups/group-trip-view";
import { ShellMain } from "@/components/shell/app-shell";

export default async function GroupTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ShellMain>
      <GroupTripView tripId={id} />
    </ShellMain>
  );
}
