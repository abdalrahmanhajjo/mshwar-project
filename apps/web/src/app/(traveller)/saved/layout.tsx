import { RequireAuth } from "@/components/auth/require-auth";

export default function SavedLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
