"use client";

import { HubFrame } from "@/components/hub/hub-nav";
import { PrivacyPanel } from "@/components/privacy/privacy-panel";
import { ProfileForm } from "@/components/profile/profile-form";
import { useLocale } from "@/components/shell/locale-provider";
import { useHubCopy } from "@/lib/hub-copy";
import { usePrivacyCopy } from "@/lib/privacy-copy";
import { cn, focusRing } from "@/lib/utils";

export function SettingsView() {
  const { t } = useLocale();
  const hub = useHubCopy();
  const privacy = usePrivacyCopy();
  const sections = [
    { id: "profile", label: t("profile") },
    { id: "preferences", label: t("preferences") },
    { id: "privacy", label: privacy.privacyTitle },
  ];

  return (
    <HubFrame current="/settings" eyebrow={hub.settingsKicker} title={hub.settingsTitle} description={hub.settingsBody}>
      <ul className="scrollbar-hide -mt-2 flex gap-2 overflow-x-auto border-b border-border-subtle pb-4">
        {sections.map((section) => (
          <li key={section.id} className="shrink-0">
            <a
              href={`#${section.id}`}
              className={cn(
                "inline-flex min-h-9 items-center rounded-pill border border-border-subtle bg-surface-raised px-3.5 text-sm font-medium text-text-muted transition-colors hover:border-brand/40 hover:text-text",
                focusRing,
              )}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
      <div className="grid gap-8">
        <ProfileForm />
        <PrivacyPanel />
      </div>
    </HubFrame>
  );
}
