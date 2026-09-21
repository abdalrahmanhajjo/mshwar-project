#!/usr/bin/env node
/**
 * Assert WCAG AA contrast for every in-use token pairing.
 *
 * Usage:
 *   node mshwar-brand-foundation/scripts/assert-contrast.mjs
 *   node mshwar-brand-foundation/scripts/assert-contrast.mjs --write
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contrastRatio, relativeLuminance, roundContrast, usageMinimum } from "./contrast.mjs";
import { BRAND_ROOT, loadTokens, resolveValue } from "./generate-tokens.mjs";

export const CONTRAST_CHECKS_PATH = path.join(BRAND_ROOT, "contrast-checks.json");
export const CONTRAST_REPORT_PATH = path.join(BRAND_ROOT, "generated/contrast-report.json");

const SURFACES = ["surface.canvas", "surface.raised", "surface.sunken"];

export function loadContrastCatalog(filePath = CONTRAST_CHECKS_PATH) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function resolveTokenColor(tokens, dottedPath) {
  const raw = dottedPath.startsWith("{") ? dottedPath : `{${dottedPath}}`;
  return resolveValue(raw, tokens);
}

export function expandCatalog(catalog) {
  const pairings = [];
  for (const mode of ["light", "dark"]) {
    for (const item of catalog.textOnSurfaces ?? []) {
      for (const surface of SURFACES) {
        pairings.push({
          id: `${mode}-${item.foreground.replace(/\./g, "-")}-on-${surface.replace(/\./g, "-")}`,
          foreground: `color.${mode}.${item.foreground}`,
          background: `color.${mode}.${surface}`,
          usage: item.usage ?? "text",
          minRatio: item.minRatio ?? usageMinimum(item.usage ?? "text"),
          allowed: true,
        });
      }
    }
    for (const item of catalog.fillPairs ?? []) {
      pairings.push({
        id: `${mode}-${item.foreground.replace(/\./g, "-")}-on-${item.background.replace(/\./g, "-")}`,
        foreground: `color.${mode}.${item.foreground}`,
        background: `color.${mode}.${item.background}`,
        usage: item.usage ?? "text",
        minRatio: item.minRatio ?? usageMinimum(item.usage ?? "text"),
        allowed: true,
      });
    }
    for (const item of catalog.statusOnSurfaces ?? []) {
      for (const surface of SURFACES) {
        pairings.push({
          id: `${mode}-${item.foreground.replace(/\./g, "-")}-on-${surface.replace(/\./g, "-")}`,
          foreground: `color.${mode}.${item.foreground}`,
          background: `color.${mode}.${surface}`,
          usage: item.usage ?? "text",
          minRatio: item.minRatio ?? usageMinimum(item.usage ?? "text"),
          allowed: true,
        });
      }
    }
    for (const item of catalog.nonTextOnSurfaces ?? []) {
      for (const surface of SURFACES) {
        pairings.push({
          id: `${mode}-${item.foreground.replace(/\./g, "-")}-on-${surface.replace(/\./g, "-")}`,
          foreground: `color.${mode}.${item.foreground}`,
          background: `color.${mode}.${surface}`,
          usage: "non-text",
          minRatio: item.minRatio ?? usageMinimum("non-text"),
          allowed: true,
        });
      }
    }
  }
  for (const item of catalog.extra ?? []) {
    pairings.push({
      id: item.id,
      foreground: item.foreground,
      background: item.background,
      usage: item.usage ?? "text",
      minRatio: item.minRatio ?? usageMinimum(item.usage ?? "text"),
      allowed: item.allowed !== false,
      note: item.note,
    });
  }
  for (const item of catalog.forbidden ?? []) {
    pairings.push({
      id: item.id,
      foreground: item.foreground,
      background: item.background,
      usage: item.usage ?? "text",
      minRatio: item.minRatio ?? usageMinimum(item.usage ?? "text"),
      allowed: false,
      note: item.note,
    });
  }
  return pairings;
}

export function evaluatePairing(tokens, pairing) {
  const foreground = resolveTokenColor(tokens, pairing.foreground);
  const background = resolveTokenColor(tokens, pairing.background);
  const ratio = contrastRatio(foreground, background);
  const passes = ratio + Number.EPSILON >= pairing.minRatio;
  return {
    ...pairing,
    foregroundValue: foreground,
    backgroundValue: background,
    foregroundLuminance: roundContrast(relativeLuminance(foreground)),
    backgroundLuminance: roundContrast(relativeLuminance(background)),
    ratio: roundContrast(ratio),
    passes,
  };
}

export function auditContrast(tokens = loadTokens(), catalog = loadContrastCatalog()) {
  const evaluated = expandCatalog(catalog).map((pairing) => evaluatePairing(tokens, pairing));
  const required = evaluated.filter((item) => item.allowed !== false);
  const failures = required.filter((item) => !item.passes);
  return { evaluated, required, failures };
}

export function buildContrastReport(audit, tokens) {
  return {
    $description:
      "Recomputed WCAG 2.2 contrast for every in-use token pairing. Generated from design-tokens.json + contrast-checks.json.",
    standard: "WCAG 2.2 AA",
    tokenVersion: tokens.meta?.version ?? null,
    generatedFrom: "mshwar-brand-foundation/design-tokens.json",
    requiredPairings: audit.required.length,
    failures: audit.failures.map((item) => item.id),
    pairings: audit.evaluated,
  };
}

export function writeContrastReport(report, filePath = CONTRAST_REPORT_PATH) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`);
}

function printTable(rows) {
  for (const row of rows) {
    const mark = row.allowed === false ? "skip" : row.passes ? "pass" : "FAIL";
    const note = row.note ? `  — ${row.note}` : "";
    console.log(
      `${mark.padEnd(4)}  ${String(row.ratio).padStart(5)}  ≥ ${String(row.minRatio).padEnd(3)}  ${row.foregroundValue} on ${row.backgroundValue}  ${row.id}${note}`,
    );
  }
}

function main() {
  const tokens = loadTokens();
  const catalog = loadContrastCatalog();
  const audit = auditContrast(tokens, catalog);
  const report = buildContrastReport(audit, tokens);
  const write = process.argv.includes("--write");
  if (write) {
    writeContrastReport(report);
    console.log(`Wrote ${path.relative(process.cwd(), CONTRAST_REPORT_PATH)}`);
  }
  printTable(audit.evaluated);
  if (audit.failures.length > 0) {
    console.error(`\n${audit.failures.length} contrast pairing(s) below WCAG AA.`);
    process.exit(1);
  }
  console.log(`\n${audit.required.length} required pairings meet WCAG AA.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
