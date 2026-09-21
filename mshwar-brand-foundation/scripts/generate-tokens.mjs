#!/usr/bin/env node
/**
 * Generate CSS custom properties, a Tailwind v4 theme, and Figma export
 * files from mshwar-brand-foundation/design-tokens.json.
 *
 * Usage:
 *   node mshwar-brand-foundation/scripts/generate-tokens.mjs
 *   node mshwar-brand-foundation/scripts/generate-tokens.mjs --check
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BRAND_ROOT = path.resolve(__dirname, "..");
export const REPO_ROOT = path.resolve(BRAND_ROOT, "..");
export const TOKEN_PATH = path.join(BRAND_ROOT, "design-tokens.json");

const GENERATED_BANNER = `/**
 * GENERATED FILE — do not edit.
 * Source: mshwar-brand-foundation/design-tokens.json
 * Regenerate: pnpm tokens:generate
 */`;

const CSS_BANNER = `/*
 * GENERATED FILE — do not edit.
 * Source: mshwar-brand-foundation/design-tokens.json
 * Regenerate: pnpm tokens:generate
 */`;

const DEFAULT_KEYS = new Set(["default", "primary", "canvas", "ring"]);

export function toKebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

export const SEMANTIC_COLOR_GROUPS = [
  "surface",
  "text",
  "accent",
  "brand",
  "border",
  "danger",
  "success",
  "warning",
  "focus",
];

const LITERAL_SCALE = /^(orange|blue|red|green|gray|slate|zinc|neutral|stone)-\d+$/i;

export function loadTokens(filePath = TOKEN_PATH) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function getByPath(object, dottedPath) {
  return dottedPath.split(".").reduce((current, key) => {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    return current[key];
  }, object);
}

export function resolveValue(raw, tokens, seen = new Set()) {
  if (typeof raw !== "string") {
    return raw;
  }
  const match = raw.match(/^\{([a-zA-Z0-9.-]+)\}$/);
  if (!match) {
    return raw;
  }
  const ref = match[1];
  if (seen.has(ref)) {
    throw new Error(`Circular token reference: ${ref}`);
  }
  seen.add(ref);
  const next = getByPath(tokens, ref);
  if (next === undefined) {
    throw new Error(`Unresolved token reference: ${ref}`);
  }
  return resolveValue(next, tokens, seen);
}

export function flattenGroup(group, tokens, { collapseDefaults = true } = {}) {
  const result = {};
  for (const [name, value] of Object.entries(group)) {
    if (value && typeof value === "object" && !Array.isArray(value) && !("px" in value) && !("rem" in value)) {
      for (const [child, childValue] of Object.entries(value)) {
        const resolved = resolveValue(childValue, tokens);
        const childName = toKebab(child);
        if (collapseDefaults && DEFAULT_KEYS.has(child)) {
          result[toKebab(name)] = resolved;
        } else {
          result[`${toKebab(name)}-${childName}`] = resolved;
        }
      }
    } else if (value && typeof value === "object" && ("rem" in value || "px" in value)) {
      result[toKebab(name)] = value.rem ?? `${value.px}px`;
    } else {
      result[toKebab(name)] = resolveValue(value, tokens);
    }
  }
  return result;
}

export function flattenColorMode(mode, tokens) {
  return flattenGroup(mode, tokens);
}

export function collectGroupKeys(group, prefix = "") {
  const keys = [];
  for (const [name, value] of Object.entries(group)) {
    if (value && typeof value === "object" && !Array.isArray(value) && !("px" in value) && !("rem" in value)) {
      keys.push(...collectGroupKeys(value, prefix ? `${prefix}.${name}` : name));
    } else {
      keys.push(prefix ? `${prefix}.${name}` : name);
    }
  }
  return keys.sort();
}

function isColorValue(value) {
  return typeof value === "string" && /^(#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(|hsla?\()/i.test(value);
}

export function validateTokens(tokens) {
  const errors = [];
  const required = ["meta", "primitive", "color", "typography", "spacing", "radius", "elevation", "motion"];
  for (const key of required) {
    if (!(key in tokens)) {
      errors.push(`Missing required group: ${key}`);
    }
  }

  if (!tokens.color?.light || !tokens.color?.dark) {
    errors.push("color.light and color.dark must both be defined");
    return errors;
  }

  const lightKeys = collectGroupKeys(tokens.color.light);
  const darkKeys = collectGroupKeys(tokens.color.dark);
  if (lightKeys.join() !== darkKeys.join()) {
    errors.push(`Light and dark colour keys differ.\n  light: ${lightKeys.join(", ")}\n  dark: ${darkKeys.join(", ")}`);
  }

  for (const group of SEMANTIC_COLOR_GROUPS) {
    if (!(group in tokens.color.light) || !(group in tokens.color.dark)) {
      errors.push(`Semantic colour group "${group}" must exist on both palettes`);
    }
  }

  for (const key of [...lightKeys, ...darkKeys]) {
    const leaf = key.split(".").pop();
    if (LITERAL_SCALE.test(key) || LITERAL_SCALE.test(leaf ?? "")) {
      errors.push(`Literal scale name is not allowed in semantic colour tokens: ${key}`);
    }
  }

  if (!tokens.elevation?.light || !tokens.elevation?.dark) {
    errors.push("elevation.light and elevation.dark must both be defined");
  } else if (Object.keys(tokens.elevation.light).sort().join() !== Object.keys(tokens.elevation.dark).sort().join()) {
    errors.push("elevation.light and elevation.dark keys must match");
  }

  for (const mode of ["light", "dark"]) {
    const flattened = flattenColorMode(tokens.color[mode], tokens);
    for (const [name, value] of Object.entries(flattened)) {
      if (!isColorValue(value)) {
        errors.push(`color.${mode}.${name} is not a colour value: ${value}`);
      }
    }
  }

  return errors;
}

function cssCustomProperties(entries, indent = "  ") {
  return Object.entries(entries)
    .map(([name, value]) => `${indent}--${name}: ${value};`)
    .join("\n");
}

export function semanticColorVars(flattened) {
  return Object.fromEntries(Object.entries(flattened).map(([name, value]) => [name, value]));
}

export function aliasVars(tokens) {
  const aliases = {};
  for (const [name, raw] of Object.entries(tokens.alias?.color ?? {})) {
    const ref = typeof raw === "string" ? raw.replace(/^\{|\}$/g, "") : raw;
    if (typeof ref === "string" && ref.startsWith("color.")) {
      const target = toKebab(ref.slice("color.".length));
      if (target === toKebab(name)) {
        continue;
      }
      aliases[toKebab(name)] = `var(--${target})`;
      continue;
    }
    aliases[toKebab(name)] = resolveValue(raw, tokens);
  }
  return aliases;
}

function sharedNonColorVars(tokens) {
  const latin = tokens.typography.family.latin.stack;
  const arabic = tokens.typography.family.arabic.stack;
  const display = tokens.typography.family.display?.stack;
  const vars = {
    "font-latin": latin,
    ...(display ? { "font-display": display } : {}),
    "font-arabic": arabic,
    "icon-size": tokens.icon.size.rem,
    "icon-stroke": String(tokens.icon.strokeWidth),
    "layout-max-width": tokens.layout.maxWidth.rem,
    "layout-gutter-desktop": tokens.layout.gutterDesktop.rem,
    "layout-gutter-mobile": tokens.layout.gutterMobile.rem,
    "layout-min-target": tokens.layout.minTarget.rem,
  };

  for (const [name, value] of Object.entries(tokens.typography.size)) {
    vars[`font-size-${name}`] = value;
  }
  for (const [name, value] of Object.entries(tokens.typography.lineHeight)) {
    vars[`line-height-${name}`] = String(value);
  }
  for (const [name, value] of Object.entries(tokens.typography.weight)) {
    vars[`weight-${name}`] = String(value);
  }
  for (const [name, value] of Object.entries(tokens.spacing)) {
    vars[`space-${name}`] = value.rem;
  }
  for (const [name, value] of Object.entries(tokens.radius)) {
    vars[`radius-${name}`] = value.rem;
  }
  for (const [name, value] of Object.entries(tokens.motion.duration)) {
    vars[`motion-${name}`] = value;
  }
  for (const [name, value] of Object.entries(tokens.motion.easing)) {
    vars[`ease-${name}`] = value;
  }
  return vars;
}

function elevationVars(modeElevation) {
  return Object.fromEntries(Object.entries(modeElevation).map(([name, value]) => [`elevation-${name}`, value]));
}

export function generateTokensCss(tokens) {
  const light = semanticColorVars(flattenColorMode(tokens.color.light, tokens));
  const dark = semanticColorVars(flattenColorMode(tokens.color.dark, tokens));
  const aliases = aliasVars(tokens);
  const shared = sharedNonColorVars(tokens);

  return `${CSS_BANNER}

