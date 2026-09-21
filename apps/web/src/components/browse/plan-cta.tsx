"use client";

import { ArrowRight, ArrowUpRight, Leaf, Mountain, Sparkles, Waves } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import { useBrowseCopy } from "@/lib/browse-copy";
import { splitTail } from "@/lib/text";
import { cn } from "@/lib/utils";

export function PlanSplitCta() {
  const copy = useBrowseCopy();
  const [lead, tail] = splitTail(copy.onePlanTitle);
  const steps = [
    { time: copy.onePlanStep1, title: copy.onePlanPoint1, detail: copy.onePlanDetail1, icon: Mountain, accent: false },
    { time: copy.onePlanStep2, title: copy.onePlanPoint2, detail: copy.onePlanDetail2, icon: Leaf, accent: true },
    { time: copy.onePlanStep3, title: copy.onePlanPoint3, detail: copy.onePlanDetail3, icon: Waves, accent: false },
  ];

  return (
    <section className="relative isolate overflow-hidden rounded-[1.75rem] bg-brand text-brand-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute -end-24 -top-24 -z-10 size-96 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="grid items-center gap-10 p-8 md:p-14 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div className="grid gap-6">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-foreground/70">
            <Sparkles className="size-3.5" aria-hidden />
            {copy.onePlanKicker}
          </p>
          <h2 className="title-page max-w-md text-balance">
            {lead} <span className="text-serif text-accent">{tail}</span>
          </h2>
          <p className="max-w-sm text-brand-foreground/75">{copy.onePlanBody}</p>
          <Button asChild variant="accent" size="lg" className="w-fit">
            <LocaleLink href="/plan">
              {copy.buildTrip}
              <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
            </LocaleLink>
          </Button>
        </div>
        <div className="relative mx-auto w-full max-w-md lg:me-4">
          <div
            aria-hidden
            className="absolute inset-0 translate-y-3 rotate-[3deg] rounded-card bg-brand-foreground/10"
          />
          <div className="relative rotate-[2deg] rounded-card bg-surface-raised p-6 text-text shadow-lg transition-transform duration-slow hover:rotate-0 md:p-7">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
              {copy.onePlanCardKicker}
            </p>
            <ol className="mt-4 grid">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="flex items-center gap-4 border-b border-border-subtle py-4 last:border-b-0"
                >
                  <span
                    className={cn("size-2 shrink-0 rounded-full", step.accent ? "bg-accent" : "bg-brand")}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
                      {step.time}
                    </p>
                    <p className="mt-0.5 font-semibold tracking-tight">
                      <span className="sr-only">{index + 1}. </span>
                      {step.title}
                    </p>
                    <p className="text-xs text-text-muted">{step.detail}</p>
                  </div>
                  <step.icon className="size-4 shrink-0 text-text-muted" strokeWidth={1.6} aria-hidden />
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[0.6875rem] text-text-muted">{copy.onePlanCardNote}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SoftPlanCta() {
  const copy = useBrowseCopy();
  return (
    <section className="flex flex-col items-start justify-between gap-5 rounded-card bg-surface-sunken p-6 sm:flex-row sm:items-center md:p-8">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-raised text-text shadow-sm">
          <Sparkles className="size-5" strokeWidth={1.6} aria-hidden />
        </span>
        <div>
          <h2 className="title-card text-[1.4rem]">{copy.cantDecide}</h2>
          <p className="mt-1 text-sm text-text-muted">{copy.cantDecideBody}</p>
        </div>
      </div>
      <Button asChild size="lg">
        <LocaleLink href="/plan">
          {copy.planMyTrip}
          <ArrowRight className="rtl:-scale-x-100" aria-hidden />
        </LocaleLink>
      </Button>
    </section>
  );
}
