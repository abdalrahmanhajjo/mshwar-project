import { describe, expect, it } from "vitest";
import {
  applyDocumentLocale,
  isLocale,
  localeDirection,
  parseLocale,
  splitLocalePrefix,
  withLocalePrefix,
} from "./locale";

describe("locale helpers", () => {
  it("parses and rejects unknown locales", () => {
    expect(parseLocale("ar")).toBe("ar");
    expect(parseLocale("nope")).toBe("en");
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(localeDirection("ar")).toBe("rtl");
    expect(localeDirection("fr")).toBe("ltr");
  });

  it("applies lang and dir on the document", () => {
    applyDocumentLocale("ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
  });

  it("prefixes shareable locale paths and strips them again", () => {
    expect(splitLocalePrefix("/ar/destinations")).toEqual({ locale: "ar", pathname: "/destinations" });
    expect(splitLocalePrefix("/fr")).toEqual({ locale: "fr", pathname: "/" });
    expect(splitLocalePrefix("/destinations")).toEqual({ locale: null, pathname: "/destinations" });
    expect(withLocalePrefix("ar", "/experiences?category=coast")).toBe("/ar/experiences?category=coast");
    expect(withLocalePrefix("en", "/ar/destinations")).toBe("/destinations");
    expect(withLocalePrefix("ar", "/")).toBe("/ar");
    expect(withLocalePrefix("fr", "https://maps.google.com")).toBe("https://maps.google.com");
  });
});
