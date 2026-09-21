"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/shell/auth-provider";
import { useLocale } from "@/components/shell/locale-provider";
import { safeNextPath } from "@/lib/auth";
import { withLocalePrefix } from "@/lib/locale";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const { locale } = useLocale();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const params = useSearchParams();
  const search = params.toString();
  const nextPath = safeNextPath(search ? `${pathname}?${search}` : pathname);

  React.useEffect(() => {
    if (!ready || user) {
      return;
    }
    router.replace(withLocalePrefix(locale, `/signin?next=${encodeURIComponent(nextPath)}`));
  }, [locale, nextPath, ready, router, user]);

  if (!ready || !user) {
    return null;
  }
  return children;
}