:root {
${cssCustomProperties({ ...light, ...elevationVars(tokens.elevation.light), ...shared, ...withoutConflicts(aliases, light) })}
}

.dark,
[data-theme="dark"] {
${cssCustomProperties({ ...dark, ...elevationVars(tokens.elevation.dark), ...withoutConflicts(aliases, dark) })}
}
`;
}

function withoutConflicts(aliases, existing) {
  return Object.fromEntries(Object.entries(aliases).filter(([name]) => !(name in existing)));
}

export function generateTailwindThemeCss(tokens) {
  const light = flattenColorMode(tokens.color.light, tokens);
  const colorTheme = Object.fromEntries(Object.keys(light).map((name) => [`color-${name}`, `var(--${name})`]));
  const aliasTheme = Object.fromEntries(
    Object.keys(tokens.alias?.color ?? {}).map((name) => [`color-${toKebab(name)}`, `var(--${toKebab(name)})`]),
  );
  const radiusTheme = Object.fromEntries(
    Object.entries(tokens.radius).map(([name, value]) => [`radius-${name}`, value.rem]),
  );
  const shadowTheme = Object.fromEntries(
    Object.keys(tokens.elevation.light).map((name) => [`shadow-${name}`, `var(--elevation-${name})`]),
  );
  const durationTheme = Object.fromEntries(
    Object.entries(tokens.motion.duration).map(([name, value]) => [`duration-${name}`, value]),
  );
  const easeTheme = Object.fromEntries(
    Object.entries(tokens.motion.easing).map(([name, value]) => [`ease-${name}`, value]),
  );
  const spacingTheme = Object.fromEntries(
    Object.entries(tokens.spacing).map(([name, value]) => [`spacing-${name}`, value.rem]),
  );
  const fontSizeTheme = Object.fromEntries(
    Object.entries(tokens.typography.size).map(([name, value]) => [`text-${name}`, value]),
  );
  const leadingTheme = Object.fromEntries(
    Object.entries(tokens.typography.lineHeight).map(([name, value]) => [`leading-${name}`, String(value)]),
  );
  const weightTheme = Object.fromEntries(
    Object.entries(tokens.typography.weight).map(([name, value]) => [`font-weight-${name}`, String(value)]),
  );

  const theme = {
    ...colorTheme,
    ...aliasTheme,
    "font-sans": tokens.typography.family.latin.stack,
    ...(tokens.typography.family.display ? { "font-display": tokens.typography.family.display.stack } : {}),
    "font-arabic": tokens.typography.family.arabic.stack,
    radius: tokens.radius.control.rem,
    ...radiusTheme,
    ...shadowTheme,
    ...durationTheme,
    ...easeTheme,
    ...spacingTheme,
    ...fontSizeTheme,
    ...leadingTheme,
    ...weightTheme,
  };

  return `${CSS_BANNER}

