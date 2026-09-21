"use client";

import { CloudSun, CloudRainWind } from "lucide-react";
import { Notice } from "@/components/ui/notice";
import { usePlannerCopy } from "@/lib/planner-copy";
import type { WarningResult } from "@/lib/planner";

export function WeatherWarningList({ result }: { result: WarningResult | null }) {
  const copy = usePlannerCopy();
  if (!result) {
    return null;
  }
  if (result.forecast_unavailable && result.warnings.length === 0) {
    return <Notice icon={<CloudSun aria-hidden />}>{copy.forecastUnavailable}</Notice>;
  }
  if (result.warnings.length === 0) {
    return (
      <Notice tone="success" icon={<CloudSun aria-hidden />}>
        {copy.noWarning}
      </Notice>
    );
  }
  return (
    <ul className="grid gap-3">
      {result.warnings.map((warning) => (
        <li
          key={warning.stop_id}
          className="grid gap-2 rounded-control border border-warning/25 bg-warning-subtle/70 p-4"
        >
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-warning">
            <CloudRainWind className="size-4" aria-hidden />
            {copy.weatherWarning}
          </p>
          <p className="text-xs text-text-muted">
            {warning.stop_label} · {warning.source} · {warning.fetched_at ?? warning.forecast_date}
          </p>
          <ul className="grid list-disc gap-1 ps-5 text-sm">
            {warning.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
