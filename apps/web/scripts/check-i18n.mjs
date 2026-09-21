#!/usr/bin/env node
/**
 * CI gate for MSHWAR-104: catalogue parity + leftover hardcoded MVP copy.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CATALOGUES = [
  "src/lib/messages.ts",
  "src/lib/browse-copy.ts",
  "src/lib/hub-copy.ts",
  "src/lib/privacy-copy.ts",
  "src/lib/planner-copy.ts",
  "src/lib/checkout-copy.ts",
  "src/lib/trust-copy.ts",
];

const MVP_PAGES = [
  "src/app/not-found.tsx",
  "src/app/(traveller)/plan/page.tsx",
  "src/app/(traveller)/contact/page.tsx",
  "src/app/(traveller)/terms/page.tsx",
  "src/app/(traveller)/privacy/page.tsx",
  "src/app/(traveller)/cancellation-policy/page.tsx",
  "src/app/(traveller)/community-guidelines/page.tsx",
];

function extractLocaleBlock(source, locale) {
  const marker = `${locale}: {`;
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(`Missing ${locale} block`);
  }
  let i = start + marker.length;
  let depth = 1;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    i += 1;
  }
  return source.slice(start, i);
}

function keysOf(block) {
  return [...block.matchAll(/^\s+(\w+):\s/gm)]
    .map((match) => match[1])
    .filter((key) => !["en", "ar", "fr"].includes(key));
}

function emptyKeys(block, locale) {
  return [...block.matchAll(/^\s+(\w+):\s*(?:""|'')/gm)].map((match) => `${locale}.${match[1]}`);
}

const errors = [];

for (const rel of CATALOGUES) {
  const source = fs.readFileSync(path.join(root, rel), "utf8");
  let enKeys;
  try {
    const blocks = {
      en: extractLocaleBlock(source, "en"),
      ar: extractLocaleBlock(source, "ar"),
      fr: extractLocaleBlock(source, "fr"),
    };
    enKeys = keysOf(blocks.en).sort();
    for (const locale of ["en", "ar", "fr"]) {
      const keys = keysOf(blocks[locale]).sort();
      if (keys.join("\0") !== enKeys.join("\0")) {
        errors.push(`${rel}: ${locale} keys differ from en`);
      }
      for (const empty of emptyKeys(blocks[locale], locale)) {
        errors.push(`${rel}: empty ${empty}`);
      }
    }
  } catch (error) {
    errors.push(`${rel}: ${error.message}`);
  }
}

const hardcoded = />\s*[A-Za-z][^<{]{2,}</g;
for (const rel of MVP_PAGES) {
  const source = fs.readFileSync(path.join(root, rel), "utf8");
  const hits = source.match(hardcoded) ?? [];
  for (const hit of hits) {
    if (!hit.includes("{") && !/404/.test(hit)) {
      errors.push(`${rel}: hardcoded copy ${hit.trim()}`);
    }
  }
}

if (errors.length) {
  console.error("i18n check failed:\n" + errors.map((line) => ` - ${line}`).join("\n"));
  process.exit(1);
}

console.log(`i18n check passed (${CATALOGUES.length} catalogues, ${MVP_PAGES.length} MVP pages)`);
