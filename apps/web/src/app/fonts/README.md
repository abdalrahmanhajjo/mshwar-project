# Self-hosted fonts

Loaded with `next/font/local` in `src/app/layout.tsx`, so builds never depend on Google Fonts being reachable.

| File                                 | Family                                | Axes                         | Source                                        |
| ------------------------------------ | ------------------------------------- | ---------------------------- | --------------------------------------------- |
| `dm-sans-latin-opsz.woff2`           | DM Sans (UI + headings)               | `wght` 100–1000, `opsz` 9–40 | `@fontsource-variable/dm-sans` 5.3.0          |
| `newsreader-latin-opsz-italic.woff2` | Newsreader Italic (editorial accents) | `wght` 200–800, `opsz` 6–72  | `@fontsource-variable/newsreader` 5.3.0       |
| `noto-sans-arabic-wght.woff2`        | Noto Sans Arabic                      | `wght` 100–900               | `@fontsource-variable/noto-sans-arabic` 5.3.0 |

All three families are licensed under the SIL Open Font License 1.1 (https://openfontlicense.org).
