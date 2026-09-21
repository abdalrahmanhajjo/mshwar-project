"use client";

import * as React from "react";
import { Cookie } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import {
  ALLOW_ALL,
  ESSENTIAL_ONLY,
  onOpenCookieSettings,
  openCookieSettings,
  writeCookieChoices,
  type CookieChoices,
} from "@/lib/cookie-consent";
import { CookieConsentContext, useCookieChoices } from "@/components/legal/cookie-consent-state";
import { useTrustCopy } from "@/lib/trust-copy";
import { cn, focusRing } from "@/lib/utils";

function ChoiceRow({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
  alwaysOn,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  alwaysOn?: string;
  onChange?: (value: boolean) => void;
}) {
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="grid gap-0.5">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        <p id={`${id}-description`} className="text-xs leading-relaxed text-text-muted">
          {description}
        </p>
      </div>
      <span className="flex shrink-0 items-center gap-2 pt-0.5">
        {alwaysOn ? <span className="text-xs text-text-muted">{alwaysOn}</span> : null}
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-describedby={`${id}-description`}
          aria-checked={checked}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.checked)}
          className="size-5"
        />
      </span>
    </li>
  );
}

/**
 * Cookie banner and settings (MSHWAR-113). Shown until the visitor chooses; only
 * essential cookies are used until then. The footer's "Cookie settings" reopens it.
 */
export function CookieConsent() {
  const copy = useTrustCopy();
  const choices = useCookieChoices();
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [draft, setDraft] = React.useState<CookieChoices>(ESSENTIAL_ONLY);
  const [saved, setSaved] = React.useState(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(
    () =>
      onOpenCookieSettings(() => {
        setDraft(choices ?? ESSENTIAL_ONLY);
        setExpanded(true);
        setSaved(false);
        setOpen(true);
        window.requestAnimationFrame(() => headingRef.current?.focus());
      }),
    [choices],
  );

  function save(next: CookieChoices) {
    writeCookieChoices(next);
    setOpen(false);
    setExpanded(false);
    setSaved(true);
  }

  if (!open && choices) {
    return saved ? (
      <p role="status" className="sr-only">
        {copy.cookieSaved}
      </p>
    ) : null;
  }

  return (
    <section
      aria-labelledby="cookie-consent-title"
      onKeyDown={(event) => {
        if (event.key === "Escape" && choices) {
          setOpen(false);
        }
      }}
      className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-xl rounded-card border border-border-subtle bg-surface-raised p-5 shadow-lg sm:inset-x-auto sm:end-6 sm:bottom-6 sm:w-[28rem]"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-subtle">
          <Cookie className="size-4" aria-hidden />
        </span>
        <div className="grid gap-1.5">
          <h2 id="cookie-consent-title" ref={headingRef} tabIndex={-1} className="font-semibold outline-none">
            {copy.cookieTitle}
          </h2>
          <p className="text-sm leading-relaxed text-text-muted">
            {copy.cookieBody}{" "}
            <LocaleLink
              href="/privacy#cookies"
              className={cn("font-medium text-text underline underline-offset-4", focusRing)}
            >
              {copy.cookiePolicyLink}
            </LocaleLink>
          </p>
        </div>
      </div>
      {expanded ? (
        <ul className="mt-3 divide-y divide-border-subtle border-y border-border-subtle">
          <ChoiceRow
            id="cookie-essential"
            label={copy.cookieEssential}
            description={copy.cookieEssentialBody}
            checked
            disabled
            alwaysOn={copy.cookieAlwaysOn}
          />
          <ChoiceRow
            id="cookie-errors"
            label={copy.cookieErrors}
            description={copy.cookieErrorsBody}
            checked={draft.errors}
            onChange={(errors) => setDraft((current) => ({ ...current, errors }))}
          />
          <ChoiceRow
            id="cookie-maps"
            label={copy.cookieMaps}
            description={copy.cookieMapsBody}
            checked={draft.maps}
            onChange={(maps) => setDraft((current) => ({ ...current, maps }))}
          />
        </ul>
      ) : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {expanded ? (
          <Button type="button" size="sm" variant="outline" onClick={() => save(draft)}>
            {copy.cookieSave}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(choices ?? ESSENTIAL_ONLY);
              setExpanded(true);
            }}
          >
            {copy.cookieChoose}
          </Button>
        )}
        {/* Refusing is exactly as easy as accepting: same size, same prominence. */}
        <Button type="button" size="sm" variant="secondary" onClick={() => save(ESSENTIAL_ONLY)}>
          {copy.cookieEssentialOnly}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => save(ALLOW_ALL)}>
          {copy.cookieAllowAll}
        </Button>
      </div>
    </section>
  );
}

/** Footer link that reopens the cookie panel. */
export function CookieSettingsButton({ className }: { className?: string }) {
  const copy = useTrustCopy();
  return (
    <button type="button" className={cn("hover:text-text", focusRing, className)} onClick={openCookieSettings}>
      {copy.cookieSettings}
    </button>
  );
}

/** Hands the server-read cookie to the client so the first render matches. */
export function CookieConsentProvider({ initial, children }: { initial: string | null; children: React.ReactNode }) {
  return <CookieConsentContext.Provider value={initial}>{children}</CookieConsentContext.Provider>;
}
