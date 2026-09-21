"use client";

import * as React from "react";
import { ArrowUpRight, Building2, FileText, ShieldCheck, Ticket } from "lucide-react";
import { ShellMain } from "@/components/shell/app-shell";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { CookieSettingsButton } from "@/components/legal/cookie-consent";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/i18n/format";
import { CANCELLATION_POLICY } from "@/lib/legal/cancellation";
import { COMMUNITY_GUIDELINES } from "@/lib/legal/community";
import { fillLegalText } from "@/lib/legal/entity";
import { PRIVACY_POLICY } from "@/lib/legal/privacy";
import { TERMS_OF_SERVICE } from "@/lib/legal/terms";
import { LEGAL_VERSIONS, type LegalBlock, type LegalKind, type LegalLibrary } from "@/lib/legal/types";
import { useTrustCopy } from "@/lib/trust-copy";
import { cn, focusRing } from "@/lib/utils";

function LegalSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="grid scroll-mt-28 gap-5 border-t border-border-subtle pt-10"
    >
      <h2 id={`${id}-heading`} className="title-section text-[2rem]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function LegalLayout({
  label,
  sections,
  children,
}: {
  label: string;
  sections: { id: string; title: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-10 lg:grid-cols-[14rem_1fr] lg:gap-16">
      <nav aria-label={label} className="hidden lg:block">
        <ol className="sticky top-28 grid gap-1 border-s border-border-subtle">
          {sections.map((section, index) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className={cn(
                  "-ms-px flex gap-3 border-s border-transparent py-2 ps-4 text-sm text-text-muted transition-colors hover:border-brand hover:text-text",
                  focusRing,
                )}
              >
                <span className="tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="grid max-w-3xl gap-12">{children}</div>
    </div>
  );
}

export function ContactView() {
  const { t } = useLocale();
  const cards = [
    {
      icon: Ticket,
      title: t("contactTravellersTitle"),
      body: t("contactTravellersBody"),
      href: "/bookings",
      cta: t("openBookings"),
    },
    {
      icon: Building2,
      title: t("contactBusinessTitle"),
      body: t("contactBusinessBody"),
      href: "/business",
      cta: t("openPortal"),
    },
    {
      icon: ShieldCheck,
      title: t("contactPrivacyTitle"),
      body: t("contactPrivacyBody"),
      href: "/settings#privacy",
      cta: t("openSettings"),
    },
  ];
  return (
    <ShellMain>
      <PageHeader eyebrow={t("contactKicker")} title={t("contactTitle")} description={t("contactBody")} />
      <ul className="grid gap-5 md:grid-cols-3">
        {cards.map((card) => (
          <li
            key={card.href}
            className="flex flex-col gap-6 rounded-card border border-border-subtle bg-surface-raised p-7 shadow-sm"
          >
            <span className="grid size-12 place-items-center rounded-full bg-brand-subtle">
              <card.icon className="size-5" strokeWidth={1.6} aria-hidden />
            </span>
            <div className="grid gap-2">
              <h2 className="title-card text-[1.35rem]">{card.title}</h2>
              <p className="text-sm leading-relaxed text-text-muted">{card.body}</p>
            </div>
            <Button asChild variant="outline" className="mt-auto w-fit">
              <LocaleLink href={card.href}>
                {card.cta}
                <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
              </LocaleLink>
            </Button>
          </li>
        ))}
      </ul>
    </ShellMain>
  );
}

const LIBRARIES: Record<LegalKind, LegalLibrary> = {
  terms: TERMS_OF_SERVICE,
  privacy: PRIVACY_POLICY,
  cancellation: CANCELLATION_POLICY,
  community: COMMUNITY_GUIDELINES,
};

export const LEGAL_PATHS: Record<LegalKind, string> = {
  terms: "/terms",
  privacy: "/privacy",
  cancellation: "/cancellation-policy",
  community: "/community-guidelines",
};

/** Set NEXT_PUBLIC_LEGAL_REVIEWED=true once a lawyer has approved the published versions. */
const REVIEWED = process.env.NEXT_PUBLIC_LEGAL_REVIEWED === "true";

function Block({ block, fill }: { block: LegalBlock; fill: (text: string) => string }) {
  if (typeof block === "string") {
    return <p className="leading-relaxed text-text-muted">{fill(block)}</p>;
  }
  return (
    <ul className="grid list-disc gap-2 ps-5 leading-relaxed text-text-muted marker:text-text-muted">
      {block.list.map((item) => (
        <li key={item}>{fill(item)}</li>
      ))}
    </ul>
  );
}

/** One published trust document (MSHWAR-113), in the visitor's language. */
export function LegalDocumentView({ kind, children }: { kind: LegalKind; children?: React.ReactNode }) {
  const { t, locale } = useLocale();
  const copy = useTrustCopy();
  const doc = LIBRARIES[kind][locale];
  const version = LEGAL_VERSIONS[kind];
  const fill = React.useCallback((text: string) => fillLegalText(text, locale), [locale]);
  const sections = doc.sections.map((section) => ({ id: section.id, title: section.heading }));
  const related = (Object.keys(LIBRARIES) as LegalKind[]).filter((other) => other !== kind);

  return (
    <ShellMain>
      <PageHeader eyebrow={t("legalKicker")} title={doc.title} description={doc.summary} />
      <div className="-mt-4 mb-10 grid max-w-3xl gap-4">
        <p className="text-sm text-text-muted">
          {copy.legalVersion} <span className="tabular-nums">{version}</span> · {copy.legalEffective}{" "}
          <time dateTime={version}>
            {formatDate(locale, `${version}T00:00:00Z`, { dateStyle: "long", timeZone: "UTC" })}
          </time>
        </p>
        {REVIEWED ? null : <Notice tone="warning">{copy.legalDraft}</Notice>}
      </div>
      <LegalLayout label={copy.legalContents} sections={sections}>
        {doc.sections.map((section) => (
          <LegalSection key={section.id} id={section.id} title={section.heading}>
            {section.body.map((block, index) => (
              <Block key={index} block={block} fill={fill} />
            ))}
          </LegalSection>
        ))}
        {children}
        <nav aria-label={copy.legalRelated} className="grid gap-4 border-t border-border-subtle pt-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">{copy.legalRelated}</h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {related.map((other) => (
              <li key={other}>
                <LocaleLink
                  href={LEGAL_PATHS[other]}
                  className={cn(
                    "flex h-full items-center gap-3 rounded-card border border-border-subtle bg-surface-raised p-4 text-sm font-semibold transition-colors hover:border-brand",
                    focusRing,
                  )}
                >
                  <FileText className="size-4 shrink-0" strokeWidth={1.6} aria-hidden />
                  {LIBRARIES[other][locale].title}
                </LocaleLink>
              </li>
            ))}
          </ul>
        </nav>
      </LegalLayout>
    </ShellMain>
  );
}

export function TermsView() {
  return <LegalDocumentView kind="terms" />;
}

export function PrivacyPolicyView() {
  const copy = useTrustCopy();
  return (
    <LegalDocumentView kind="privacy">
      <section className="flex flex-wrap items-center gap-4 rounded-card border border-border-subtle bg-surface-raised p-6">
        <ShieldCheck className="size-5" strokeWidth={1.6} aria-hidden />
        <Button asChild className="w-fit">
          <LocaleLink href="/settings#privacy">
            {copy.legalManageData}
            <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
          </LocaleLink>
        </Button>
        <CookieSettingsButton className="text-sm font-semibold underline underline-offset-4" />
      </section>
    </LegalDocumentView>
  );
}

export function CancellationPolicyView() {
  return <LegalDocumentView kind="cancellation" />;
}

export function CommunityGuidelinesView() {
  return <LegalDocumentView kind="community" />;
}
