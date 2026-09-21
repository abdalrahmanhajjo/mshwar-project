"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/shell/auth-provider";
import { useLocale } from "@/components/shell/locale-provider";
import { isLocale, splitLocalePrefix, withLocalePrefix } from "@/lib/locale";

/**
 * Apply the signed-in profile locale once when the session loads.
 * A prefixed URL always wins so a shared /fr/... link stays French.
 */
export function SignedInLocaleSync() {
  const { user } = useAuth();
  const { locale, setLocale } = useLocale();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const applied = React.useRef(false);

  React.useEffect(() => {
    if (applied.current || !user || !isLocale(user.locale)) {
      return;
    }
    applied.current = true;
    const browserPath = typeof window !== "undefined" ? window.location.pathname : pathname;
    const prefix = splitLocalePrefix(browserPath).locale ?? splitLocalePrefix(pathname).locale;
    if (prefix || user.locale === locale) {
      return;
    }
    setLocale(user.locale);
    const search = typeof window !== "undefined" ? window.location.search : "";
    router.replace(withLocalePrefix(user.locale, `${pathname}${search}`));
  }, [locale, pathname, router, setLocale, user]);

  return null;
}
