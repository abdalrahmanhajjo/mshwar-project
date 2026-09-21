/**
 * Server-only environment flags. Every non-public env var the web app reads lives here,
 * so CI can check that no other module reads private configuration.
 */

/**
 * The bundled sample catalogue may stand in for the API only when it is unreachable
 * and only where that is explicitly allowed (local development and demo previews).
 * Production must never present sample businesses or prices as real.
 */
export function sampleFallbackEnabled(): boolean {
  const flag = process.env.CATALOGUE_SAMPLE_FALLBACK;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}

/** Sentry DSN for server-side error reports; unset means reporting is off. */
export function sentryServerDsn(): string | undefined {
  return process.env.SENTRY_DSN || undefined;
}

/** "edge" or "nodejs": which Next.js runtime is executing this module. */
export function serverRuntime(): "edge" | "nodejs" {
  return process.env.NEXT_RUNTIME === "edge" ? "edge" : "nodejs";
}
