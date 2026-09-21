import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CANCELLATION_POLICY } from "./cancellation";
import { COMMUNITY_GUIDELINES } from "./community";
import { fillLegalText, legalEntity } from "./entity";
import { PRIVACY_POLICY } from "./privacy";
import { TERMS_OF_SERVICE } from "./terms";
import { LEGAL_VERSIONS, type LegalBlock, type LegalLibrary } from "./types";

const LIBRARIES: Record<string, LegalLibrary> = {
  terms: TERMS_OF_SERVICE,
  privacy: PRIVACY_POLICY,
  cancellation: CANCELLATION_POLICY,
  community: COMMUNITY_GUIDELINES,
};

function shape(block: LegalBlock) {
  return typeof block === "string" ? "p" : `list:${block.list.length}`;
}

function texts(library: LegalLibrary, locale: "en" | "ar" | "fr"): string[] {
  const doc = library[locale];
  return [
    doc.title,
    doc.summary,
    ...doc.sections.flatMap((section) => [
      section.heading,
      ...section.body.flatMap((block) => (typeof block === "string" ? [block] : block.list)),
    ]),
  ];
}

describe("trust documents (MSHWAR-113)", () => {
  it.each(Object.keys(LIBRARIES))("%s has the same structure in every language", (kind) => {
    const library = LIBRARIES[kind];
    const outline = (locale: "en" | "ar" | "fr") =>
      library[locale].sections.map((section) => `${section.id}:${section.body.map(shape).join(",")}`);
    expect(outline("ar")).toEqual(outline("en"));
    expect(outline("fr")).toEqual(outline("en"));
  });

  it.each(Object.keys(LIBRARIES))("%s uses only known placeholders, the same way in every language", (kind) => {
    const library = LIBRARIES[kind];
    const placeholders = (locale: "en" | "ar" | "fr") =>
      texts(library, locale)
        .flatMap((text) => text.match(/\{[a-z]+\}/g) ?? [])
        .sort();
    for (const locale of ["en", "ar", "fr"] as const) {
      expect(placeholders(locale).every((token) => ["{entity}", "{address}", "{contact}"].includes(token))).toBe(true);
      expect(placeholders(locale)).toEqual(placeholders("en"));
      expect(texts(library, locale).every((text) => text.trim().length > 0)).toBe(true);
    }
  });

  it("describes the booking rules the platform actually enforces", () => {
    const terms = texts(TERMS_OF_SERVICE, "en").join(" ");
    const cancellation = texts(CANCELLATION_POLICY, "en").join(" ");
    expect(terms).toContain("15 minutes");
    expect(terms).toContain("24 hours");
    expect(cancellation).toContain("full refund");
    expect(texts(TERMS_OF_SERVICE, "ar").join(" ")).toContain("15 دقيقة");
    expect(texts(CANCELLATION_POLICY, "fr").join(" ")).toContain("24 heures");
  });

  it("publishes the same versions the database asks people to accept", () => {
    const migration = fs.readFileSync(
      path.resolve(__dirname, "../../../../../mshwar-database/migrations/026_consent_and_policies.sql"),
      "utf8",
    );
    for (const [kind, version] of Object.entries(LEGAL_VERSIONS)) {
      expect(migration).toMatch(new RegExp(`\\('${kind}',\\s*'${version}'`));
    }
  });

  it("fills operator details and falls back to the contact page", () => {
    const entity = { name: "Mshwar SAL", address: "Tripoli, Lebanon", email: null };
    expect(fillLegalText("{entity}, {address} — {contact}", "en", entity)).toBe(
      "Mshwar SAL, Tripoli, Lebanon — our Contact page",
    );
    expect(fillLegalText("{contact}", "ar", { ...entity, email: "privacy@example.com" })).toBe("privacy@example.com");
    expect(legalEntity().name).toBeTruthy();
  });
});
