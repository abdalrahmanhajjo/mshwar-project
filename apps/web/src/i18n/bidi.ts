const LRI = "\u2066";
const RLI = "\u2067";
const PDI = "\u2069";

const ARABIC = /[\u0600-\u06FF]/;
const LATIN = /[A-Za-z]/;

export function hasMixedDirection(text: string): boolean {
  return ARABIC.test(text) && LATIN.test(text);
}

export function isolateBidi(text: string, dir: "ltr" | "rtl" = "ltr"): string {
  return `${dir === "rtl" ? RLI : LRI}${text}${PDI}`;
}

export function isolateLatinRuns(text: string): string {
  return text.replace(
    /[A-Za-z][A-Za-z0-9 .'-]*/g,
    (run) => isolateBidi(run.trimEnd(), "ltr") + (run.endsWith(" ") ? " " : ""),
  );
}

export function detectRunDirection(text: string): "ltr" | "rtl" {
  if (ARABIC.test(text) && !LATIN.test(text)) {
    return "rtl";
  }
  return "ltr";
}