@theme inline {
${cssCustomProperties(theme)}
}
`;
}

function nestColorEntries(flattened) {
  const nested = {};
  for (const [name, cssVar] of Object.entries(flattened)) {
    const parts = name.split("-");
    if (parts.length === 1) {
      const current = nested[parts[0]];
      if (current && typeof current === "object") {
        current.DEFAULT = cssVar;
      } else {
        nested[parts[0]] = cssVar;
      }
      continue;
    }
    const [head, ...rest] = parts;
    const key = rest.join("-");
    if (typeof nested[head] === "string") {
      nested[head] = { DEFAULT: nested[head] };
    }
    if (!nested[head] || typeof nested[head] !== "object") {
      nested[head] = {};
    }
    nested[head][key] = cssVar;
  }
  return nested;
}

export function generateTailwindThemeTs(tokens) {
  const light = flattenColorMode(tokens.color.light, tokens);
  const semanticColors = Object.fromEntries(Object.keys(light).map((name) => [name, `var(--${name})`]));
  const aliasColors = Object.fromEntries(
    Object.keys(tokens.alias?.color ?? {}).map((name) => [name, `var(--${name})`]),
  );
  const colors = { ...nestColorEntries(semanticColors) };
  for (const [name, value] of Object.entries(aliasColors)) {
    if (!(name in colors)) {
      colors[name] = value;
    }
  }
  const fontFamily = {
    sans: ["var(--font-latin)", "system-ui", "sans-serif"],
    ...(tokens.typography.family.display ? { display: ["var(--font-display)", "Georgia", "serif"] } : {}),
    arabic: ["var(--font-arabic)", "Tahoma", "sans-serif"],
  };
  const fontSize = Object.fromEntries(
    Object.keys(tokens.typography.size).map((name) => [name, `var(--font-size-${name})`]),
  );
  const borderRadius = Object.fromEntries(
    Object.entries(tokens.radius).map(([name]) => [name, `var(--radius-${name})`]),
  );
  const boxShadow = Object.fromEntries(
    Object.keys(tokens.elevation.light).map((name) => [name, `var(--elevation-${name})`]),
  );
  const transitionDuration = Object.fromEntries(
    Object.keys(tokens.motion.duration).map((name) => [name, `var(--motion-${name})`]),
  );
  const transitionTimingFunction = Object.fromEntries(
    Object.keys(tokens.motion.easing).map((name) => [name, `var(--ease-${name})`]),
  );
  const maxWidth = { page: "var(--layout-max-width)" };
  const minHeight = { target: "var(--layout-min-target)" };
  const minWidth = { target: "var(--layout-min-target)" };

  return `${GENERATED_BANNER}

