"use client";

import { ShellPage } from "@/components/shell/shell-page";
import { useLocale } from "@/components/shell/locale-provider";
import type { MessageKey } from "@/lib/messages";

export function LocalizedShellPage({ titleKey, descriptionKey }: { titleKey: MessageKey; descriptionKey: MessageKey }) {
  const { t } = useLocale();
  return <ShellPage title={t(titleKey)} description={t(descriptionKey)} />;
}
