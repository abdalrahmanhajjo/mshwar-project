/**
 * Operator details used in the trust documents. Set these per deployment once the
 * legal entity is confirmed; the defaults keep the drafts readable meanwhile.
 */
export type LegalEntity = { name: string; address: string; email: string | null };

export function legalEntity(): LegalEntity {
  return {
    name: process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME || "Mshwar",
    address: process.env.NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS || "Tripoli, Lebanon",
    email: process.env.NEXT_PUBLIC_PRIVACY_EMAIL || null,
  };
}

const CONTACT_FALLBACK = { en: "our Contact page", ar: "صفحة التواصل", fr: "notre page Contact" } as const;

export function fillLegalText(text: string, locale: keyof typeof CONTACT_FALLBACK, entity = legalEntity()): string {
  return text
    .replaceAll("{entity}", entity.name)
    .replaceAll("{address}", entity.address)
    .replaceAll("{contact}", entity.email ?? CONTACT_FALLBACK[locale]);
}
