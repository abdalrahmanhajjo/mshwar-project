import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  BRAND_ROOT,
  SEMANTIC_COLOR_GROUPS,
  TOKEN_PATH,
  checkGeneratedFiles,
  colorsDefinedOnlyInMediaQuery,
  collectGroupKeys,
  flattenColorMode,
  generateAll,
  generateFigmaVariables,
  generateTailwindThemeCss,
  generateTailwindThemeTs,
  generateTokensCss,
  generateTokensStudio,
  loadTokens,
  resolveValue,
  validateTokens,
} from "./generate-tokens.mjs";

const tokens = loadTokens();

describe("design-tokens.json", () => {
  it("is valid JSON with the required token groups", () => {
    assert.equal(typeof tokens, "object");
    for (const group of ["color", "typography", "spacing", "radius", "elevation", "motion"]) {
      assert.ok(tokens[group], `missing ${group}`);
    }
  });

  it("defines matching light and dark semantic colour keys", () => {
    assert.deepEqual(collectGroupKeys(tokens.color.light), collectGroupKeys(tokens.color.dark));
  });

  it("uses semantic colour group names, not literal scales", () => {
    for (const group of SEMANTIC_COLOR_GROUPS) {
      assert.ok(tokens.color.light[group], group);
      assert.ok(tokens.color.dark[group], group);
    }
    const errors = validateTokens(tokens);
    assert.deepEqual(errors, []);
    assert.equal(tokens.color.light.accent && "500" in (tokens.color.light.accent || {}), false);
    assert.ok(!("orange-500" in flattenColorMode(tokens.color.light, tokens)));
  });

  it("resolves primitive references in both palettes", () => {
    assert.equal(resolveValue("{primitive.color.orange}", tokens), "#F3653E");
    const light = flattenColorMode(tokens.color.light, tokens);
    const dark = flattenColorMode(tokens.color.dark, tokens);
    assert.equal(light.accent, "#F3653E");
    assert.equal(dark.surface, "#0C1F1C");
    assert.notEqual(light.surface, dark.surface);
  });
});

describe("generated artifacts", () => {
  it("emits CSS custom properties for light and dark without media-query-only colours", () => {
    const css = generateTokensCss(tokens);
    assert.match(css, /:root \{/);
    assert.match(css, /\.dark,\n\[data-theme="dark"\] \{/);
    assert.match(css, /--surface: #FCFCF8;/);
    assert.match(css, /--accent: #F3653E;/);
    assert.match(css, /--border: #7F8984;/);
    assert.match(css, /--danger: #B42318;/);
    assert.match(css, /--text-on-accent:/);
    assert.equal(css.includes("--accent: var(--accent);"), false);
    assert.equal(css.includes("--border: var(--border);"), false);
    assert.match(css, /--motion-quick:/);
    assert.match(css, /--elevation-md:/);
    assert.equal(css.includes("@media (prefers-color-scheme"), false);
    assert.deepEqual(colorsDefinedOnlyInMediaQuery(css), []);
  });

  it("emits a Tailwind v4 @theme from tokens, not a hand palette", () => {
    const css = generateTailwindThemeCss(tokens);
    assert.match(css, /@theme inline \{/);
    assert.match(css, /--color-surface: var\(--surface\);/);
    assert.match(css, /--color-danger: var\(--danger\);/);
    assert.match(css, /--color-primary: var\(--primary\);/);
    assert.match(css, /--radius-control: 0\.75rem;/);
    assert.equal(css.includes("--radius-control: var(--radius-control);"), false);
    assert.equal(css.includes("#3b82f6"), false);
    assert.equal(css.includes("orange-500"), false);
  });

  it("emits a Tailwind theme object with semantic colour keys", () => {
    const source = generateTailwindThemeTs(tokens);
    assert.match(source, /export const mshwarTheme/);
    assert.match(source, /"surface"/);
    assert.match(source, /"accent"/);
    assert.match(source, /"danger"/);
    assert.equal(source.includes("orange-500"), false);
    assert.equal(source.includes("#3b82f6"), false);
  });

  it("exports Figma Variables and Tokens Studio collections with both modes", () => {
    const figma = generateFigmaVariables(tokens);
    const colorCollection = figma.collections.find((collection) => collection.name === "Mshwar / Color");
    assert.ok(colorCollection);
    assert.deepEqual(colorCollection.modes, ["light", "dark"]);
    assert.ok(colorCollection.variables.some((variable) => variable.name === "surface"));
    assert.ok(colorCollection.variables.some((variable) => variable.name === "danger"));
    const studio = generateTokensStudio(tokens);
    assert.ok(studio["semantic/light"]);
    assert.ok(studio["semantic/dark"]);
    assert.equal(studio.$themes.length, 2);
  });

  it("fails --check when a generated file is stale", () => {
    const files = generateAll(tokens);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mshwar-tokens-"));
    const tempFile = path.join(tempDir, "tokens.css");
    const stale = checkGeneratedFiles({ [tempFile]: files[path.join(BRAND_ROOT, "generated/tokens.css")] });
    assert.deepEqual(stale, [path.relative(path.resolve(BRAND_ROOT, ".."), tempFile)]);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("keeps committed generated files in sync with the JSON source", () => {
    const stale = checkGeneratedFiles(generateAll(tokens));
    assert.deepEqual(stale, []);
    assert.ok(fs.existsSync(TOKEN_PATH));
  });
});
