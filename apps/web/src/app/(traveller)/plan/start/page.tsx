import { ShellMain } from "@/components/shell/app-shell";
import { StartLocationPicker } from "@/components/plan/start-location-picker";

export default function PlanStartPage() {
  return (
    <ShellMain>
      <StartLocationPicker standalone />
    </ShellMain>
  );
}
