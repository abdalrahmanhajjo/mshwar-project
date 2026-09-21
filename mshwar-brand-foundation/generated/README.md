# Generated token artifacts

Do not edit the token files in this folder. They are produced from `../design-tokens.json`. The exception is `figma-54-screens.json`, which is a hand-authored MSHWAR-27 inventory (see `../FIGMA-54-SCREENS.md`).

```bash
pnpm tokens:generate
```

| File | Consumer |
|---|---|
| `tokens.css` | CSS custom properties (light on `:root`, dark on `.dark`) |
| `tailwind-theme.css` | Tailwind v4 `@theme` |
| `tailwind-theme.ts` | `apps/web/tailwind.config.ts` |
| `tokens-studio.json` | Tokens Studio → Figma Variables |
| `figma-variables.json` | Manual Figma Variables collection |
| `w3c-tokens.json` | W3C Design Tokens export |
| `contrast-report.json` | Recomputed luminance and contrast for every in-use pairing |
| `figma-54-screens.json` | Hand-authored MSHWAR-27 frame inventory (not `tokens:generate`) |

`figma-54-screens.json` is the machine-readable copy of `../FIGMA-54-SCREENS.md`. Edit that pair together; do not regenerate it from `design-tokens.json`.

See `../FIGMA-IMPORT.md`, `../FIGMA-54-SCREENS.md`, and `../TOKEN-NAMING.md`.
