"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import { useAuth } from "@/components/shell/auth-provider";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import { acceptPolicies } from "@/lib/auth";
import { LEGAL_VERSIONS, type LegalKind } from "@/lib/legal/types";
import { useTrustCopy } from "@/lib/trust-copy";
import { cn, focusRing } from "@/lib/utils";

const PATHS: Partial<Record<LegalKind, string>> = { terms: "/terms", privacy: "/privacy" };

function isLegalKind(value: string): value is LegalKind {
  return value in LEGAL_VERSIONS;
}

/**
 * Asks a signed-in person to accept new versions of the terms or privacy policy
 * (MSHWAR-113). Acceptance is recorded against the exact versions shown here.
 */
export function PolicyUpdateBanner() {
  const { user, refresh } = useAuth();
  const copy = useTrustCopy();
  const [pending, setPending] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const kinds = (user?.policies_to_accept ?? []).filter(isLegalKind);
  if (!kinds.length) {
    return null;
  }

  async function accept() {
    setPending(true);
    setFailed(false);
    try {
      await acceptPolicies(Object.fromEntries(kinds.map((kind) => [kind, LEGAL_VERSIONS[kind]])));
      await refresh();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="policy-update-title" className="border-b border-border-subtle bg-brand-subtle">
      <div className="shell-frame flex flex-col gap-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="grid gap-0.5">
            <h2 id="policy-update-title" className="font-semibold">
              {copy.policyUpdateTitle}
            </h2>
            <p className="text-text-muted">
              {copy.policyUpdateBody}{" "}
              {kinds.map((kind, index) => (
                <React.Fragment key={kind}>
                  {index ? " · " : null}
                  <LocaleLink
                    href={PATHS[kind] ?? "/terms"}
                    className={cn("font-semibold text-text underline underline-offset-4", focusRing)}
                  >
                    {kind === "privacy" ? copy.privacyLink : copy.termsLink}
                  </LocaleLink>
                </React.Fragment>
              ))}
            </p>
            {failed ? (
              <p role="alert" className="text-danger">
                {copy.policyError}
              </p>
            ) : null}
          </div>
        </div>
        <Button type="button" size="sm" disabled={pending} onClick={() => void accept()}>
          {copy.policyAccept}
        </Button>
      </div>
    </section>
  );
}