export const mshwarTheme = {
  colors: ${indentJson(colors)},
  fontFamily: ${indentJson(fontFamily)},
  fontSize: ${indentJson(fontSize)},
  borderRadius: ${indentJson(borderRadius)},
  boxShadow: ${indentJson(boxShadow)},
  transitionDuration: ${indentJson(transitionDuration)},
  transitionTimingFunction: ${indentJson(transitionTimingFunction)},
  maxWidth: ${indentJson(maxWidth)},
  minHeight: ${indentJson(minHeight)},
  minWidth: ${indentJson(minWidth)},
} as const;
`;
}

function indentJson(value) {
  return JSON.stringify(value, null, 2).replace(/\n/g, "\n  ");
}

function hexToFigmaColor(value) {
  const hex = value.replace("#", "");
  if (![3, 6, 8].includes(hex.length) && !value.startsWith("rgb")) {
    return { type: "COLOR", hex: value };
  }
  if (value.startsWith("rgb")) {
    const nums = value
      .replace(/rgba?\(|\)/g, "")
      .split(",")
      .map((part) => Number.parseFloat(part.trim()));
    const [r, g, b, a = 1] = nums;
    return {
      type: "COLOR",
      r: r / 255,
      g: g / 255,
      b: b / 255,
      a,
      hex: value,
    };
  }
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : hex.slice(0, 6);
  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return { type: "COLOR", r, g, b, a, hex: value };
}

function tokenStudioEntry(value, type) {
  return { value, type };
}

function nestBySlash(entries) {
  const tree = {};
  for (const [pathName, entry] of Object.entries(entries)) {
    const parts = pathName.split("/");
    let cursor = tree;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        cursor[part] = entry;
      } else {
        cursor[part] = cursor[part] ?? {};
        cursor = cursor[part];
      }
    });
  }
  return tree;
}

export function generateFigmaVariables(tokens) {
  const light = flattenColorMode(tokens.color.light, tokens);
  const dark = flattenColorMode(tokens.color.dark, tokens);
  const colorVariables = Object.keys(light).map((name) => ({
    name: name.replace(/-/g, "/"),
    type: "COLOR",
    valuesByMode: {
      light: hexToFigmaColor(light[name]),
      dark: hexToFigmaColor(dark[name]),
    },
  }));

  const radiusVariables = Object.entries(tokens.radius).map(([name, value]) => ({
    name,
    type: "FLOAT",
    valuesByMode: { default: value.px },
  }));
  const spacingVariables = Object.entries(tokens.spacing).map(([name, value]) => ({
    name,
    type: "FLOAT",
    valuesByMode: { default: value.px },
  }));
  const motionVariables = [
    ...Object.entries(tokens.motion.duration).map(([name, value]) => ({
      name: `duration/${name}`,
      type: "STRING",
      valuesByMode: { default: value },
    })),
    ...Object.entries(tokens.motion.easing).map(([name, value]) => ({
      name: `easing/${name}`,
      type: "STRING",
      valuesByMode: { default: value },
    })),
  ];

  return {
    $description:
      "Figma Variables collection payload for manual import. There is no Figma API access in this repository; publish from Tokens Studio or recreate this collection in Figma. See FIGMA-IMPORT.md.",
    collections: [
      {
        name: "Mshwar / Color",
        modes: ["light", "dark"],
        variables: colorVariables,
      },
      {
        name: "Mshwar / Radius",
        modes: ["default"],
        variables: radiusVariables,
      },
      {
        name: "Mshwar / Spacing",
        modes: ["default"],
        variables: spacingVariables,
      },
      {
        name: "Mshwar / Motion",
        modes: ["default"],
        variables: motionVariables,
      },
      {
        name: "Mshwar / Type",
        modes: ["default"],
        variables: [
          {
            name: "family/latin",
            type: "STRING",
            valuesByMode: { default: tokens.typography.family.latin.name },
          },
          ...(tokens.typography.family.display
            ? [
                {
                  name: "family/display",
                  type: "STRING",
                  valuesByMode: { default: tokens.typography.family.display.name },
                },
              ]
            : []),
          {
            name: "family/arabic",
            type: "STRING",
            valuesByMode: { default: tokens.typography.family.arabic.name },
          },
          ...Object.entries(tokens.typography.size).map(([name, value]) => ({
            name: `size/${name}`,
            type: "STRING",
            valuesByMode: { default: value },
          })),
        ],
      },
      {
        name: "Mshwar / Elevation",
        modes: ["light", "dark"],
        variables: Object.keys(tokens.elevation.light).map((name) => ({
          name,
          type: "STRING",
          valuesByMode: {
            light: tokens.elevation.light[name],
            dark: tokens.elevation.dark[name],
          },
        })),
      },
    ],
  };
}

export function generateTokensStudio(tokens) {
  const light = flattenColorMode(tokens.color.light, tokens);
  const dark = flattenColorMode(tokens.color.dark, tokens);
  const colorLight = nestBySlash(
    Object.fromEntries(
      Object.entries(light).map(([name, value]) => [name.replace(/-/g, "/"), tokenStudioEntry(value, "color")]),
    ),
  );
  const colorDark = nestBySlash(
    Object.fromEntries(
      Object.entries(dark).map(([name, value]) => [name.replace(/-/g, "/"), tokenStudioEntry(value, "color")]),
    ),
  );

  const core = {
    primitive: {
      color: Object.fromEntries(
        Object.entries(tokens.primitive.color).map(([name, value]) => [name, tokenStudioEntry(value, "color")]),
      ),
    },
    font: {
      family: {
        latin: tokenStudioEntry(tokens.typography.family.latin.stack, "fontFamilies"),
        ...(tokens.typography.family.display
          ? { display: tokenStudioEntry(tokens.typography.family.display.stack, "fontFamilies") }
          : {}),
        arabic: tokenStudioEntry(tokens.typography.family.arabic.stack, "fontFamilies"),
      },
      size: Object.fromEntries(
        Object.entries(tokens.typography.size).map(([name, value]) => [name, tokenStudioEntry(value, "fontSizes")]),
      ),
      lineHeight: Object.fromEntries(
        Object.entries(tokens.typography.lineHeight).map(([name, value]) => [
          name,
          tokenStudioEntry(String(value), "lineHeights"),
        ]),
      ),
      weight: Object.fromEntries(
        Object.entries(tokens.typography.weight).map(([name, value]) => [name, tokenStudioEntry(value, "fontWeights")]),
      ),
    },
    space: Object.fromEntries(
      Object.entries(tokens.spacing).map(([name, value]) => [name, tokenStudioEntry(`${value.px}`, "spacing")]),
    ),
    radius: Object.fromEntries(
      Object.entries(tokens.radius).map(([name, value]) => [name, tokenStudioEntry(`${value.px}`, "borderRadius")]),
    ),
    motion: {
      duration: Object.fromEntries(
        Object.entries(tokens.motion.duration).map(([name, value]) => [name, tokenStudioEntry(value, "other")]),
      ),
      easing: Object.fromEntries(
        Object.entries(tokens.motion.easing).map(([name, value]) => [name, tokenStudioEntry(value, "other")]),
      ),
    },
  };

  return {
    $description:
      "Tokens Studio for Figma export. Import this file, then use 'Styles & Variables → Export to Figma' to publish a Variables collection. Actual Figma publish is manual (MSHWAR-169).",
    core,
    "semantic/light": {
      color: colorLight,
      elevation: Object.fromEntries(
        Object.entries(tokens.elevation.light).map(([name, value]) => [name, tokenStudioEntry(value, "boxShadow")]),
      ),
    },
    "semantic/dark": {
      color: colorDark,
      elevation: Object.fromEntries(
        Object.entries(tokens.elevation.dark).map(([name, value]) => [name, tokenStudioEntry(value, "boxShadow")]),
      ),
    },
    $themes: [
      {
        id: "mshwar-light",
        name: "Light",
        selectedTokenSets: {
          core: "source",
          "semantic/light": "enabled",
          "semantic/dark": "disabled",
        },
      },
      {
        id: "mshwar-dark",
        name: "Dark",
        selectedTokenSets: {
          core: "source",
          "semantic/light": "disabled",
          "semantic/dark": "enabled",
        },
      },
    ],
  };
}

export function generateW3cTokens(tokens) {
  const toDtcgColor = (value) => ({ $type: "color", $value: value });
  const light = flattenColorMode(tokens.color.light, tokens);
  const dark = flattenColorMode(tokens.color.dark, tokens);

  const color = {};
  for (const name of Object.keys(light)) {
    color[name] = {
      $type: "color",
      $value: light[name],
      $extensions: {
        "com.mshwar.modes": {
          light: light[name],
          dark: dark[name],
        },
      },
    };
  }

  return {
    $description:
      "W3C Design Tokens Community Group format. Modes are stored on $extensions.com.mshwar.modes until DTCG ships first-class themes.",
    color,
    fontFamily: {
      latin: { $type: "fontFamily", $value: tokens.typography.family.latin.name },
      ...(tokens.typography.family.display
        ? { display: { $type: "fontFamily", $value: tokens.typography.family.display.name } }
        : {}),
      arabic: { $type: "fontFamily", $value: tokens.typography.family.arabic.name },
    },
    fontSize: Object.fromEntries(
      Object.entries(tokens.typography.size).map(([name, value]) => [name, { $type: "dimension", $value: value }]),
    ),
    spacing: Object.fromEntries(
      Object.entries(tokens.spacing).map(([name, value]) => [name, { $type: "dimension", $value: value.rem }]),
    ),
    radius: Object.fromEntries(
      Object.entries(tokens.radius).map(([name, value]) => [name, { $type: "dimension", $value: value.rem }]),
    ),
    elevation: Object.fromEntries(
      Object.keys(tokens.elevation.light).map((name) => [
        name,
        {
          $type: "shadow",
          $value: tokens.elevation.light[name],
          $extensions: {
            "com.mshwar.modes": {
              light: tokens.elevation.light[name],
              dark: tokens.elevation.dark[name],
            },
          },
        },
      ]),
    ),
    duration: Object.fromEntries(
      Object.entries(tokens.motion.duration).map(([name, value]) => [name, { $type: "duration", $value: value }]),
    ),
    cubicBezier: Object.fromEntries(
      Object.entries(tokens.motion.easing).map(([name, value]) => {
        const parts = value.match(/cubic-bezier\(([^)]+)\)/);
        const nums = parts ? parts[1].split(",").map((item) => Number.parseFloat(item.trim())) : value;
        return [name, { $type: "cubicBezier", $value: nums }];
      }),
    ),
    primitive: {
      color: Object.fromEntries(
        Object.entries(tokens.primitive.color).map(([name, value]) => [name, toDtcgColor(value)]),
      ),
    },
  };
}

export function generateBrandCss(tokens) {
  const light = flattenColorMode(tokens.color.light, tokens);
  return `${CSS_BANNER}

