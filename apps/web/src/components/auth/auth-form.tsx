"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LocaleLink } from "@/components/shell/locale-link";
import { withLocalePrefix } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Notice } from "@/components/ui/notice";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/shell/auth-provider";
import { useLocale } from "@/components/shell/locale-provider";
import { registerAccount, safeNextPath, signInAccount } from "@/lib/auth";
import { LEGAL_VERSIONS } from "@/lib/legal/types";
import { useTrustCopy } from "@/lib/trust-copy";
import { cn, focusRing } from "@/lib/utils";

function ConsentCheckbox({
  id,
  checked,
  onChange,
  children,
  describedBy,
  required,
  invalid,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  children: React.ReactNode;
  describedBy?: string;
  required?: boolean;
  invalid?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-5 shrink-0"
        checked={checked}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={id} className="text-sm leading-relaxed">
        {children}
      </label>
    </div>
  );
}

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const { t, locale } = useLocale();
  const trust = useTrustCopy();
  const { refresh } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = safeNextPath(params.get("next"));
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  // Nothing is pre-ticked: terms are required, the other two are optional choices (MSHWAR-113).
  const [acceptTerms, setAcceptTerms] = React.useState(false);
  const [personalisation, setPersonalisation] = React.useState(false);
  const [marketing, setMarketing] = React.useState(false);
  const [termsMissing, setTermsMissing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (mode === "signup" && !acceptTerms) {
      setTermsMissing(true);
      setError(trust.acceptRequired);
      return;
    }
    setPending(true);
    try {
      if (mode === "signup") {
        await registerAccount({
          email,
          password,
          display_name: displayName,
          locale,
          accept_terms: acceptTerms,
          policy_versions: { terms: LEGAL_VERSIONS.terms, privacy: LEGAL_VERSIONS.privacy },
          personalisation_consent: personalisation,
          marketing_consent: marketing,
        });
      } else {
        await signInAccount({ email, password });
      }
      await refresh();
      router.replace(withLocalePrefix(locale, nextPath));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("authError");
      setError(message === "authError" ? t("authError") : message);
    } finally {
      setPending(false);
    }
  }

  const footer =
    mode === "signup" ? (
      <p>
        {t("haveAccount")}{" "}
        <LocaleLink
          className="font-semibold text-text underline underline-offset-4"
          href={`/signin?next=${encodeURIComponent(nextPath)}`}
        >
          {t("signIn")}
        </LocaleLink>
      </p>
    ) : (
      <p>
        {t("noAccount")}{" "}
        <LocaleLink
          className="font-semibold text-text underline underline-offset-4"
          href={`/signup?next=${encodeURIComponent(nextPath)}`}
        >
          {t("signUp")}
        </LocaleLink>
      </p>
    );

  return (
    <AuthLayout
      title={mode === "signup" ? t("signUp") : t("signIn")}
      description={mode === "signup" ? t("authJoin") : t("authWelcome")}
      footer={footer}
      imageIndex={mode === "signup" ? 3 : 2}
    >
      <form
        className="grid gap-5"
        onSubmit={(event) => void onSubmit(event)}
        aria-describedby={error ? "auth-error" : undefined}
      >
        {mode === "signup" ? (
          <Field id="display-name" label={t("displayName")}>
            <Input
              name="display_name"
              autoComplete="name"
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </Field>
        ) : null}
        <Field id="email" label={t("email")}>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field id="password" label={t("password")} description={mode === "signup" ? t("passwordHint") : undefined}>
          <Input
            name="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={mode === "signup" ? 10 : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {mode === "signin" ? (
          <p className="-mt-2 text-end text-sm">
            <LocaleLink className="font-medium text-text underline-offset-4 hover:underline" href="/forgot-password">
              {t("forgotPassword")}
            </LocaleLink>
          </p>
        ) : null}
        {mode === "signup" ? (
          <div className="grid gap-3 border-t border-border-subtle pt-4">
            <ConsentCheckbox
              id="accept-terms"
              required
              invalid={termsMissing && !acceptTerms}
              checked={acceptTerms}
              onChange={(value) => {
                setAcceptTerms(value);
                if (value) {
                  setTermsMissing(false);
                }
              }}
            >
              {trust.acceptLead}{" "}
              <LocaleLink
                href="/terms"
                target="_blank"
                className={cn("font-semibold text-text underline underline-offset-4", focusRing)}
              >
                {trust.termsLink}
              </LocaleLink>{" "}
              {trust.acceptJoin}{" "}
              <LocaleLink
                href="/privacy"
                target="_blank"
                className={cn("font-semibold text-text underline underline-offset-4", focusRing)}
              >
                {trust.privacyLink}
              </LocaleLink>
              {trust.acceptEnd}
            </ConsentCheckbox>
            <ConsentCheckbox
              id="consent-personalisation"
              describedBy="consent-optional"
              checked={personalisation}
              onChange={setPersonalisation}
            >
              {trust.signupPersonalisation}
            </ConsentCheckbox>
            <ConsentCheckbox
              id="consent-marketing"
              describedBy="consent-optional"
              checked={marketing}
              onChange={setMarketing}
            >
              {trust.signupMarketing}
            </ConsentCheckbox>
            <p id="consent-optional" className="ps-8 text-xs text-text-muted">
              {trust.signupOptional}
            </p>
          </div>
        ) : null}
        {error ? (
          <Notice tone="danger" id="auth-error" role="alert">
            {error}
          </Notice>
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {mode === "signup" ? t("createAccount") : t("signIn")}
        </Button>
      </form>
    </AuthLayout>
  );
}
