import type { Locale } from "@/lib/locale";
import { LOCALES } from "@/lib/locale";
import { browseCopy } from "@/lib/browse-copy";
import { checkoutCopy } from "@/lib/checkout-copy";
import { hubCopy } from "@/lib/hub-copy";
import { messages } from "@/lib/messages";
import { plannerCopy } from "@/lib/planner-copy";
import { privacyCopy } from "@/lib/privacy-copy";

export const catalogueRegistry = {
  messages,
  browseCopy,
  hubCopy,
  privacyCopy,
  plannerCopy,
  checkoutCopy,
} as const;

export type CatalogueName = keyof typeof catalogueRegistry;

export function catalogueKeys(table: Record<Locale, Record<string, string>>, locale: Locale): string[] {
  return Object.keys(table[locale]).sort();
}

export function emptyCatalogueKeys(table: Record<Locale, Record<string, string>>): string[] {
  const empty: string[] = [];
  for (const locale of LOCALES) {
    for (const [key, value] of Object.entries(table[locale])) {
      if (typeof value !== "string" || value.trim().length === 0) {
        empty.push(`${locale}.${key}`);
      }
    }
  }
  return empty;
}

export function catalogueParityErrors(): string[] {
  const errors: string[] = [];
  for (const [name, table] of Object.entries(catalogueRegistry)) {
    const expected = catalogueKeys(table, "en");
    for (const locale of LOCALES) {
      const keys = catalogueKeys(table, locale);
      if (keys.join("\0") !== expected.join("\0")) {
        errors.push(`${name}: ${locale} keys differ from en`);
      }
    }
    for (const key of emptyCatalogueKeys(table)) {
      errors.push(`${name}: empty ${key}`);
    }
  }
  return errors;
}
