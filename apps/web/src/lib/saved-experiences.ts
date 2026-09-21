"use client";

import * as React from "react";

const STORAGE_KEY = "mshwar_saved_experiences";
const CHANGE_EVENT = "mshwar-saved-experiences";

function readRaw(): string {
  if (typeof window === "undefined") {
    return "[]";
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parseSaved(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function readSaved(): string[] {
  return parseSaved(readRaw());
}

// useSyncExternalStore calls this on every render: return the stored string as-is (cheap, stable).
function snapshot(): string {
  return readRaw();
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function writeSaved(next: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* Storage full or blocked: nothing is saved in this browser. */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function peekSavedExperiences() {
  return readSaved();
}

export function useSavedExperiences() {
  const raw = React.useSyncExternalStore(subscribe, snapshot, () => "[]");
  const slugs = React.useMemo(() => parseSaved(raw), [raw]);
  const saved = React.useMemo(() => new Set(slugs), [slugs]);

  const has = React.useCallback((slug: string) => saved.has(slug), [saved]);

  const toggle = React.useCallback((slug: string) => {
    const current = readSaved();
    const next = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug];
    writeSaved(next);
  }, []);

  return { slugs, has, toggle };
}
