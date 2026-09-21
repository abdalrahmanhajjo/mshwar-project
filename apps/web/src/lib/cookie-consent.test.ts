import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALLOW_ALL,
  CONSENT_COOKIE,
  ESSENTIAL_ONLY,
  parseCookieChoices,
  readCookieChoices,
  serializeCookieChoices,
  subscribeCookieChoices,
  writeCookieChoices,
} from "./cookie-consent";
import { startBrowserReporting } from "./observability/browser-reporting";

function clearConsent() {
  document.cookie = `${CONSENT_COOKIE}=; Path=/; Max-Age=0`;
}

afterEach(clearConsent);

describe("cookie choices (MSHWAR-113)", () => {
  it("treats a missing or unknown cookie as no choice yet", () => {
    expect(parseCookieChoices(undefined)).toBeNull();
    expect(parseCookieChoices("yes")).toBeNull();
    expect(parseCookieChoices("v2.e1.m1")).toBeNull();
    expect(readCookieChoices()).toBeNull();
  });

  it("round-trips choices and tells listeners", () => {
    expect(parseCookieChoices(serializeCookieChoices({ errors: true, maps: false }))).toEqual({
      errors: true,
      maps: false,
    });
    const listener = vi.fn();
    const stop = subscribeCookieChoices(listener);
    writeCookieChoices(ALLOW_ALL);
    expect(readCookieChoices()).toEqual(ALLOW_ALL);
    expect(document.cookie).toContain(`${CONSENT_COOKIE}=v1.e1.m1`);
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    writeCookieChoices(ESSENTIAL_ONLY);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("browser error reporting follows consent", () => {
  function fakeSentry() {
    return { init: vi.fn(), close: vi.fn(async () => true) };
  }

  it("does not even load the SDK without consent", async () => {
    const sentry = fakeSentry();
    const load = vi.fn(async () => sentry);
    const stop = startBrowserReporting("https://key@example.ingest/1", load);
    await Promise.resolve();
    expect(load).not.toHaveBeenCalled();
    stop();
  });

  it("starts when allowed and stops when withdrawn", async () => {
    const sentry = fakeSentry();
    const load = vi.fn(async () => sentry);
    const stop = startBrowserReporting("https://key@example.ingest/1", load);
    writeCookieChoices({ errors: true, maps: false });
    await vi.waitFor(() => expect(sentry.init).toHaveBeenCalledTimes(1));
    expect(sentry.init.mock.calls[0][0]).toMatchObject({ sendDefaultPii: false });
    writeCookieChoices(ESSENTIAL_ONLY);
    await vi.waitFor(() => expect(sentry.close).toHaveBeenCalledTimes(1));
    writeCookieChoices({ errors: true, maps: true });
    await vi.waitFor(() => expect(sentry.init).toHaveBeenCalledTimes(2));
    expect(load).toHaveBeenCalledTimes(1);
    stop();
  });
});
