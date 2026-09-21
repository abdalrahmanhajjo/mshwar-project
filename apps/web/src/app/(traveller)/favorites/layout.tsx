import { RequireAuth } from "@/components/auth/require-auth";

export default function FavoritesLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
