import type { Locale } from "@/lib/locale";

export class MissingTranslationError extends Error {
  constructor(
    readonly locale: string,
    readonly key: string,
  ) {
    super(`Missing translation: ${locale}.${key}`);
    this.name = "MissingTranslationError";
  }
}

export function translate<K extends string>(table: Record<Locale, Record<K, string>>, locale: Locale, key: K): string {
  const value = table[locale]?.[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new MissingTranslationError(locale, String(key));
  }
  return value;
}

export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = values[name];
    return value === undefined ? `{${name}}` : String(value);
  });
}
