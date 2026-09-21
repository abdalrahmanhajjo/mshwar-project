"use client";

import * as React from "react";
import { translate } from "@/i18n/translate";
import { applyDocumentLocale, LOCALE_COOKIE, type Locale, parseLocale } from "@/lib/locale";
import { messages, type MessageKey } from "@/lib/messages";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
}

const LocaleContext = React.createContext<LocaleContextValue | null>(null);

function persistLocale(locale: Locale) {
  applyDocumentLocale(locale);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LOCALE_COOKIE, locale);
    document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
}

export function LocaleProvider({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = React.useState<Locale>(parseLocale(initialLocale));

  React.useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  const setLocale = React.useCallback((next: Locale) => {
    const parsed = parseLocale(next);
    setLocaleState(parsed);
    persistLocale(parsed);
  }, []);

  const t = React.useCallback((key: MessageKey) => translate(messages, locale, key), [locale]);

  const value = React.useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = React.useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}
