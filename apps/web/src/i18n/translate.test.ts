import { describe, expect, it } from "vitest";
import { messages } from "@/lib/messages";
import { interpolate, MissingTranslationError, translate } from "./translate";

describe("translate", () => {
  it("returns catalogue copy and interpolates placeholders", () => {
    expect(translate(messages, "en", "language")).toBe("Language");
    expect(interpolate("Trip {id}", { id: "abc" })).toBe("Trip abc");
  });

  it("fails the build path on a missing or empty key", () => {
    expect(() => translate(messages, "en", "not-a-real-key" as "language")).toThrow(MissingTranslationError);
    const broken = { ...messages, en: { ...messages.en, language: "   " } };
    expect(() => translate(broken, "en", "language")).toThrow(/Missing translation: en.language/);
  });
});
