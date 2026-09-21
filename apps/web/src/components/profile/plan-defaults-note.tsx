"use client";

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { fetchProfile } from "@/lib/profile";

export function PlanDefaultsNote() {
  const { t } = useLocale();
  const [summary, setSummary] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void fetchProfile()
      .then((profile) => {
        if (cancelled) {
          return;
        }
        const size = profile.preferences.default_group_size;
        const area = profile.home_area?.name;
        const parts = [area, size ? `${t("groupSize")} ${size}` : null].filter(Boolean);
        setSummary(parts.join(" · ") || t("nextPlanUsesDefaults"));
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(t("nextPlanUsesDefaults"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
      <SlidersHorizontal className="size-4 shrink-0" aria-hidden />
      {summary}{" "}
      <LocaleLink className="font-semibold text-text underline-offset-4 hover:underline" href="/settings">
        {t("profile")}
      </LocaleLink>
    </p>
  );
}
