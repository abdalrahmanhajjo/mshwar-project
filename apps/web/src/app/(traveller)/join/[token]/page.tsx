import { JoinTripView } from "@/components/groups/group-trip-view";
import { ShellMain } from "@/components/shell/app-shell";

export default async function JoinTripPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <ShellMain>
      <JoinTripView token={token} />
    </ShellMain>
  );
}
