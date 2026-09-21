/**
 * Server-side error reporting (MSHWAR-111). Off unless SENTRY_DSN is set; the SDK
 * is only loaded when it is, so builds without Sentry carry no extra code path.
 */
import type { Instrumentation } from "next";
import { sentryOptions } from "@/lib/observability/sentry-options";
import { sentryServerDsn, serverRuntime } from "@/lib/server-env";

export async function register() {
  const dsn = sentryServerDsn();
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init(sentryOptions(dsn, serverRuntime()));
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (!sentryServerDsn()) return;
  const Sentry = await import("@sentry/nextjs");
  const requestId = request.headers["x-request-id"];
  Sentry.withScope((scope) => {
    if (typeof requestId === "string") scope.setTag("request_id", requestId);
    Sentry.captureRequestError(error, request, context);
  });
};
