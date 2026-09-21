export const LOCALES = ["en", "ar", "fr"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "mshwar-locale";

export const LOCALE_HEADER = "x-mshwar-locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
  fr: "Français",
};

export const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  en: "EN",
  ar: "AR",
  fr: "FR",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function parseLocale(value: string | undefined | null, fallback: Locale = "en"): Locale {
  return isLocale(value) ? value : fallback;
}

export function localeDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function applyDocumentLocale(locale: Locale) {
  if (typeof document === "undefined") {
    return;
  }
  const direction = localeDirection(locale);
  document.documentElement.lang = locale;
  document.documentElement.dir = direction;
  document.documentElement.setAttribute("data-locale", locale);
}

export function splitLocalePrefix(pathname: string): { locale: Locale | null; pathname: string } {
  const match = pathname.match(/^\/(en|ar|fr)(?=\/|$)/);
  if (!match || !isLocale(match[1])) {
    return { locale: null, pathname: pathname || "/" };
  }
  const rest = pathname.slice(match[0].length);
  return { locale: match[1], pathname: rest === "" ? "/" : rest };
}

export function withLocalePrefix(locale: Locale, href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) {
    return href;
  }
  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const queryIndex = withoutHash.indexOf("?");
  const search = queryIndex >= 0 ? withoutHash.slice(queryIndex) : "";
  const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const stripped = splitLocalePrefix(path).pathname;
  if (locale === DEFAULT_LOCALE) {
    return `${stripped}${search}${hash}`;
  }
  const suffix = stripped === "/" ? "" : stripped;
  return `/${locale}${suffix}${search}${hash}`;
}
