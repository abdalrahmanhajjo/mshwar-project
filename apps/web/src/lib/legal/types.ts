import type { Locale } from "@/lib/locale";
import versions from "./versions.json";

/** The published trust documents (MSHWAR-113). Versions must match migration 026. */
export const LEGAL_VERSIONS = versions;
export type LegalKind = keyof typeof versions;

/** A paragraph, or a bulleted list. Text may use {entity}, {address} and {contact}. */
export type LegalBlock = string | { list: string[] };

export type LegalSection = { id: string; heading: string; body: LegalBlock[] };

export type LegalDocument = {
  title: string;
  summary: string;
  sections: LegalSection[];
};

export type LegalLibrary = Record<Locale, LegalDocument>;