:root {
  --m-cedar: ${resolveValue("{primitive.color.cedar}", tokens)};
  --m-orange: ${resolveValue("{primitive.color.orange}", tokens)};
  --m-canvas: var(--surface);
  --m-text: var(--text);
  --m-muted: var(--text-muted);
  --m-border: var(--border);
  --m-surface: var(--surface-raised);
  --m-error: var(--danger);
  --m-success: var(--success);
  --m-font: var(--font-latin);
  --m-radius-control: var(--radius-control);
  --m-radius-card: var(--radius-card);
  --m-focus: var(--focus);
  --m-motion: var(--motion-quick);
}

.mshwar {
  font-family: var(--font-latin);
  color: var(--text);
  background: var(--surface);
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
}

.mshwar:lang(ar),
.mshwar [lang="ar"] {
  font-family: var(--font-arabic);
  line-height: var(--line-height-arabic);
  letter-spacing: normal;
}

.mshwar :focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
}

.mshwar .primary-action {
  background: var(--brand);
  color: var(--brand-foreground);
  min-height: var(--layout-min-target);
  padding: var(--space-3) var(--space-6);
  border: 0;
  border-radius: var(--radius-control);
  font: inherit;
  font-weight: var(--weight-bold);
  cursor: pointer;
}

.mshwar .accent-action {
  background: var(--accent);
  color: var(--accent-foreground);
  min-height: var(--layout-min-target);
  padding: var(--space-3) var(--space-6);
  border: 0;
  border-radius: var(--radius-control);
  font: inherit;
  font-weight: var(--weight-bold);
  cursor: pointer;
}

