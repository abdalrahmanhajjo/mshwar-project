import { TravellerShell } from "@/components/shell/app-shell";

export default function TravellerLayout({ children }: { children: React.ReactNode }) {
  return <TravellerShell>{children}</TravellerShell>;
}
