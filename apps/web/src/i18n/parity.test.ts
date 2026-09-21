import { describe, expect, it } from "vitest";
import { catalogueParityErrors, catalogueRegistry } from "./parity";
import { LOCALES } from "@/lib/locale";

describe("message catalogue parity", () => {
  it("registers every Phase 1 surface catalogue", () => {
    expect(Object.keys(catalogueRegistry).sort()).toEqual(
      [
        "browseCopy",
        "checkoutCopy",
        "hubCopy",
        "messages",
        "plannerCopy",
        "privacyCopy",
      ].sort(),
    );
  });

  it("keeps en/ar/fr keys aligned and non-empty", () => {
    expect(catalogueParityErrors()).toEqual([]);
    for (const locale of LOCALES) {
      expect(Object.keys(catalogueRegistry.messages[locale]).length).toBeGreaterThan(40);
    }
  });
});
