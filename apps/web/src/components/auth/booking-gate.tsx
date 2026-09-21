"use client";

import { MailWarning, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/shell/auth-provider";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Notice } from "@/components/ui/notice";

export function BookingGate() {
  const { user } = useAuth();
  const { t } = useLocale();
  const locked = Boolean(user && !user.email_verified);
  return (
    <Notice
      tone={locked ? "warning" : "info"}
      icon={locked ? <MailWarning aria-hidden /> : <ShieldCheck aria-hidden />}
    >
      <p className="font-semibold text-text">{t("bookings")}</p>
      <p>
        {locked ? (
          <>
            {t("verifyToBook")}{" "}
            <LocaleLink className="font-semibold underline underline-offset-4" href="/verify-email">
              {t("verifyEmail")}
            </LocaleLink>
          </>
        ) : (
          t("travellerFooter")
        )}
      </p>
    </Notice>
  );
}
