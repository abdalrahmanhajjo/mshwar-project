import { apiRequest } from "@/lib/api/client";

export const SESSION_COOKIE = "mshwar_session";

export type AuthUser = {
  id: string;
  email: string;
  display_name: string;
  locale: string;
  email_verified?: boolean;
  admin_tier?: "ops" | "elevated" | null;
  /** Trust documents with a newer version the person has not accepted yet (MSHWAR-113). */
  policies_to_accept?: string[];
};

export const PROTECTED_PATHS = [
  /^\/plan(?:\/|$)/,
  /^\/saved(?:\/|$)/,
  /^\/trips(?:\/|$)/,
  /^\/favorites(?:\/|$)/,
  /^\/bookings(?:\/|$)/,
  /^\/notifications(?:\/|$)/,
  /^\/settings(?:\/|$)/,
  /^\/business(?:\/|$)/,
  /^\/admin(?:\/|$)/,
];

export function isProtectedPath(pathname: string): boolean {
  const current = pathname.replace(/^\/(en|ar|fr)(?=\/|$)/, "") || "/";
  return PROTECTED_PATHS.some((pattern) => pattern.test(current));
}

export function isAdminUser(user: AuthUser | null | undefined): boolean {
  return user?.admin_tier === "ops" || user?.admin_tier === "elevated";
}

const SAFE_NEXT_BASE = "https://mshwar.invalid";

/** Only same-site paths are allowed after sign-in; anything that parses to another origin falls back to "/". */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) {
    return "/";
  }
  try {
    const url = new URL(value, SAFE_NEXT_BASE);
    if (url.origin !== SAFE_NEXT_BASE) {
      return "/";
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch("/api/v1/auth/me", { credentials: "include" });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as AuthUser;
}

function authPost<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "POST", body: JSON.stringify(body), fallbackMessage: "authError" });
}

export function registerAccount(input: {
  email: string;
  password: string;
  display_name: string;
  locale: string;
  /** Must be true: the person ticked the terms and privacy box. */
  accept_terms: boolean;
  /** The exact versions the person was shown. */
  policy_versions: Record<string, string>;
  personalisation_consent: boolean;
  marketing_consent: boolean;
}): Promise<AuthUser> {
  return authPost("/api/v1/auth/register", input);
}

export function signInAccount(input: { email: string; password: string }): Promise<AuthUser> {
  return authPost("/api/v1/auth/signin", input);
}

export async function signOutAccount(): Promise<void> {
  await fetch("/api/v1/auth/signout", { method: "POST", credentials: "include" });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await authPost("/api/v1/auth/forgot-password", { email });
}

export function verifyEmail(token: string): Promise<AuthUser> {
  return authPost("/api/v1/auth/verify-email", { token });
}

export async function resendVerification(email?: string): Promise<void> {
  await authPost("/api/v1/auth/resend-verification", email ? { email } : {});
}

export function resetPassword(input: { token: string; password: string }): Promise<AuthUser> {
  return authPost("/api/v1/auth/reset-password", input);
}

/** Records acceptance of the current versions of the given documents. */
export async function acceptPolicies(versions: Record<string, string>): Promise<void> {
  await apiRequest("/api/v1/privacy/policies/accept", {
    method: "POST",
    body: JSON.stringify({ versions }),
  });
}
