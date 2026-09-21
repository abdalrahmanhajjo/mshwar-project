/**
 * Browser error reporting (MSHWAR-111). Loaded only when NEXT_PUBLIC_SENTRY_DSN is
 * set and the visitor has allowed error reporting in Cookie settings (MSHWAR-113),
 * and only after the page is interactive, so it never slows the first paint.
 */
import { startBrowserReporting } from "@/lib/observability/browser-reporting";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn && typeof window !== "undefined") {
  startBrowserReporting(dsn, () => import("@sentry/nextjs"));
}
