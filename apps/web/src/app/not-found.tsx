"use client";

import { ArrowLeft, Compass } from "lucide-react";
import { LogoSymbol } from "@/components/shell/brand-mark";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const { t } = useLocale();
  return (
    <main className="surface-grain relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-surface px-6 py-24 text-center text-text">
      <LocaleLink href="/" aria-label="Mshwar" className="absolute start-6 top-6">
        <LogoSymbol className="h-7" />
      </LocaleLink>
      <p className="eyebrow inline-flex items-center gap-2">
        <Compass className="size-4" aria-hidden />
        {t("notFoundKicker")}
      </p>
      <h1 className="mt-6 text-[clamp(6rem,18vw,12rem)] font-semibold leading-none tracking-[-0.06em]">
        4<span className="text-serif text-accent">0</span>4
      </h1>
      <p className="title-section mt-4 max-w-lg">{t("notFound")}</p>
      <p className="mt-3 max-w-md text-text-muted">{t("notFoundBody")}</p>
      <Button asChild size="lg" className="mt-8">
        <LocaleLink href="/">
          <ArrowLeft className="rtl:rotate-180" aria-hidden />
          {t("backHome")}
        </LocaleLink>
      </Button>
    </main>
  );
}