.mshwar button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .mshwar * {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}

/* Accent text on orange is ${light["accent-foreground"]} / ${light.accent} — not a media-query-only colour. */
`;
}

export function generateAll(tokens) {
  return {
    [path.join(BRAND_ROOT, "generated/tokens.css")]: generateTokensCss(tokens),
    [path.join(BRAND_ROOT, "generated/tailwind-theme.css")]: generateTailwindThemeCss(tokens),
    [path.join(BRAND_ROOT, "generated/tailwind-theme.ts")]: generateTailwindThemeTs(tokens),
    [path.join(BRAND_ROOT, "generated/figma-variables.json")]:
      `${JSON.stringify(generateFigmaVariables(tokens), null, 2)}\n`,
    [path.join(BRAND_ROOT, "generated/tokens-studio.json")]:
      `${JSON.stringify(generateTokensStudio(tokens), null, 2)}\n`,
    [path.join(BRAND_ROOT, "generated/w3c-tokens.json")]: `${JSON.stringify(generateW3cTokens(tokens), null, 2)}\n`,
    [path.join(BRAND_ROOT, "brand.css")]: generateBrandCss(tokens),
    [path.join(REPO_ROOT, "apps/web/src/styles/generated/tokens.css")]: generateTokensCss(tokens),
    [path.join(REPO_ROOT, "apps/web/src/styles/generated/tailwind-theme.css")]: generateTailwindThemeCss(tokens),
    [path.join(REPO_ROOT, "apps/web/src/styles/generated/tailwind-theme.ts")]: generateTailwindThemeTs(tokens),
  };
}

export function writeGeneratedFiles(files) {
  for (const [filePath, contents] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
  }
}

export function checkGeneratedFiles(files) {
  const stale = [];
  for (const [filePath, contents] of Object.entries(files)) {
    if (!fs.existsSync(filePath) || fs.readFileSync(filePath, "utf8") !== contents) {
      stale.push(path.relative(REPO_ROOT, filePath));
    }
  }
  return stale;
}

export function colorsDefinedOnlyInMediaQuery(css) {
  const mediaBlocks = [...css.matchAll(/@media[^{]+\{([\s\S]*?)\n\}/g)].map((match) => match[1]);
  const rootAndDark = css.replace(/@media[^{]+\{[\s\S]*?\n\}/g, "");
  const colorIn = (block) =>
    [...block.matchAll(/--[a-z0-9-]+:\s*(#[0-9A-Fa-f]{3,8}|rgba?\([^)]+\))/g)].map((match) => `${match[0]}`);
  const baseline = new Set(colorIn(rootAndDark));
  return mediaBlocks.flatMap((block) => colorIn(block).filter((decl) => !baseline.has(decl)));
}

function main() {
  const tokens = loadTokens();
  const errors = validateTokens(tokens);
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`Token validation failed: ${error}`);
    }
    process.exit(1);
  }

  const files = generateAll(tokens);
  const check = process.argv.includes("--check");
  if (check) {
    const stale = checkGeneratedFiles(files);
    if (stale.length > 0) {
      console.error("Generated token artifacts are stale. Run `pnpm tokens:generate`.\n");
      for (const file of stale) {
        console.error(`  - ${file}`);
      }
      process.exit(1);
    }
    const mediaOnly = Object.values(files)
      .filter((contents) => contents.includes(":root"))
      .flatMap((contents) => colorsDefinedOnlyInMediaQuery(contents));
    if (mediaOnly.length > 0) {
      console.error("Colours must not be defined only inside a media query:");
      for (const decl of mediaOnly) {
        console.error(`  - ${decl}`);
      }
      process.exit(1);
    }
    console.log("Design token artifacts are up to date.");
    return;
  }

  writeGeneratedFiles(files);
  console.log(`Wrote ${Object.keys(files).length} token artifacts from ${path.relative(REPO_ROOT, TOKEN_PATH)}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
