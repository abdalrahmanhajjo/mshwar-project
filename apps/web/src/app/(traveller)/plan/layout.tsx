import { RequireAuth } from "@/components/auth/require-auth";

export default function PlanLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
