/**
 * Split editorial headlines so the tail can be set in the serif accent face
 * without adding per-locale copy keys. Works on any locale string.
 */
export function splitTail(text: string, words = 1): [string, string] {
  const parts = text.trim().split(/\s+/);
  if (parts.length <= words) {
    return ["", text.trim()];
  }
  return [parts.slice(0, -words).join(" "), parts.slice(-words).join(" ")];
}

/** Split at the first opening quote (“ « ") — "start with “yalla.”" → ["start with", "“yalla.”"]. */
export function splitAtQuote(text: string): [string, string] {
  const index = text.search(/[“«"]/);
  if (index <= 0) {
    return splitTail(text);
  }
  return [text.slice(0, index).trimEnd(), text.slice(index)];
}

/** Split two-sentence headlines ("A whole country. Your next discovery.") at the first full stop. */
export function splitSentence(text: string): [string, string] {
  const match = text.match(/^(.+?[.!?؟])\s+(.+)$/);
  if (!match) {
    return [text, ""];
  }
  return [match[1], match[2]];
}

export function initials(name: string | undefined | null): string {
  const clean = (name ?? "").trim();
  if (!clean) {
    return "·";
  }
  const [first, second] = clean.split(/\s+/);
  return `${first?.[0] ?? ""}${second?.[0] ?? ""}`.toUpperCase();
}

/** Split at the first comma (Latin or Arabic), keeping the comma on the lead. */
export function splitAtComma(text: string): [string, string] {
  const match = text.match(/^(.+?[,،])\s+(.+)$/);
  if (!match) {
    return [text, ""];
  }
  return [match[1], match[2]];
}
