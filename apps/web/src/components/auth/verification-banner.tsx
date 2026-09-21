"use client";

import { MailWarning } from "lucide-react";
import { useAuth } from "@/components/shell/auth-provider";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";

export function VerificationBanner() {
  const { user } = useAuth();
  const { t } = useLocale();
  if (!user || user.email_verified) {
    return null;
  }
  return (
    <div role="status" className="border-b border-border-subtle bg-accent-subtle text-accent-strong">
      <p className="shell-frame flex flex-wrap items-center justify-center gap-x-2 gap-y-1 py-2.5 text-center text-sm">
        <MailWarning className="size-4 shrink-0" aria-hidden />
        {t("unverifiedBanner")}{" "}
        <LocaleLink className="font-semibold underline underline-offset-4" href="/verify-email">
          {t("verifyEmail")}
        </LocaleLink>
      </p>
    </div>
  );
}
