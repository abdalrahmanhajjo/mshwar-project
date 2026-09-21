import { RequireAuth } from "@/components/auth/require-auth";

export default function TripsLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
