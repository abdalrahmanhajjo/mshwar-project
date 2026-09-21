"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Notice } from "@/components/ui/notice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/shell/auth-provider";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { resendVerification, verifyEmail } from "@/lib/auth";

export function VerifyEmailForm() {
  const { t } = useLocale();
  const { user, refresh } = useAuth();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [verified, setVerified] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [pending, setPending] = React.useState(() => Boolean(token));
  const emailValue = email || user?.email || "";

  React.useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    void verifyEmail(token)
      .then(async () => {
        if (cancelled) {
          return;
        }
        await refresh();
        setVerified(true);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : t("authError");
        setError(message === "Invalid or expired verification link" ? t("invalidVerify") : message);
      })
      .finally(() => {
        if (!cancelled) {
          setPending(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, t, token]);

  async function onResend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await resendVerification(emailValue);
      setSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("authError");
      setError(message === "authError" ? t("authError") : message);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title={t("verifyEmail")}
      imageIndex={5}
      description={verified || sent ? null : <p>{t("verifyEmailHint")}</p>}
      footer={
        <LocaleLink className="inline-flex items-center gap-2 font-semibold text-text hover:underline" href="/signin">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {t("backToSignIn")}
        </LocaleLink>
      }
    >
      {verified || sent ? (
        <Notice tone="success" icon={<MailCheck aria-hidden />}>
          <p role="status">{verified ? t("emailVerified") : t("verificationSent")}</p>
        </Notice>
      ) : (
        <form className="grid gap-5" onSubmit={(event) => void onResend(event)}>
          <div className="grid gap-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={emailValue}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          {error ? (
            <Notice tone="danger" role="alert">
              {error}
            </Notice>
          ) : null}
          {pending && token ? <p className="text-sm text-text-muted">{t("verifyEmail")}</p> : null}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {t("resendVerification")}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
