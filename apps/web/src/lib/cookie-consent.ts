/**
 * Cookie choices (MSHWAR-113). Nothing optional runs until the visitor allows it:
 * no cookie, or an unreadable one, means essential cookies only.
 */
export const CONSENT_COOKIE = "mshwar-consent";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const CHANGE_EVENT = "mshwar:cookie-consent";
const OPEN_EVENT = "mshwar:cookie-settings";

export type CookieChoices = {
  /** Browser error reporting (Sentry). */
  errors: boolean;
  /** Google Maps and other embedded third-party content. */
  maps: boolean;
};

export const ESSENTIAL_ONLY: CookieChoices = { errors: false, maps: false };
export const ALLOW_ALL: CookieChoices = { errors: true, maps: true };

/** `v1.e1.m0` — versioned so a new category can ask again instead of assuming yes. */
export function parseCookieChoices(value: string | null | undefined): CookieChoices | null {
  const match = /^v1\.e([01])\.m([01])$/.exec(value ?? "");
  if (!match) {
    return null;
  }
  return { errors: match[1] === "1", maps: match[2] === "1" };
}

export function serializeCookieChoices(choices: CookieChoices): string {
  return `v1.e${choices.errors ? 1 : 0}.m${choices.maps ? 1 : 0}`;
}

export function rawConsentCookie(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  for (const part of document.cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === CONSENT_COOKIE) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

export function readCookieChoices(): CookieChoices | null {
  return parseCookieChoices(rawConsentCookie());
}

export function writeCookieChoices(choices: CookieChoices): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${serializeCookieChoices(choices)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeCookieChoices(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

/** Opens the cookie panel from anywhere (the footer link). */
export function openCookieSettings(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onOpenCookieSettings(listener: () => void): () => void {
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}
