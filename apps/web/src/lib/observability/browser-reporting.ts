import { readCookieChoices, subscribeCookieChoices } from "@/lib/cookie-consent";
import { sentryOptions } from "./sentry-options";

type SentryModule = {
  init: (options: ReturnType<typeof sentryOptions>) => unknown;
  close: () => Promise<boolean> | unknown;
};

/**
 * Browser error reporting runs only while the visitor allows it (MSHWAR-111/113):
 * it starts when "Error reporting" is switched on and stops when it is switched off.
 */
export function startBrowserReporting(dsn: string, load: () => Promise<SentryModule>): () => void {
  let running = false;
  let loaded: Promise<SentryModule> | null = null;

  const sync = () => {
    const allowed = readCookieChoices()?.errors === true;
    if (allowed && !running) {
      running = true;
      loaded ??= load();
      void loaded.then((sentry) => {
        if (running) {
          sentry.init(sentryOptions(dsn, "browser"));
        }
      });
    } else if (!allowed && running) {
      running = false;
      void loaded?.then((sentry) => sentry.close());
    }
  };

  sync();
  return subscribeCookieChoices(sync);
}
