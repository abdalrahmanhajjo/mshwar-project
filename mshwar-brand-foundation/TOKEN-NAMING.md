# Token naming convention

Mshwar tokens are **semantic**. A colour change happens by editing `design-tokens.json` and regenerating. Product UI never references a hue-step name such as `orange-500`.

## Two layers

| Layer     | Where                       | Who consumes it                | Example                       |
| --------- | --------------------------- | ------------------------------ | ----------------------------- |
| Primitive | `primitive.color`           | Token authors only             | `cedar`, `orange`, `canvas`   |
| Semantic  | `color.light`, `color.dark` | Tailwind, CSS, Figma Variables | `surface`, `accent`, `danger` |

Primitives keep the brand pigment names from the original package so designers can still say “cedar” and “orange.” They are **not** emitted as Tailwind colour utilities. Semantic tokens reference primitives (`"{primitive.color.cedar}"`) and are the only names used in code.

## Path shape

```
{category}.{role}.{variant}
```

- **category** — `color`, `typography`, `spacing`, `radius`, `elevation`, `motion`, `layout`, `icon`
- **role** — the job the token does (`surface`, `text`, `accent`, `danger`, `duration`)
- **variant** — a modifier (`raised`, `muted`, `foreground`, `quick`)

CSS custom properties flatten the path and collapse `default`, `primary`, `canvas`, and `ring`:

| JSON path                | CSS variable       | Tailwind class      |
| ------------------------ | ------------------ | ------------------- |
| `color.*.surface.canvas` | `--surface`        | `bg-surface`        |
| `color.*.surface.raised` | `--surface-raised` | `bg-surface-raised` |
| `color.*.text.primary`   | `--text`           | `text-text`         |
| `color.*.text.muted`     | `--text-muted`     | `text-text-muted`   |
| `color.*.accent.default` | `--accent`         | `bg-accent`         |
| `color.*.danger.default` | `--danger`         | `bg-danger`         |
| `color.*.focus.ring`     | `--focus`          | `ring-focus`        |
| `spacing.4`              | `--space-4`        | `p-4` (4px grid)    |
| `radius.control`         | `--radius-control` | `rounded-control`   |
| `elevation.*.md`         | `--elevation-md`   | `shadow-md`         |
| `motion.duration.quick`  | `--motion-quick`   | `duration-quick`    |

## Colour roles

| Role                             | Use                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `surface`                        | Page (`canvas`), cards (`raised`), wells (`sunken`), modal scrim (`overlay`) |
| `text`                           | Primary copy, muted secondary copy, inverse, text on accent fills            |
| `accent`                         | Brand orange actions and selected details                                    |
| `brand`                          | Primary cedar actions (inverted on dark)                                     |
| `border`                         | Default dividers and stronger boundaries                                     |
| `danger` / `success` / `warning` | Status. Never encode booking state by colour alone.                          |
| `focus`                          | Keyboard focus ring                                                          |

Do **not** add `orange-500`, `cedar-700`, or similar literal scales to the semantic layer.

Text-on-fill pairings are asserted in `contrast-checks.json`. `accent` is a **fill**. Small text on orange uses `text-on-accent` / `accent.foreground`, never white, cedar, or `text-accent`.

## Modes

Light and dark are **the same key set** with different values. Both palettes live in the JSON. Generated CSS writes light values on `:root` and dark values on `.dark` / `[data-theme="dark"]`. No colour is introduced only inside a `prefers-color-scheme` media query.

`prefers-reduced-motion` may disable animation. That is behaviour, not a colour token.

## Aliases

`alias.color` maps semantic tokens onto the shadcn/ui contract (`background`, `foreground`, `primary`, `destructive`, `muted-foreground`, …) so existing components keep working while authors keep using `surface` / `brand` / `danger`.

## Changing a colour

1. Edit the primitive or the semantic reference in `design-tokens.json`.
2. Run `pnpm tokens:generate`.
3. Commit the JSON **and** the generated files.
4. Import the updated `generated/tokens-studio.json` into Figma (manual — see `FIGMA-IMPORT.md`).
