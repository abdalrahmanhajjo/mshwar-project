/**
 * Removes secrets and personal data from Sentry events before they leave the
 * browser or the Next.js server (MSHWAR-111). Mirrors the API's registry in
 * services/api/app/core/scrubber.py; both are covered by tests.
 */

export const REDACTED = "[redacted]";

export const SENSITIVE_FIELDS: Record<"credential" | "payment" | "personal", readonly string[]> = {
  credential: [
    "password",
    "new_password",
    "current_password",
    "secret",
    "client_secret",
    "token",
    "access_token",
    "refresh_token",
    "session_token",
    "api_key",
    "apikey",
    "authorization",
    "cookie",
    "set-cookie",
    "x-job-token",
    "mshwar_session",
    "mshwar_guest",
    "otp",
    "dsn",
  ],
  payment: [
    "card",
    "card_number",
    "cardnumber",
    "pan",
    "cvc",
    "cvv",
    "iban",
    "account_number",
    "payment_method",
    "payment_method_id",
    "payment_intent",
    "provider_reference",
    "customer_id",
    "last4",
  ],
  personal: [
    "email",
    "phone",
    "phone_number",
    "whatsapp",
    "full_name",
    "first_name",
    "last_name",
    "legal_name",
    "address",
    "date_of_birth",
    "dob",
    "national_id",
    "passport",
    "ip",
    "ip_address",
    "user_agent",
    "lat",
    "lng",
    "latitude",
    "longitude",
    "notes",
  ],
};

const FIELD_LOOKUP = new Map<string, string>(
  Object.entries(SENSITIVE_FIELDS).flatMap(([label, names]) => names.map((name) => [name, label] as const)),
);
const SAFE_FIELDS = new Set(["email_domain", "token_count", "key"]);
const SUFFIXES = ["_token", "_secret", "_password", "_email", "_phone", "_key"];

const EMAIL = /([A-Za-z0-9._%+-]{1,64})@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const PROVIDER_SECRET =
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{8,}|\bwhsec_[A-Za-z0-9]{8,}|\bpi_[A-Za-z0-9]+_secret_[A-Za-z0-9]+/g;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const BEARER = /\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const URL_SECRET_PATH = /(\/(?:unsubscribe|join|files|invitations|reset-password|verify-email)\/)[^/\s?#"']{12,}/g;
const QUERY_SECRET = /([?&](?:token|invite|code|signature|sig|key|password|secret|email)=)[^&\s#"']+/gi;
const CARD = /\b(?:\d[ -]?){12,18}\d\b/g;
const PHONE_INTL = /(?<![\w+-])\+\d{1,3}[ -]?(?:\d[ -]?){6,13}\d(?![\w-])/g;
const PHONE_LB = /(?<![\w+-])(?:0?3|7[0169]|81)[ -]?\d{3}[ -]?\d{3}(?![\w-])/g;

function luhn(digits: string): boolean {
  let total = 0;
  [...digits].reverse().forEach((char, index) => {
    let value = Number(char);
    if (index % 2 === 1) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    total += value;
  });
  return total % 10 === 0;
}

export function scrubText(value: string): string {
  return value
    .replace(PROVIDER_SECRET, "[redacted:secret]")
    .replace(JWT, "[redacted:token]")
    .replace(BEARER, (_, kind: string) => `${kind} ${REDACTED}`)
    .replace(URL_SECRET_PATH, (_, prefix: string) => `${prefix}${REDACTED}`)
    .replace(QUERY_SECRET, (_, prefix: string) => `${prefix}${REDACTED}`)
    .replace(CARD, (match) => {
      const digits = match.replace(/\D/g, "");
      return digits.length >= 13 && digits.length <= 19 && luhn(digits) ? "[redacted:card]" : match;
    })
    .replace(EMAIL, (_, __: string, domain: string) => `***@${domain}`)
    .replace(PHONE_INTL, "[redacted:phone]")
    .replace(PHONE_LB, "[redacted:phone]");
}

export function fieldClass(name: string): string | null {
  const lowered = name.toLowerCase().replace(/ /g, "_");
  if (SAFE_FIELDS.has(lowered)) return null;
  const direct = FIELD_LOOKUP.get(lowered);
  if (direct) return direct;
  const suffix = SUFFIXES.find((ending) => lowered.endsWith(ending));
  if (!suffix) return null;
  return suffix === "_email" || suffix === "_phone" ? "personal" : "credential";
}

export function scrub<T>(value: T, depth = 0): T {
  if (depth > 8) return REDACTED as T;
  if (typeof value === "string") return scrubText(value) as T;
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (Array.isArray(item) && item.length === 2 && typeof item[0] === "string" && fieldClass(item[0])) {
        return [item[0], REDACTED];
      }
      return scrub(item, depth + 1);
    }) as T;
  }
  if (value && typeof value === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const empty = item === null || item === undefined || item === "";
      cleaned[key] = fieldClass(key) && !empty ? REDACTED : scrub(item, depth + 1);
    }
    return cleaned as T;
  }
  return value;
}

type SentryLikeEvent = {
  request?: { cookies?: unknown; data?: unknown; headers?: Record<string, string>; [key: string]: unknown };
  user?: { id?: string | number; [key: string]: unknown };
  tags?: Record<string, unknown>;
  [key: string]: unknown;
};

export function scrubEvent<T extends SentryLikeEvent>(event: T): T {
  const copy: SentryLikeEvent = { ...event };
  if (copy.request) {
    const { cookies: _cookies, data, ...rest } = copy.request;
    copy.request = { ...rest, ...(data === undefined ? {} : { data: REDACTED }) };
  }
  if (copy.user) {
    copy.user = copy.user.id === undefined ? {} : { id: copy.user.id };
  }
  return scrub(copy) as T;
}

export function scrubBreadcrumb<T extends { data?: Record<string, unknown> }>(crumb: T): T {
  if (crumb.data && "http.query" in crumb.data) {
    const { "http.query": _query, ...data } = crumb.data;
    return scrub({ ...crumb, data });
  }
  return scrub(crumb);
}
