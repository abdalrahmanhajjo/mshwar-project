"use client";

import * as React from "react";
import { parseCookieChoices, rawConsentCookie, subscribeCookieChoices, type CookieChoices } from "@/lib/cookie-consent";

/** The cookie value the server saw, so the first render matches the browser. */
export const CookieConsentContext = React.createContext<string | null>(null);

/** Current choices, or null when the visitor hasn't chosen yet. */
export function useCookieChoices(): CookieChoices | null {
  const initial = React.useContext(CookieConsentContext);
  const raw = React.useSyncExternalStore(subscribeCookieChoices, rawConsentCookie, () => initial);
  return React.useMemo(() => parseCookieChoices(raw), [raw]);
}
