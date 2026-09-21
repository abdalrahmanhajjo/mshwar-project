"use client";

import { LocaleLink } from "@/components/shell/locale-link";
import { ArrowUpRight } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";
import { Wordmark } from "@/components/shell/brand-mark";
import { Eyebrow } from "@/components/ui/page-header";
import { useBrowseCopy } from "@/lib/browse-copy";
import { useLocale } from "@/components/shell/locale-provider";
import { CookieSettingsButton } from "@/components/legal/cookie-consent";
import { useTrustCopy } from "@/lib/trust-copy";
import { splitAtQuote } from "@/lib/text";
import type { ShellSurface } from "@/components/shell/nav-config";

const FOOTER_COPY: Record<ShellSurface, "travellerFooter" | "businessFooter" | "adminFooter"> = {
  traveller: "travellerFooter",
};

const linkClass = cn("rounded-sm text-text transition-colors hover:text-text/60", focusRing);

export function ShellFooter({ surface }: { surface: ShellSurface }) {
  const { t } = useLocale();
  const copy = useBrowseCopy();
  const trust = useTrustCopy();

  if (surface !== "traveller") {
    return (
      <footer className="mt-auto border-t border-border-subtle">
        <div className="shell-gutter flex flex-col gap-3 py-5 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Mshwar · {t(FOOTER_COPY[surface])}</p>
          <nav aria-label={t("contact")} className="flex flex-wrap gap-4">
            <LocaleLink href="/privacy" className={cn("hover:text-text", focusRing)}>
              {t("privacy")}
            </LocaleLink>
            <LocaleLink href="/terms" className={cn("hover:text-text", focusRing)}>
              {t("terms")}
            </LocaleLink>
            <LocaleLink href="/cancellation-policy" className={cn("hover:text-text", focusRing)}>
              {trust.cancellationLink}
            </LocaleLink>
            <LocaleLink href="/community-guidelines" className={cn("hover:text-text", focusRing)}>
              {trust.communityLink}
            </LocaleLink>
            <CookieSettingsButton />
            <LocaleLink href="/contact" className={cn("hover:text-text", focusRing)}>
              {t("contact")}
            </LocaleLink>
          </nav>
        </div>
      </footer>
    );
  }

  const [lead, quoted] = splitAtQuote(copy.yallaTitle);

  const columns = [
    { href: "/destinations", label: copy.exploreLebanon },
    { href: "/plan", label: copy.planATrip },
    { href: "/collections", label: copy.tripIdeas },
    { href: "/contact", label: copy.aboutMshwar },
    { href: "/contact", label: copy.helpCenter },
  ];
  const secondary = [
    { href: "/experiences", label: copy.allPages },
    { href: "/privacy", label: copy.photoCredits },
  ];

  return (
    <footer className="mt-auto">
      <div className="shell-frame">
        <div className="flex flex-col items-start justify-between gap-8 border-t border-border-subtle py-16 md:flex-row md:items-center md:py-20">
          <div className="grid gap-5">
            <Eyebrow>{copy.yallaKicker}</Eyebrow>
            <h2 className="title-page max-w-2xl text-balance text-text">
              {lead} <span className="text-serif">{quoted}</span>
            </h2>
          </div>
          <LocaleLink
            href="/plan"
            aria-label={copy.planATrip}
            className={cn(
              "group grid size-20 shrink-0 place-items-center rounded-full border border-border-subtle bg-brand-subtle text-text transition-all duration-normal hover:scale-105 hover:bg-brand hover:text-brand-foreground",
              focusRing,
            )}
          >
            <ArrowUpRight className="size-7 transition-transform group-hover:rotate-45 rtl:-scale-x-100" aria-hidden />
          </LocaleLink>
        </div>
      </div>
      <div className="bg-surface-sunken">
        <div className="shell-frame grid gap-10 py-12 md:grid-cols-[1fr_auto] md:py-14">
          <div className="grid content-start gap-3">
            <Wordmark className="text-[2.1rem]" />
            <p className="text-sm text-text-muted">{copy.footerPace}</p>
          </div>
          <nav aria-label={t("contact")} className="grid content-start gap-5 text-sm md:justify-items-end">
            <ul className="flex flex-wrap gap-x-7 gap-y-3">
              {columns.map((item) => (
                <li key={`${item.href}-${item.label}`}>
                  <LocaleLink href={item.href} className={linkClass}>
                    {item.label}
                  </LocaleLink>
                </li>
              ))}
            </ul>
            <ul className="flex flex-wrap gap-x-7 gap-y-3">
              {secondary.map((item) => (
                <li key={`${item.href}-${item.label}`}>
                  <LocaleLink href={item.href} className={linkClass}>
                    {item.label}
                  </LocaleLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="shell-frame">
          <div className="flex flex-col gap-4 border-t border-border-subtle py-6 text-xs text-text-muted lg:flex-row lg:items-center lg:justify-between">
            <p>© 2026 Mshwar</p>
            <p>{copy.sampleDisclaimer}</p>
            <div className="flex flex-wrap items-center gap-5">
              <LocaleLink href="/privacy" className={cn("hover:text-text", focusRing)}>
                {t("privacy")}
              </LocaleLink>
              <LocaleLink href="/terms" className={cn("hover:text-text", focusRing)}>
                {t("terms")}
              </LocaleLink>
              <LocaleLink href="/cancellation-policy" className={cn("hover:text-text", focusRing)}>
                {trust.cancellationLink}
              </LocaleLink>
              <LocaleLink href="/community-guidelines" className={cn("hover:text-text", focusRing)}>
                {trust.communityLink}
              </LocaleLink>
              <CookieSettingsButton />
              <LocaleLink href="/contact" className={cn("hover:text-text", focusRing)}>
                {t("contact")}
              </LocaleLink>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
