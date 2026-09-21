"use client";

import { ArrowLeft, RotateCcw, TriangleAlert } from "lucide-react";
import { LogoSymbol } from "@/components/shell/brand-mark";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";

// Next.js error boundary for every route below the root layout.
export default function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { t } = useLocale();
  return (
    <main className="surface-grain relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-surface px-6 py-24 text-center text-text">
      <LocaleLink href="/" aria-label="Mshwar" className="absolute start-6 top-6">
        <LogoSymbol className="h-7" />
      </LocaleLink>
      <p className="eyebrow inline-flex items-center gap-2">
        <TriangleAlert className="size-4" aria-hidden />
        {t("errorKicker")}
      </p>
      <h1 className="title-page mt-6 max-w-xl">{t("errorTitle")}</h1>
      <p className="mt-3 max-w-md text-text-muted">{t("errorBody")}</p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-text-muted">{error.digest}</p> : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button type="button" size="lg" onClick={() => retry()}>
          <RotateCcw aria-hidden />
          {t("tryAgain")}
        </Button>
        <Button asChild size="lg" variant="outline">
          <LocaleLink href="/">
            <ArrowLeft className="rtl:rotate-180" aria-hidden />
            {t("backHome")}
          </LocaleLink>
        </Button>
      </div>
    </main>
  );
}
