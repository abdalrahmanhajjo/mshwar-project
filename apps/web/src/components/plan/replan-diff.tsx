"use client";

import { ArrowRight } from "lucide-react";
import { usePlannerCopy } from "@/lib/planner-copy";
import type { ReplanResult } from "@/lib/planner";

export function ReplanDiff({ result }: { result: ReplanResult | null }) {
  const copy = usePlannerCopy();
  if (!result) {
    return null;
  }
  if (!result.applied) {
    return (
      <p role="status" className="rounded-control bg-surface-sunken px-4 py-3 text-sm">
        {result.message || copy.replanNone}
      </p>
    );
  }
  const beforeIds = result.before?.ordered_stops.map((stop) => stop.label).join(" → ") ?? "";
  const afterIds = result.after?.ordered_stops.map((stop) => stop.label).join(" → ") ?? "";
  return (
    <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr]">
      <div className="grid gap-1 rounded-control border border-border-subtle p-4">
        <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">{copy.before}</h4>
        <p className="text-sm">{beforeIds}</p>
      </div>
      <ArrowRight className="hidden size-4 self-center text-text-muted lg:block rtl:rotate-180" aria-hidden />
      <div className="grid gap-1 rounded-control border border-brand/40 bg-brand-subtle/50 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">{copy.after}</h4>
        <p className="text-sm">{afterIds}</p>
      </div>
    </div>
  );
}
