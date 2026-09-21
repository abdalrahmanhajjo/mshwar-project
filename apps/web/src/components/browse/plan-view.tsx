"use client";

import { ArrowUpRight, Sparkles } from "lucide-react";
import { PlanDefaultsNote } from "@/components/profile/plan-defaults-note";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatPlural, interpolate } from "@/i18n/catalogues";
import { useCheckoutCopy } from "@/lib/checkout-copy";
import { usePlannerCopy } from "@/lib/planner-copy";
import { splitSentence } from "@/lib/text";

export function PlanView({
  collectionTitle,
  stopCount = 0,
  tripId,
  addSlug,
}: {
  collectionTitle?: string;
  stopCount?: number;
  tripId?: string;
  addSlug?: string;
}) {
  const { t, locale } = useLocale();
  const checkout = useCheckoutCopy();
  const planner = usePlannerCopy();
  const [lead, tail] = splitSentence(planner.pageTitle);
  const description = collectionTitle
    ? `${interpolate(t("planFromCollection"), { title: collectionTitle })} ${formatPlural(locale, stopCount, {
        one: t("planStopsOne"),
        other: t("planStopsOther"),
      })}`
    : planner.pageBody;

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow={planner.plannerKicker}
        icon={<Sparkles aria-hidden />}
        title={lead}
        accent={tail || undefined}
        description={description}
        actions={
          addSlug ? (
            <Button asChild size="lg" variant="accent">
              <LocaleLink href={`/checkout?listing=${addSlug}&source=itinerary`}>
                {checkout.bookThisStop}
                <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
              </LocaleLink>
            </Button>
          ) : null
        }
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {tripId ? <Badge variant="secondary">{interpolate(t("tripLabel"), { id: tripId })}</Badge> : null}
        <PlanDefaultsNote />
      </div>
    </div>
  );
}
