"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Notice } from "@/components/ui/notice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/shell/auth-provider";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { requestPasswordReset, resetPassword } from "@/lib/auth";
import { withLocalePrefix } from "@/lib/locale";

export function RecoveryForm({ mode }: { mode: "forgot" | "reset" }) {
  const { t, locale } = useLocale();
  const { refresh } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function onForgot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("authError");
      setError(message === "authError" ? t("authError") : message);
    } finally {
      setPending(false);
    }
  }

  async function onReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await resetPassword({ token, password });
      await refresh();
      router.replace(withLocalePrefix(locale, "/"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("authError");
      if (message === "Invalid or expired reset link") {
        setError(t("invalidReset"));
      } else {
        setError(message === "authError" ? t("authError") : message);
      }
    } finally {
      setPending(false);
    }
  }

  const backLink = (
    <LocaleLink className="inline-flex items-center gap-2 font-semibold text-text hover:underline" href="/signin">
      <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
      {t("backToSignIn")}
    </LocaleLink>
  );

  if (mode === "reset" && !token) {
    return (
      <AuthLayout title={t("resetPassword")} footer={backLink} imageIndex={4}>
        <Notice tone="warning">{t("invalidReset")}</Notice>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={mode === "forgot" ? t("forgotPassword") : t("resetPassword")}
      description={mode === "forgot" ? t("forgotHint") : t("passwordHint")}
      footer={backLink}
      imageIndex={mode === "forgot" ? 4 : 1}
    >
      {mode === "forgot" && sent ? (
        <Notice tone="success" icon={<MailCheck aria-hidden />}>
          <p role="status">{t("resetSent")}</p>
        </Notice>
      ) : (
        <form className="grid gap-5" onSubmit={(event) => void (mode === "forgot" ? onForgot(event) : onReset(event))}>
          {mode === "forgot" ? (
            <div className="grid gap-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="new-password">{t("newPassword")}</Label>
              <Input
                id="new-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          )}
          {error ? (
            <Notice tone="danger" role="alert">
              {error}
            </Notice>
          ) : null}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {mode === "forgot" ? t("sendResetLink") : t("updatePassword")}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
