/**
 * Correlation ids (MSHWAR-111). The proxy stamps one on every request it
 * forwards, the API echoes it on the response and in its logs, error bodies,
 * Sentry events and audit rows.
 */
export const REQUEST_ID_HEADER = "x-request-id";

export function newRequestId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
