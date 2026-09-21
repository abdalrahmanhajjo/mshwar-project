import { scrubBreadcrumb, scrubEvent } from "./scrub";

/** Shared Sentry options: no default PII, no request bodies, every event and breadcrumb scrubbed. */
export function sentryOptions(dsn: string, runtime: "browser" | "nodejs" | "edge") {
  return {
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_RELEASE || undefined,
    sendDefaultPii: false,
    maxBreadcrumbs: 30,
    tracesSampleRate: 0,
    initialScope: { tags: { runtime } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Sentry's event types differ per runtime.
    beforeSend: (event: any) => scrubEvent(event),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    beforeSendTransaction: (event: any) => scrubEvent(event),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    beforeBreadcrumb: (crumb: any) => scrubBreadcrumb(crumb),
  };
}
