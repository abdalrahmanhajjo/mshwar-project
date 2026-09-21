import type { Locale } from "@/lib/locale";
import { interpolate } from "@/i18n/translate";

export const LOCALE_BCP47: Record<Locale, string> = {
  en: "en-US",
  ar: "ar-LB",
  fr: "fr-FR",
};

export type PluralForms = {
  zero?: string;
  one: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
};

export function bcp47(locale: Locale): string {
  return LOCALE_BCP47[locale];
}

export function formatNumber(locale: Locale, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(bcp47(locale), options).format(value);
}

export function formatCurrency(
  locale: Locale,
  amount: number,
  currency = "USD",
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(bcp47(locale), {
    style: "currency",
    currency,
    ...options,
  }).format(amount);
}

export function formatDate(
  locale: Locale,
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(bcp47(locale), {
    dateStyle: "medium",
    ...options,
  }).format(date);
}

export function formatPlural(locale: Locale, count: number, forms: PluralForms): string {
  const rule = new Intl.PluralRules(bcp47(locale)).select(count);
  const template = forms[rule] ?? forms.other;
  return interpolate(template, { count: formatNumber(locale, count) });
}
