# Import tokens into Figma Variables (MSHWAR-169)

This repository has **no Figma API access**. Publishing a Variables collection is a **manual** designer step. The generator prepares importable files so a colour change still starts from `design-tokens.json`.

## Generated files

| File                             | Format                               | Use                                                                                           |
| -------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `generated/tokens-studio.json`   | Tokens Studio multi-set + `$themes`  | Preferred. Import, then export to Figma Variables.                                            |
| `generated/figma-variables.json` | Collection / mode / variable payload | Recreate collections by hand, or feed a future API script.                                    |
| `generated/w3c-tokens.json`      | W3C Design Tokens (DTCG)             | Tooling that speaks the community format. Dark values live on `$extensions.com.mshwar.modes`. |

Regenerate after any token edit:

```bash
pnpm tokens:generate
```

## Recommended path: Tokens Studio

1. In Figma, install [Tokens Studio for Figma](https://tokens.studio/).
2. Open the Mshwar file that should own the official Variables collection.
3. Tokens Studio → **Load / Import** → choose `mshwar-brand-foundation/generated/tokens-studio.json`.
4. Confirm these token sets exist:
   - `core` — primitives (cedar, orange, …) as a source set only
   - `semantic/light` — product tokens
   - `semantic/dark` — the same keys, dark values
5. Themes: **Light** enables `semantic/light`; **Dark** enables `semantic/dark`.
6. **Styles & Variables → Export to Figma** (or **Create variables**).
   - Create a collection per group, or one **Mshwar / Color** collection with `light` and `dark` modes.
   - Map `color/surface`, `color/accent`, `color/danger`, and the other semantic names. Do not publish primitive hue steps as style names.
7. Save the Figma file. That save **is** the “publish Variables collection” step for MSHWAR-169.

Re-import the JSON whenever `design-tokens.json` changes. Tokens Studio will update existing variables when names match.

## Manual path: recreate from `figma-variables.json`

If Tokens Studio is unavailable:

1. Open `generated/figma-variables.json`.
2. In Figma: **Local variables** → create the listed collections (`Mshwar / Color`, `Mshwar / Radius`, `Mshwar / Spacing`, `Mshwar / Motion`, `Mshwar / Type`, `Mshwar / Elevation`).
3. For **Mshwar / Color** and **Mshwar / Elevation**, add modes `light` and `dark`.
4. Create each variable (`surface`, `surface/raised`, `text`, `accent`, `danger`, …) and paste the `valuesByMode` colours. Hex/RGBA is on each entry; `r`/`g`/`b`/`a` are 0–1 floats if you script the creation later.
5. Bind component styles to the **semantic** names, not to primitives.

## What this does not do

- It does not call the Figma REST API or Variables API.
- It does not overwrite a live Figma file from CI.
- It does not claim the Figma library is already published to the org.

When API credentials exist, `figma-variables.json` is the payload to send. Until then, import remains a documented manual publish.

## 54-screen frames (MSHWAR-27)

Token Variables are only half of the Figma source of truth. The **code-side 54-screen inventory** — every live route, the 22 gap/state pads, the 390px mobile-20 list, journey-band coordinates, handoff annotation text, and the publish-for-review checklist — lives in [FIGMA-54-SCREENS.md](./FIGMA-54-SCREENS.md) (JSON: [generated/figma-54-screens.json](./generated/figma-54-screens.json)).

Import Variables first (this page), then place or capture frames from that inventory. Live file: [Mshwar — Complete UI — Clickable Prototype](https://www.figma.com/design/CTLlkbyldx557zamdshjd5/Mshwar--Complete-UI--Clickable-Prototype) (page `54 screens`). This repository still does **not** write the live Figma file from CI.
